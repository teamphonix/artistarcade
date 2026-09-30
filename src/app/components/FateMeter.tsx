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

  return (
    <section className="fm">
      <style>{`
        .fm { display:grid !important; width:100%; gap:6px; padding:8px 0 10px; border-bottom:1px solid rgba(255,255,255,.08); }
        .fm-top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
        .fm-cat { color:#d7d0c0; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
        .fm-cat i { color:#8b93a0; font-style:normal; }
        .fm-names { display:grid; grid-template-columns:1fr; gap:10px; }
        .fm-names label { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:6px; margin:0; }
        .fm-names .a { color:#ffd36a; text-align:left; }
        .fm-names .b { color:#7ad7ff; text-align:left; }
        .fm-names b { font-size:16px; font-variant-numeric:tabular-nums; }
        .fm-names em { font-size:11px; font-style:normal; line-height:1.2; text-transform:none; }
        .fm-names input[type=range] { grid-column:1 / -1; width:100%; height:28px; margin:0; touch-action:pan-y; accent-color:#ffd36a; }
        .fm-names .b input[type=range] { accent-color:#7ad7ff; }
      `}</style>
      <div className="fm-top">
        <span className="fm-cat">
          {label} <i>{weight}%</i>
        </span>
      </div>
      <div className="fm-names">
        <label className="a">
          <em>{nameA}</em>
          <b>{a}</b>
          <input aria-label={`${label} score for ${nameA}`} disabled={disabled} max={100} min={0} onChange={(event) => onChangeA(Number(event.target.value))} type="range" value={a} />
        </label>
        <label className="b">
          <em>{nameB}</em>
          <b>{b}</b>
          <input aria-label={`${label} score for ${nameB}`} disabled={disabled} max={100} min={0} onChange={(event) => onChangeB(Number(event.target.value))} type="range" value={b} />
        </label>
      </div>
    </section>
  );
}
