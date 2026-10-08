import { cn } from "@/lib/utils";
import { clamp, fixed } from "@/lib/tm/dsp";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

/* ------------------------------------------------------------------ *
 * Rack faceplate primitives — silkscreen legends, etched panels,
 * machined knobs. Everything is hairline borders + layered charcoal.
 * ------------------------------------------------------------------ */

export function Legend({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block text-[10px] leading-none font-medium tracking-[0.16em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Readout({
  value,
  unit,
  className,
  tone = "default",
}: {
  value: string;
  unit?: string;
  className?: string;
  tone?: "default" | "accent" | "green" | "red";
}) {
  const tones = {
    default: "text-foreground/90",
    accent: "text-[#F5A524]",
    green: "text-[#4ADE80]",
    red: "text-[#FF4D4D]",
  } as const;
  return (
    <span
      className={cn(
        "font-mono text-[13px] tabular-nums tracking-tight",
        tones[tone],
        className,
      )}
    >
      {value}
      {unit ? <span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span> : null}
    </span>
  );
}

export function Led({
  on,
  color = "#4ADE80",
  label,
}: {
  on: boolean;
  color?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-[7px] rounded-full transition-all duration-300"
        style={{
          background: on ? color : "#444C59",
          boxShadow: on ? `0 0 7px ${color}99` : "inset 0 0 2px #000",
        }}
      />
      {label ? (
        <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}
    </span>
  );
}

/** A milled faceplate: hairline border, faint top light, silkscreened header. */
export function RackUnit({
  index,
  title,
  eyebrow,
  right,
  children,
  className,
  accent = "#F5A524",
}: {
  index?: string;
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-[#242A32] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-30px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-[#2C333D] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          {index ? (
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: accent }}
            >
              {index}
            </span>
          ) : null}
          <span
            className="h-3.5 w-[2px] rounded-full"
            style={{ background: accent, boxShadow: `0 0 6px ${accent}88` }}
          />
          <div>
            <h2 className="text-[13px] leading-none font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {eyebrow ? (
              <p className="mt-1 text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                {eyebrow}
              </p>
            ) : null}
          </div>
        </div>
        {right}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Legend>{label}</Legend>
      {children}
    </div>
  );
}

/** Segmented selector — mode switches, emphasis standards, codecs. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  accent = "#F5A524",
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  accent?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex w-full rounded-lg border border-border/70 bg-[#14181E] p-[3px]",
        className,
      )}
      role="radiogroup"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-md font-medium whitespace-nowrap transition-all duration-150",
              size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
              active
                ? "bg-[#39424E] text-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]"
                : "text-muted-foreground hover:text-foreground/80",
            )}
            style={active ? { color: accent, boxShadow: `inset 0 -2px 0 0 ${accent}` } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal parameter fader with a silkscreen legend and mono readout. */
export function Fader({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  digits = 1,
  onChange,
  accent = "#F5A524",
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  digits?: number;
  onChange: (v: number) => void;
  accent?: string;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-50")}>
      <div className="flex items-baseline justify-between gap-2">
        <Legend>{label}</Legend>
        <Readout value={fixed(value, digits)} unit={unit} />
      </div>
      <div className="relative h-6 select-none">
        <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 overflow-hidden rounded-full bg-[#12161B] ring-1 ring-black/60 ring-inset">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${pct}%`, background: accent, boxShadow: `0 0 8px ${accent}66` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0 [&::-webkit-slider-thumb]:size-5"
        />
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-black/70 bg-gradient-to-b from-[#3A3F47] to-[#20242A] shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-[left] duration-75"
          style={{ left: `clamp(6px, ${pct}%, calc(100% - 6px))` }}
        >
          <span className="absolute inset-x-[3px] top-1/2 h-px -translate-y-1/2 bg-black/70" />
        </div>
      </div>
    </div>
  );
}

/** Compact gain-reduction meter with a peak-hold marker. Used by the MB3
 *  overview and the processing-activity panel so both read identically. */
export function GrBar({
  value,
  peak,
  max = 14,
  color = "#F5A524",
  width = "w-full",
}: {
  value: number;
  peak?: number;
  max?: number;
  color?: string;
  width?: string;
}) {
  const pct = clamp(value / max, 0, 1) * 100;
  const pk = clamp(peak ?? value, 0, max) / max * 100;
  return (
    <div
      className={`relative h-2 overflow-hidden rounded-full bg-[#12161B] ring-1 ring-black/70 ring-inset ${width}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-100"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: `0 0 8px ${color}55`,
        }}
      />
      <div
        className="absolute top-0 h-full w-[2px] bg-white/70"
        style={{ left: `calc(${pk}% - 1px)` }}
      />
    </div>
  );
}

/** Rotary control: drag vertically, scroll, arrow keys, double-click reset. */
export function Knob({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  digits = 1,
  onChange,
  onReset,
  accent = "#F5A524",
  size = 54,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  digits?: number;
  onChange: (v: number) => void;
  onReset?: () => void;
  accent?: string;
  size?: number;
}) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const [active, setActive] = useState(false);
  const span = max - min;
  const norm = clamp((value - min) / span, 0, 1);
  const startAngle = -135;
  const sweep = 270;
  const angle = startAngle + norm * sweep;

  const apply = useCallback(
    (next: number) => {
      const snapped = Math.round(next / step) * step;
      onChange(Number(clamp(snapped, min, max).toFixed(4)));
    },
    [max, min, onChange, step],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value };
    setActive(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    const gain = e.shiftKey ? 4 : 1;
    apply(drag.current.v + (dy / 170) * span * gain);
  };
  const endDrag = () => {
    drag.current = null;
    setActive(false);
  };

  const r = size / 2;
  const trackR = r - 6;
  const arc = (from: number, to: number) => {
    const pt = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [r + trackR * Math.cos(rad), r + trackR * Math.sin(rad)];
    };
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${trackR} ${trackR} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex select-none flex-col items-center gap-1.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => (onReset ? onReset() : apply(min + span / 2))}
        onKeyDown={(e) => {
          const mult = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            apply(value + step * mult);
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            apply(value - step * mult);
          }
        }}
        onWheel={(e) => apply(value - Math.sign(e.deltaY) * step * 4)}
        className="cursor-ns-resize rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#F5A524]/50"
        style={{ width: size, height: size, touchAction: "none" }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <radialGradient id={`kg-${label.replace(/\W/g, "")}`} cx="50%" cy="30%">
              <stop offset="0%" stopColor="#384049" />
              <stop offset="100%" stopColor="#1E232B" />
            </radialGradient>
          </defs>
          {/* etched tick marks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const deg = startAngle + (i / 10) * sweep;
            const rad = ((deg - 90) * Math.PI) / 180;
            const inner = r - 2.5;
            const outer = r + 1.5;
            return (
              <line
                key={i}
                x1={r + inner * Math.cos(rad)}
                y1={r + inner * Math.sin(rad)}
                x2={r + outer * Math.cos(rad)}
                y2={r + outer * Math.sin(rad)}
                stroke="#4C5563"
                strokeWidth={1}
              />
            );
          })}
          <path d={arc(startAngle, startAngle + sweep)} stroke="#333B46" strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d={arc(startAngle, Math.max(angle, startAngle + 0.01))} stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" opacity={active ? 1 : 0.85} />
          <circle cx={r} cy={r} r={r - 9} fill={`url(#kg-${label.replace(/\W/g, "")})`} stroke="#161A20" strokeWidth={1} />
          <line
            x1={r + (r - 20) * Math.cos(((angle - 90) * Math.PI) / 180)}
            y1={r + (r - 20) * Math.sin(((angle - 90) * Math.PI) / 180)}
            x2={r + (r - 12) * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={r + (r - 12) * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke={accent}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="text-[9px] leading-none font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-[11px] leading-none tabular-nums text-foreground/85">
        {fixed(value, digits)}
        <span className="ml-0.5 text-[9px] text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}
