"use client";

import "./FateMeter.css";

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

  return (
    <div className="fate-meter">
      <div className="fate-meter-title">
        <span>
          {label} <em>{weight}%</em>
        </span>
        <small>
          {reading.a === 0 && reading.b === 0
            ? "Even"
            : reading.a > reading.b
              ? `${nameA} +${reading.a}`
              : `${nameB} +${reading.b}`}
        </small>
      </div>
      <div className="fate-meter-ends">
        <strong className="is-a">
          {nameA}
          <b>{reading.a}</b>
        </strong>
        <em>0</em>
        <strong className="is-b">
          {nameB}
          <b>{reading.b}</b>
        </strong>
      </div>
      <div className="fate-meter-track">
        <span className="fate-meter-fill is-a" style={{ width: `${reading.a / 2}%` }} />
        <span className="fate-meter-fill is-b" style={{ width: `${reading.b / 2}%` }} />
        <span className="fate-meter-dot is-a" style={{ left: `calc(${50 - reading.a / 2}% - 7px)` }} />
        <span className="fate-meter-dot is-b" style={{ left: `calc(${50 + reading.b / 2}% - 7px)` }} />
        <span className="fate-meter-zero" />
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
      <div className="fate-meter-scale">
        <span>100</span>
        <span>center 0</span>
        <span>100</span>
      </div>
    </div>
  );
}
