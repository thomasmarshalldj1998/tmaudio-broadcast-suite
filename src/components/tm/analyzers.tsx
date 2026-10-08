import { BANDS, clamp, fixed, SM1268_MASK } from "@/lib/tm/dsp";
import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ *
 * Canvas instrument cluster — every meter runs real ballistics on a
 * requestAnimationFrame loop, never a CSS keyframe pretending.
 * ------------------------------------------------------------------ */

/** Program level model shared by meters, scopes and readouts so the DOM
 *  numbers and the drawn bars can never disagree. */
export function programLevel(t: number, ch = 0): number {
  const phrase =
    Math.sin(t * 0.37 + ch * 0.6) * 0.55 + Math.sin(t * 0.11 + ch) * 0.45;
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.9)), 8);
  const grain = Math.sin(t * 21.7 + ch * 3.1) * 1.1 + Math.sin(t * 9.1 + ch) * 0.7;
  return clamp(-15.5 + phrase * 4.5 + beat * 7.5 + grain, -46, 0.4);
}

/** Gated integrated loudness wandering around the chain's target. */
export function loudness(t: number, target: number): number {
  return target + Math.sin(t * 0.23) * 1.4 + Math.sin(t * 0.71) * 0.5;
}

/** True peak with inter-sample overshoot. */
export function truePeak(t: number, ceiling: number): number {
  const p = programLevel(t) + 1.35 + Math.sin(t * 3.3) * 0.6;
  return Math.min(p, ceiling + 0.35);
}

/** Measure how long a canvas-sized box takes to draw, used for the CPU badge. */
export function useTick(ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return n;
}

/** Return `color` at alpha `a` (0–1).
 *
 * Appending a two-digit hex suffix ("#RRGGBB" + "22") only produces a valid
 * colour for hex inputs — passing "rgba(…)22" to CanvasGradient.addColorStop()
 * throws `SyntaxError: could not be parsed as a color`. rgb()/rgba()/hsl()
 * inputs are therefore rebuilt with a scaled alpha instead. */
export function fadeColor(color: string, a: number): string {
  const alpha = Math.max(0, Math.min(1, a));
  const fn = color.match(/^(rgba?)\(\s*([^)]+)\)$/i);
  if (fn) {
    const p = fn[2].split(/[\s,/]+/).filter(Boolean);
    const base = p[3] === undefined ? 1 : parseFloat(p[3]);
    const scaled = (Number.isFinite(base) ? base : 1) * alpha;
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${Number.isFinite(scaled) ? scaled.toFixed(3) : "1"})`;
  }
  if (color.startsWith("#")) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    return `${hex}${Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0")}`;
  }
  return color; // named colours: no safe alpha variant, return unchanged
}

type Draw = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) => void;

/** Resize-aware rAF canvas. Parent element owns the layout box. */
export function useCanvas(draw: Draw) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, parent.clientWidth);
      h = Math.max(1, parent.clientHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();

    const start = performance.now();
    const loop = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawRef.current(ctx, w, h, (now - start) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return ref;
}

function grid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { cols: number; rows: number; color?: string },
) {
  ctx.save();
  ctx.strokeStyle = opts.color ?? "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let i = 1; i < opts.cols; i++) {
    const x = Math.round((i / opts.cols) * w) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let i = 1; i < opts.rows; i++) {
    const y = Math.round((i / opts.rows) * h) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Input / output spectrum
 * ------------------------------------------------------------------ */

export function SpectrumAnalyzer({
  running,
  accent = "#F5A524",
  gainDb = 0,
  bars = 56,
  bandGains,
}: {
  running: boolean;
  accent?: string;
  gainDb?: number;
  bars?: number;
  /** Per-band gain in dB, derived from the live Sensus config. Applied to
   *  the POST-DSP analyser so pre- and post-DSP really differ. */
  bandGains?: number[];
}) {
  const peaks = useRef<number[]>([]);
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 8, rows: 5 });

    if (peaks.current.length !== bars) peaks.current = new Array(bars).fill(0);

    const floor = h - 6;
    const usable = h - 14;
    const bw = w / bars;

    for (let i = 0; i < bars; i++) {
      const f = (i / bars) ** 2.1; // log-ish frequency mapping
      // Spectral envelope: tilted program material with a presence bump.
      let mag = 0.72 - f * 0.5 + Math.exp(-((f - 0.36) ** 2) / 0.02) * 0.16;
      if (running) {
        mag +=
          Math.sin(t * 5.3 + i * 0.7) * 0.05 +
          Math.sin(t * 11.7 + i * 1.9) * 0.035 +
          Math.sin(t * 2.1 + i * 0.31) * 0.06;
        mag += Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.9)), 8) * (i < bars * 0.16 ? 0.45 : 0);
        mag += gainDb / 60;
        if (bandGains) {
          const freq = 20 * Math.pow(1000, f);
          const idx = BANDS.findIndex((b) => freq >= b.low && freq < b.high);
          if (idx >= 0) mag += (bandGains[idx] ?? 0) / 60;
        }
      } else {
        mag = -0.9;
      }
      mag = clamp(mag, -1, 1);
      const target = mag <= -0.9 ? 0 : (mag + 1) / 2;
      const prev = peaks.current[i] ?? 0;
      const smoothed = prev > target ? prev - 0.012 : target;
      peaks.current[i] = smoothed;

      const bh = Math.max(1, smoothed * usable);
      const x = i * bw;
      const g = ctx.createLinearGradient(0, floor - bh, 0, floor);
      g.addColorStop(0, accent);
      g.addColorStop(1, fadeColor(accent, 0x55 / 255));
      ctx.fillStyle = g;
      ctx.fillRect(x + 1, floor - bh, bw - 2, bh);

      // peak-hold hairline
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(x + 1, floor - smoothed * usable - 1, bw - 2, 1);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(0, floor + 0.5);
    ctx.lineTo(w, floor + 0.5);
    ctx.stroke();
  });

  return (
    <div className="relative h-[168px] w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5">
      <canvas ref={ref} className="block" />
      <span className="pointer-events-none absolute top-2 left-2.5 font-mono text-[9px] tracking-wider text-white/65">
        20 Hz
      </span>
      <span className="pointer-events-none absolute top-2 right-2.5 font-mono text-[9px] tracking-wider text-white/65">
        20 kHz
      </span>
      <span className="pointer-events-none absolute bottom-2 left-2.5 font-mono text-[9px] tracking-wider text-white/65">
        0 dB
      </span>
      <span className="pointer-events-none absolute bottom-2 left-14 font-mono text-[9px] tracking-wider text-white/60">
        −60
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * FM multiplex composite analyser with SM.1268 mask overlay
 * ------------------------------------------------------------------ */

export function MpxAnalyzer({
  running,
  pilot = 9,
  subcarrier = 90,
  injection = 3.5,
  maskEnforce = true,
  emphasis = 50,
}: {
  running: boolean;
  pilot?: number;
  subcarrier?: number;
  injection?: number;
  maskEnforce?: boolean;
  emphasis?: number;
}) {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 10, rows: 4 });

    const maxF = 100000;
    const x = (f: number) => (f / maxF) * w;
    const dbToY = (db: number) => h - 8 - ((db + 60) / 60) * (h - 18);
    const jitter = (i: number) =>
      running ? Math.sin(t * 4.1 + i) * 1.4 + Math.sin(t * 9.7 + i * 2) * 0.8 : -6;

    const region = (
      f0: number,
      f1: number,
      topDb: number,
      color: string,
      seed: number,
    ) => {
      ctx.beginPath();
      ctx.moveTo(x(f0), h);
      const steps = 26;
      for (let i = 0; i <= steps; i++) {
        const f = f0 + ((f1 - f0) * i) / steps;
        const edge = Math.min(i, steps - i);
        const roll = edge < 3 ? edge / 3 : 1;
        const shaped =
          topDb +
          (jitter(seed + i) + Math.sin(i * 1.7 + seed + t) * 1.2) * 0.35 -
          (1 - roll) * 6;
        ctx.lineTo(x(f), dbToY(shaped));
      }
      ctx.lineTo(x(f1), h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, color);
      g.addColorStop(1, fadeColor(color, 0x22 / 255));
      ctx.fillStyle = g;
      ctx.fill();
    };

    // L+R baseband 0-15 kHz @ 90 % modulation (flat within ±0.05 dB)
    const tau = emphasis === 75 ? 75e-6 : 50e-6;
    if (running) {
      region(0, 15000, 20 * Math.log10(0.9), "rgba(245,165,36,0.85)", 1);
      // L-R DSB-SC 23-53 kHz
      region(
        23000,
        53000,
        20 * Math.log10(subcarrier / 100) + jitter(7) * 0.4,
        "rgba(245,165,36,0.5)",
        12,
      );
    }

    // 19 kHz pilot
    if (running) {
      const pilotDb = 20 * Math.log10(pilot / 100);
      const px = x(19000);
      ctx.fillStyle = "#F5A524";
      ctx.fillRect(px - 1.5, dbToY(pilotDb + jitter(3)), 3, h - dbToY(pilotDb + jitter(3)));
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("19k PILOT", px + 5, dbToY(pilotDb) - 4);

      // 57 kHz RDS subcarrier (BPSK sidebands)
      const rdsDb = 20 * Math.log10(injection / 100);
      const rx = x(57000);
      ctx.fillStyle = "rgba(53,200,216,0.9)";
      ctx.fillRect(rx - 5, dbToY(rdsDb - 4), 10, h - dbToY(rdsDb - 4));
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("57k RDS", rx + 8, dbToY(rdsDb) - 4);
    }

    // 38 kHz suppressed carrier marker
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x(38000), 4);
    ctx.lineTo(x(38000), h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText("38k DSB-SC", x(38000) + 4, 14);

    // Pre-emphasis curve applied ahead of the limiter (50 / 75 µs)
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const f = 100 * Math.pow(150, i / 60); // 100 Hz -> 15 kHz, log axis
      const boost =
        10 *
        Math.log10(
          (1 + Math.pow(2 * Math.PI * f * tau, 2)) /
            (1 + Math.pow(2 * Math.PI * 1000 * tau, 2)),
        );
      const py = dbToY(20 * Math.log10(0.9) + boost * 0.5);
      if (i === 0) ctx.moveTo(x(f), py);
      else ctx.lineTo(x(f), py);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ITU-R SM.1268 mask
    if (maskEnforce) {
      ctx.beginPath();
      SM1268_MASK.forEach((p, i) => {
        const px = x(p.f);
        const py = dbToY(p.db);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "rgba(255,77,77,0.85)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    // frequency axis
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "9px ui-monospace, monospace";
    for (let f = 10000; f <= 100000; f += 10000) {
      ctx.fillText(`${f / 1000}k`, x(f) + 2, h - 3);
    }
  });

  return (
    <div className="relative h-[196px] w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5">
      <canvas ref={ref} className="block" />
      <div className="pointer-events-none absolute top-2 right-2.5 flex items-center gap-3 font-mono text-[9px] tracking-wider">
        <span className="flex items-center gap-1 text-white/70">
          <span className="inline-block h-px w-4 border-t border-dashed border-[#FF4D4D]" />
          SM.1268
        </span>
        <span className="text-white/70">−60 → 0 dB rel. 100 %</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sensus per-band gain reduction
 * ------------------------------------------------------------------ */

/** Per-band gain reduction of the Sensus timing law — the single source
 *  of truth shared by the BandActivity canvas and the MB3 / activity
 *  readouts, so the drawn bars and the DOM numbers always agree. */
export function bandGainReduction(
  i: number,
  t: number,
  mode: string,
  thresholds: number[],
): number {
  const speed = mode === "transient" ? 7.5 : mode === "speech" ? 2.1 : 3.6;
  const bias = (thresholds[i] + 24) / 24;
  const drive =
    Math.pow(Math.max(0, Math.sin(t * speed + i * 0.9)), 3) * 0.75 +
    (Math.sin(t * 1.3 + i * 2.1) * 0.5 + 0.5) * 0.35 +
    Math.sin(t * 17 + i) * 0.05;
  return clamp(drive * (0.5 + bias * 0.9) * 14, 0, 14);
}

export function BandActivity({
  running,
  mode,
  accent = "#F5A524",
  thresholds,
}: {
  running: boolean;
  mode: string;
  accent?: string;
  thresholds: number[];
}) {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 6, rows: 4 });

    const colW = w / 6;
    const top = 8;
    const span = h - 26;

    for (let i = 0; i < 6; i++) {
      const band = BANDS[i];
      const gr = running ? bandGainReduction(i, t, mode, thresholds) : 0;
      const x0 = i * colW;
      const barH = (gr / 14) * span;

      // track
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(x0 + 7, top, colW - 14, span);

      const g = ctx.createLinearGradient(0, top, 0, top + span);
      g.addColorStop(0, band.color);
      g.addColorStop(1, fadeColor(band.color, 0x44 / 255));
      ctx.fillStyle = g;
      ctx.fillRect(x0 + 7, top, colW - 14, Math.max(1.5, barH));
      if (barH > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(x0 + 7, top + barH - 1, colW - 14, 1);
      }

      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(band.name.slice(0, 4).toUpperCase(), x0 + colW / 2, h - 12);
      ctx.fillStyle = accent;
      ctx.fillText(gr > 0.05 ? `−${fixed(gr, 1)}` : "0.0", x0 + colW / 2, h - 2);
      ctx.textAlign = "left";
    }
  });

  return (
    <div className="relative h-[210px] w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5">
      <canvas ref={ref} className="block" />
      <span className="pointer-events-none absolute top-2 left-2.5 font-mono text-[9px] tracking-wider text-white/65">
        GR dB
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Loudness / true-peak bar meter with peak hold
 * ------------------------------------------------------------------ */

export function LevelMeter({
  label,
  value,
  min,
  max,
  ceiling,
  unit,
  accent = "#F5A524",
  width = "w-full",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  ceiling?: number;
  unit: string;
  accent?: string;
  width?: string;
}) {
  const hold = useRef<{ v: number; at: number }>({ v: min, at: 0 });
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100);

  if (value >= hold.current.v) hold.current = { v: value, at: Date.now() };
  else if (Date.now() - hold.current.at > 900) hold.current.v = Math.max(min, hold.current.v - (max - min) * 0.006);
  const holdPct = clamp(((hold.current.v - min) / (max - min)) * 100, 0, 100);

  const over = ceiling !== undefined && value > ceiling;
  const fill = over ? "#FF4D4D" : accent;

  return (
    <div className={`flex flex-col gap-1.5 ${width}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] tracking-[0.16em] text-muted-foreground uppercase">{label}</span>
        <span
          className="font-mono text-[12px] tabular-nums"
          style={{ color: over ? "#FF4D4D" : "rgba(245,255,245,0.85)" }}
        >
          {value > 0 ? "+" : ""}
          {fixed(value, 1)}
          <span className="ml-0.5 text-[9px] text-muted-foreground">{unit}</span>
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[#12161B] ring-1 ring-black/70 ring-inset">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%`, background: fill, boxShadow: `0 0 8px ${fill}55` }}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-white/70"
          style={{ left: `calc(${holdPct}% - 1px)` }}
        />
        {ceiling !== undefined && (
          <div
            className="absolute top-0 h-full w-[1.5px] bg-[#FF4D4D]/80"
            style={{ left: `${clamp(((ceiling - min) / (max - min)) * 100, 0, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Phase correlation scope (mono-compatibility watchdog)
 * ------------------------------------------------------------------ */

export function CorrelationScope({
  running,
  coherence = 96,
}: {
  running: boolean;
  coherence?: number;
}) {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 4, rows: 4 });

    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2 - 10;
    const ry = h / 2 - 8;

    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, h - 4);
    ctx.moveTo(4, cy);
    ctx.lineTo(w - 4, cy);
    ctx.stroke();

    if (!running) return;
    const side = clamp((100 - coherence) / 100, 0.02, 0.6);
    const phase = Math.sin(t * 0.6) * 0.5 + 0.5;
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2;
      const l = Math.sin(a * 3 + t * 1.4);
      const r = Math.sin(a * 3 + t * 1.4 + phase * side * 1.4);
      const X = cx + (l + r) * 0.5 * rx * 0.9;
      const Y = cy - (l - r) * 0.5 * ry * 2.4;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = "#4ADE80";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  });

  return (
    <div className="relative h-[132px] w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5">
      <canvas ref={ref} className="block" />
      <span className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[9px] text-white/60">
        MONO
      </span>
      <span className="pointer-events-none absolute top-1.5 right-2 font-mono text-[9px] text-white/60">
        SIDE
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * RDS biphase symbol scope
 * ------------------------------------------------------------------ */

export function BiphaseScope({
  bits,
  running,
}: {
  bits: number[];
  running: boolean;
}) {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 8, rows: 3 });

    if (!bits.length) return;
    const visible = Math.max(24, Math.floor(bits.length * 0.6));
    const offset = running ? Math.floor(t * 9) % Math.max(1, bits.length - visible) : 0;
    const symW = w / visible;
    const mid = h / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, mid + 0.5);
    ctx.lineTo(w, mid + 0.5);
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < visible; i++) {
      const bit = bits[(offset + i) % bits.length];
      const x0 = i * symW;
      const high = bit ? -1 : 1; // Manchester: high-then-low / low-then-high
      const a = mid + high * (h * 0.3);
      const b = mid - high * (h * 0.3);
      if (i === 0) ctx.moveTo(x0, a);
      else ctx.lineTo(x0, a);
      ctx.lineTo(x0 + symW / 2, a);
      ctx.lineTo(x0 + symW / 2, b);
      ctx.lineTo(x0 + symW, b);
    }
    ctx.strokeStyle = "#35C8D8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  });

  return (
    <div className="relative h-[96px] w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5">
      <canvas ref={ref} className="block" />
      <span className="pointer-events-none absolute top-1.5 left-2.5 font-mono text-[9px] tracking-wider text-white/65">
        BIPHASE @ 1187.5 Bd
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Loudness history — momentary / short-term / integrated traces
 * ------------------------------------------------------------------ */

export function LoudnessHistory({
  target,
  running,
}: {
  target: number;
  running: boolean;
}) {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 10, rows: 5 });

    const lo = target - 18;
    const hi = target + 12;
    const y = (lu: number) => h - 6 - ((lu - lo) / (hi - lo)) * (h - 14);
    const span = 600; // 10 minute history

    const momentary = (s: number) =>
      target + Math.sin(s * 1.9) * 5.5 + Math.sin(s * 7.3) * 2.2 +
      Math.pow(Math.max(0, Math.sin(s * Math.PI * 2 * 1.9)), 8) * 3;
    const shortTerm = (s: number) =>
      target + Math.sin(s * 0.31) * 3 + Math.sin(s * 1.1) * 1.2;
    const integrated = (s: number) =>
      target + Math.sin(s * 0.07) * 1.1 + Math.sin(s * 0.19) * 0.4;

    const trace = (
      fn: (s: number) => number,
      color: string,
      width: number,
    ) => {
      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const s = t - span + (px / w) * span;
        const lu = running ? fn(s) : lo + 1;
        if (px === 0) ctx.moveTo(px, y(lu));
        else ctx.lineTo(px, y(lu));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.lineWidth = 1;
    };

    // EBU R128 target line
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y(target));
    ctx.lineTo(w, y(target));
    ctx.stroke();
    ctx.setLineDash([]);

    trace(momentary, "rgba(245,165,36,0.45)", 1);
    trace(shortTerm, "rgba(245,165,36,0.85)", 1.4);
    trace(integrated, "#4ADE80", 1.8);

    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText("−10 min", 4, h - 4);
    ctx.fillText("now", w - 26, h - 4);
    ctx.fillText(`${target} LUFS`, 4, y(target) - 4);
  });

  return (
    <div className="relative h-[150px] w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5">
      <canvas ref={ref} className="block" />
      <div className="pointer-events-none absolute top-2 right-2.5 flex gap-3 font-mono text-[9px] tracking-wider">
        <span className="text-[#4ADE80]">— INT</span>
        <span className="text-[#F5A524]">— S</span>
        <span className="text-[#F5A524]/50">— M</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Time-domain composite waveform (landing hero + MPX path)
 * ------------------------------------------------------------------ */

export function CompositeWaveform({
  running = true,
  height = 200,
  accent = "#F5A524",
}: {
  running?: boolean;
  height?: number;
  accent?: string;
}) {
  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12161B";
    ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, { cols: 12, rows: 6 });

    const mid = h / 2;
    const windowSec = 0.0006; // 0.6 ms — pilot and subcarriers are visible
    const amp = running ? 1 : 0;

    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const u = px / w;
      const time = t * 0.15 + u * windowSec;
      // baseband audio (a few partials, emphasised HF)
      const audio =
        Math.sin(time * 2 * Math.PI * 440) * 0.45 +
        Math.sin(time * 2 * Math.PI * 1760 + 0.6) * 0.18 * (1 + Math.sin(t)) * 0.6 +
        Math.sin(time * 2 * Math.PI * 132) * 0.3;
      const pilot = Math.sin(time * 2 * Math.PI * 19000) * 0.09;
      const lmr = Math.sin(time * 2 * Math.PI * 38000 + 1.1) * 0.22 * Math.sin(time * 2 * Math.PI * 90);
      const rds = Math.sin(time * 2 * Math.PI * 57000 + Math.sin(time * 2 * Math.PI * 1187.5) * 2) * 0.035;
      const v = (audio + pilot + lmr + rds) * amp;
      const y = mid - v * (h * 0.42);
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, fadeColor(accent, 0x22 / 255));
    g.addColorStop(0.5, accent);
    g.addColorStop(1, fadeColor(accent, 0x22 / 255));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.moveTo(0, mid + 0.5);
    ctx.lineTo(w, mid + 0.5);
    ctx.stroke();
  });

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-black/60 ring-1 ring-white/5"
      style={{ height }}
    >
      <canvas ref={ref} className="block" />
    </div>
  );
}
