"use client";

type FateMeterProps = {
  nameA: string;
  nameB: string;
  label: string;
  weight: number;
  scoreA: number;
  scoreB: number;
  disabled?: boolean;
  onChangeA: (value: number) => void;
  onChangeB: (value: number) => void;
};

export default function FateMeter({
  nameA,
  nameB,
  label,
  weight,
  scoreA,
  scoreB,
  disabled,
  onChangeA,
  onChangeB,
}: FateMeterProps) {
  const a = Math.min(100, Math.max(0, Math.round(scoreA)));
  const b = Math.min(100, Math.max(0, Math.round(scoreB)));
  const lead = a === b ? "Even" : a > b ? `A +${a - b}` : `B +${b - a}`;

  return (
    <section className="fm">
      <style>{`
        .fm { display:grid !important; width:100%; gap:6px; padding:8px 0 10px; border-bottom:1px solid rgba(255,255,255,.08); }
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
        .fm-scale { display:flex; justify-content:space-between; color:#8b93a0; font-size:10px; letter-spacing:.1em; text-transform:uppercase; }
        .fm-names { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .fm-names label { display:grid; gap:3px; margin:0; }
        .fm-names .a { color:#ffd36a; text-align:left; }
        .fm-names .b { color:#7ad7ff; text-align:right; }
        .fm-names b { font-size:16px; font-variant-numeric:tabular-nums; }
        .fm-names em { font-size:11px; font-style:normal; line-height:1.2; text-transform:none; }
        .fm-names input[type=range] { width:100%; margin:0; accent-color:#ffd36a; }
        .fm-names .b input[type=range] { accent-color:#7ad7ff; }
      `}</style>
      <div className="fm-top">
        <span className="fm-cat">
          {label} <i>{weight}%</i>
        </span>
        <span className="fm-lead">{lead}</span>
      </div>
      <div className="fm-track">
        <span className="fm-fill a" style={{ width: `${a / 2}%` }} />
        <span className="fm-fill b" style={{ width: `${b / 2}%` }} />
        <span className="fm-mid" />
        <span className="fm-dot a" style={{ left: `calc(${50 - a / 2}% - 6px)` }} />
        <span className="fm-dot b" style={{ left: `calc(${50 + b / 2}% - 6px)` }} />
      </div>
      <div className="fm-scale">
        <span>100</span>
        <span>0</span>
        <span>100</span>
      </div>
      <div className="fm-names">
        <label className="a">
          <b>{a}</b>
          <em>{nameA}</em>
          <input disabled={disabled} max={100} min={0} onChange={(event) => onChangeA(Number(event.target.value))} type="range" value={a} />
        </label>
        <label className="b">
          <b>{b}</b>
          <em>{nameB}</em>
          <input disabled={disabled} max={100} min={0} onChange={(event) => onChangeB(Number(event.target.value))} type="range" value={b} />
        </label>
      </div>
    </section>
  );
}
