import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

const DEFAULT_BUCKET = process.env.SUPABASE_SUBMISSIONS_BUCKET || "submissions";
const ALLOWED_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"]);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }

  if (buckets.some((bucket) => bucket.name === DEFAULT_BUCKET)) {
    return supabase;
  }

  const { error: createError } = await supabase.storage.createBucket(DEFAULT_BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(createError.message);
  }

  return supabase;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const artistId = String(formData.get("artistId") || "").trim();
    const eventId = String(formData.get("eventId") || "").trim();
    const round = String(formData.get("round") || "1").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    if (!artistId || !eventId) {
      return NextResponse.json({ error: "Artist and event are required for upload." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Upload an MP3, WAV, or M4A audio file." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Audio file is too large for the MVP upload limit." }, { status: 400 });
    }

    const supabase = await ensureBucket();
    const extension = safeName(file.name.split(".").pop() || "mp3");
    const baseName = safeName(file.name.replace(/\.[^.]+$/, "")) || "submission";
    const filePath = `${eventId}/${artistId}/round-${round}-${Date.now()}-${baseName}.${extension}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(DEFAULT_BUCKET).upload(filePath, bytes, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(filePath);

    return NextResponse.json({
      bucket: DEFAULT_BUCKET,
      path: filePath,
      publicUrl: data.publicUrl,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
