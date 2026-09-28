"use client";

type FateMeterProps = {
  nameA: string;
  nameB: string;
  label: string;
  weight: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function pole(value: number) {
  const clamped = Math.min(100, Math.max(0, value));
  return {
    a: Math.max(0, Math.round((50 - clamped) * 2)),
    b: Math.max(0, Math.round((clamped - 50) * 2)),
  };
}

export default function FateMeter({
  nameA,
  nameB,
  label,
  weight,
  value,
  disabled,
  onChange,
}: FateMeterProps) {
  const reading = pole(value);
  const lead =
    reading.a === 0 && reading.b === 0 ? "Even" : reading.a > reading.b ? `+${reading.a}` : `+${reading.b}`;

  return (
    <section className="fm">
      <style>{`
        .fm { display:grid !important; flex-direction:column !important; width:100%; gap:6px; padding:8px 0 10px; border-bottom:1px solid rgba(255,255,255,.08); }
        .fm-top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
        .fm-cat { color:#d7d0c0; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
        .fm-cat i { color:#8b93a0; font-style:normal; }
        .fm-lead { color:#8b93a0; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
        .fm-track { position:relative; height:18px; border:1px solid rgba(255,224,154,.35); border-radius:999px; background:#07090d; }
        .fm-fill { position:absolute; top:0; height:100%; }
        .fm-fill.a { right:50%; background:linear-gradient(90deg,#c48410,#ffd36a); }
        .fm-fill.b { left:50%; background:linear-gradient(90deg,#3aa3d6,#7ad7ff); }
        .fm-mid { position:absolute; left:50%; top:-4px; bottom:-4px; width:2px; background:#f8f3e6; transform:translateX(-1px); z-index:2; }
        .fm-dot { position:absolute; top:50%; width:12px; height:12px; border-radius:50%; transform:translateY(-50%); z-index:3; box-shadow:0 0 0 2px #07090d; }
        .fm-dot.a { background:#ffd36a; }
        .fm-dot.b { background:#7ad7ff; }
        .fm-track input[type=range] { position:absolute; inset:0; width:100%; margin:0; opacity:0; cursor:pointer; z-index:4; }
        .fm-track input:disabled { cursor:not-allowed; }
        .fm-scale { display:flex; justify-content:space-between; color:#8b93a0; font-size:10px; letter-spacing:.1em; text-transform:uppercase; }
        .fm-names { display:flex; justify-content:space-between; gap:12px; }
        .fm-names span { display:grid; gap:1px; max-width:46%; font-size:11px; line-height:1.2; font-weight:500; text-transform:none; }
        .fm-names .a { color:#ffd36a; text-align:left; }
        .fm-names .b { color:#7ad7ff; text-align:right; }
        .fm-names b { font-size:16px; font-variant-numeric:tabular-nums; font-weight:700; }
      `}</style>
      <div className="fm-top">
        <span className="fm-cat">
          {label} <i>{weight}%</i>
        </span>
        <span className="fm-lead">{lead}</span>
      </div>
      <div className="fm-track">
        <span className="fm-fill a" style={{ width: `${reading.a / 2}%` }} />
        <span className="fm-fill b" style={{ width: `${reading.b / 2}%` }} />
        <span className="fm-mid" />
        <span className="fm-dot a" style={{ left: `calc(${50 - reading.a / 2}% - 6px)` }} />
        <span className="fm-dot b" style={{ left: `calc(${50 + reading.b / 2}% - 6px)` }} />
        <input
          aria-label={`${label}: ${nameA} vs ${nameB}`}
          disabled={disabled}
          max={100}
          min={0}
          onChange={(event) => onChange(Number(event.target.value))}
          type="range"
          value={value}
        />
      </div>
      <div className="fm-scale">
        <span>100</span>
        <span>0</span>
        <span>100</span>
      </div>
      <div className="fm-names">
        <span className="a">
          <b>{reading.a}</b>
          {nameA}
        </span>
        <span className="b">
          <b>{reading.b}</b>
          {nameB}
        </span>
      </div>
    </section>
  );
}
