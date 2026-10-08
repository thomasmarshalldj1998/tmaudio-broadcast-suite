import { useRef } from "react";
import { clamp } from "./dsp";
import type { PresetKey, ProcessorConfig } from "./presets";
import {
  bandGainReduction,
  loudness,
  programLevel,
  truePeak,
  useTick,
} from "@/components/tm/analyzers";

/* ------------------------------------------------------------------ *
 * Telemetry
 *
 * Every number this module produces is *derived* from the shared
 * program model (programLevel / loudness / truePeak) and the live
 * ProcessorConfig — the same functions that draw the canvas meters.
 * Nothing is randomised, so DOM readouts, drawn bars and counters can
 * never disagree, and no event is ever invented: counters only count
 * threshold crossings that actually occur in the model.
 * ------------------------------------------------------------------ */

export type TimeWindow = "10s" | "60s" | "10m" | "session";

export const WINDOWS: { value: TimeWindow; label: string; seconds: number }[] = [
  { value: "10s", label: "10 s", seconds: 10 },
  { value: "60s", label: "60 s", seconds: 60 },
  { value: "10m", label: "10 min", seconds: 600 },
  { value: "session", label: "Session", seconds: Number.POSITIVE_INFINITY },
];

/** Engine clock: 96 kHz / 32-bit float, 2-channel program bus. */
export const ENGINE = { sampleRate: 96000, channels: 2 };

/** Per-chain compliance target and true-peak ceiling. */
export function chainTargets(cfg: ProcessorConfig, key: PresetKey) {
  if (key === "dab") return { target: cfg.dab.loudness, ceiling: cfg.dab.truePeak };
  if (key === "web") return { target: cfg.web.loudness, ceiling: cfg.web.truePeak };
  if (key === "hd") return { target: -16, ceiling: -2 };
  return { target: -14, ceiling: -1 };
}

/** Static gain of the band bank — the only gain that changes program level
 *  without dynamics, so it is what a level-match trim has to compensate. */
export function makeupDb(cfg: ProcessorConfig): number {
  const bands = cfg.sensus.bands;
  return bands.reduce((s, b) => s + b.gain, 0) / bands.length;
}

/** Instantaneous true-peak of the program model (shared with truePeak()). */
function peakModel(t: number): number {
  return programLevel(t) + 1.35 + Math.sin(t * 3.3) * 0.6;
}

type Sample = {
  t: number;
  m: number; // momentary loudness
  input: number;
  agcGr: number;
  mb3: number[]; // per-band gain reduction
  clipGr: number;
  limitGr: number;
};

export type GrStat = { now: number; peak: number };

export type Telemetry = {
  t: number;
  inputDb: number;
  processedDb: number;
  outputDb: number;
  grDb: number;
  agcGr: number;
  mb3Gr: number;
  clipGr: number;
  limitGr: number;
  bandGr: number[];
  mb3: { low: GrStat; mid: GrStat; high: GrStat };
  momentary: number;
  shortTerm: number;
  integrated: number;
  lra: number;
  truePeakDb: number;
  tpStatus: "SAFE" | "WARNING" | "ERROR";
  counters: { clip: number; limiter: number; dropout: number; underrun: number };
  latencyMs: number;
  sampleRate: number;
  channels: number;
  bufferSmp: number;
  modPct: number;
  /** EMA of the real delivery-loop interval in ms — the honest stand-in
   *  for a CPU badge: it shows whether the loop is keeping its 100 ms tick. */
  loopMs: number;
};

type Track = {
  samples: Sample[];
  clips: number[];
  limits: number[];
  lastT: number;
  prevClip: boolean;
  prevLim: boolean;
  dropouts: number;
  underruns: number;
  loopMs: number;
};

const MEANINGFUL = (v: number) => Number.isFinite(v);

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function useTelemetry(opts: {
  cfg: ProcessorConfig;
  running: boolean;
  presetKey: PresetKey;
  target: number;
  ceiling: number;
  window: TimeWindow;
  /** 1 = dry (DSP bypassed / slewing), 0 = fully processed */
  dry: number;
  /** level-match trim applied on preset switch */
  trimDb: number;
}): Telemetry {
  const { cfg, running, target, ceiling, window, dry, trimDb } = opts;
  useTick(100);

  const t = performance.now() / 1000;
  const track = useRef<Track>({
    samples: [],
    clips: [],
    limits: [],
    lastT: 0,
    prevClip: false,
    prevLim: false,
    dropouts: 0,
    underruns: 0,
    loopMs: 0,
  });
  const st = track.current;

  /* ---- delivery-loop health: real gap detection, never invented ---- */
  const visible = typeof document === "undefined" || document.visibilityState === "visible";
  if (st.lastT && visible) {
    const dt = t - st.lastT;
    st.loopMs = st.loopMs ? st.loopMs * 0.8 + dt * 0.2 : dt;
    if (dt >= 5) st.dropouts += 1;
    else if (dt > 0.35) st.underruns += 1;
  }
  st.lastT = t;

  /* ---- input stage -------------------------------------------------- */
  const inputRaw = running ? programLevel(t, 0) : -60;
  const peak = running ? peakModel(t) : -60;

  /* AGC: gain toward the measured program mean, bounded by the configured
     slow + fast range. Negative values are reduction (shown as GR). */
  const history = st.samples.filter((s) => t - s.t <= 60).map((s) => s.input);
  const ref = history.length ? mean(history) : inputRaw;
  const maxAgc = cfg.input.slowGain + cfg.input.fastGain;
  const agcApplied = running ? clamp(ref - inputRaw, -maxAgc, maxAgc) : 0;
  const agcGr = Math.max(0, -agcApplied);

  /* Sensus band bank: identical formula to the BandActivity canvas. */
  const thresholds = cfg.sensus.bands.map((b) => b.threshold);
  const bandGr = cfg.sensus.bands.map((_, i) =>
    running ? bandGainReduction(i, t, cfg.sensus.mode, thresholds) : 0,
  );
  const mb3Gr = mean(bandGr);

  /* Clipper: program driven by cfg.fm.mainClip dB into a 0 dBFS clip point. */
  const clipGr = running ? Math.max(0, peak + cfg.fm.mainClip) : 0;
  /* Limiter / true-peak stage: removes whatever exceeds the ceiling. */
  const limitGr = running ? Math.max(0, peak - ceiling) : 0;

  const makeup = makeupDb(cfg);
  const grDb = agcGr + mb3Gr + clipGr + limitGr;
  const processedDb = clamp(
    inputRaw + agcApplied + makeup - mb3Gr - clipGr - limitGr,
    -60,
    0.5,
  );
  const outputDb = clamp(
    processedDb * (1 - dry) + inputRaw * dry + trimDb,
    -60,
    0.5,
  );

  /* ---- loudness ----------------------------------------------------- */
  const baseLoudness = running ? loudness(t, target) : target - 60;
  const momentary = clamp(baseLoudness + dry * (inputRaw - processedDb), -70, -3);

  /* ---- true peak / status ------------------------------------------ */
  const truePeakDb = running ? truePeak(t, ceiling) : -70;
  const tpStatus: Telemetry["tpStatus"] =
    !running || truePeakDb < ceiling
      ? "SAFE"
      : truePeakDb <= ceiling + 0.2
        ? "WARNING"
        : "ERROR";

  /* ---- event counters: rising edges only --------------------------- */
  const clipNow = clipGr > 0.25;
  if (clipNow && !st.prevClip) st.clips.push(t);
  st.prevClip = clipNow;
  const limNow = limitGr > 0.1;
  if (limNow && !st.prevLim) st.limits.push(t);
  st.prevLim = limNow;

  /* ---- sample buffer (windowed statistics) ------------------------- */
  st.samples.push({ t, m: momentary, input: inputRaw, agcGr, mb3: bandGr, clipGr, limitGr });
  const horizon = window === "session" ? Number.POSITIVE_INFINITY : WINDOWS.find((w) => w.value === window)!.seconds;
  while (st.samples.length && t - st.samples[0].t > Math.min(horizon, 1800)) st.samples.shift();
  while (st.clips.length && t - st.clips[0] > 3600) st.clips.shift();
  while (st.limits.length && t - st.limits[0] > 3600) st.limits.shift();

  const win = st.samples.filter((s) => t - s.t <= horizon);
  const fast = st.samples.slice(-30);
  const mValues = win.map((s) => s.m).filter(MEANINGFUL).sort((a, b) => a - b);

  const shortTerm = mean(fast.map((s) => s.m));
  const mu = mValues.length ? mean(mValues) : 0;
  // EBU R128 style relative gate: mean of samples 10 LU above the floor.
  const gated = mValues.filter((v) => v > mu - 10);
  const integrated = gated.length ? mean(gated) : mu;
  const lra = mValues.length > 4 ? quantile(mValues, 0.95) - quantile(mValues, 0.1) : 0;

  const group = (idx: number[]): GrStat => {
    let now = 0;
    let peak = 0;
    for (const s of win) {
      const v = mean(idx.map((i) => s.mb3[i] ?? 0));
      if (v > peak) peak = v;
    }
    now = mean(idx.map((i) => bandGr[i] ?? 0));
    return { now, peak };
  };

  const count = (list: number[]) => list.filter((ts) => t - ts <= horizon).length;

  const latencyMs = (cfg.sensus.blockSize / ENGINE.sampleRate) * 1000 * 2;

  return {
    t,
    inputDb: inputRaw,
    processedDb,
    outputDb,
    grDb,
    agcGr,
    mb3Gr,
    clipGr,
    limitGr,
    bandGr,
    mb3: { low: group([0, 1]), mid: group([2, 3]), high: group([4, 5]) },
    momentary,
    shortTerm,
    integrated,
    lra,
    truePeakDb,
    tpStatus,
    counters: {
      clip: count(st.clips),
      limiter: count(st.limits),
      dropout: st.dropouts,
      underrun: st.underruns,
    },
    latencyMs,
    sampleRate: ENGINE.sampleRate,
    channels: ENGINE.channels,
    bufferSmp: cfg.sensus.blockSize,
    modPct: clamp(Math.pow(10, inputRaw / 20) * 100, 0, 100),
    loopMs: st.loopMs,
  };
}
