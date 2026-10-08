import type { BandCfg, ProcessorConfig } from "./presets";

/* ------------------------------------------------------------------ *
 * TMAUDIO MASTER — five characters that coordinate the *existing*
 * parameters only (AGC range, Sensus thresholds/ratios/gains, imaging
 * coherence, clip drive, station extras). No extra compressor, limiter
 * or multiband is created: every value written here is owned by a
 * control that already exists elsewhere in the console.
 * ------------------------------------------------------------------ */

export type MasterKey = "clean" | "balanced" | "forward" | "power" | "max";

export const MASTER_LEVELS: {
  key: MasterKey;
  label: string;
  blurb: string;
}[] = [
  { key: "clean", label: "Clean", blurb: "Transparent — linear response, no added density" },
  { key: "balanced", label: "Balanced", blurb: "Normal broadcast — controlled, open, honest" },
  { key: "forward", label: "Forward", blurb: "More presence — speech and detail pushed forward" },
  { key: "power", label: "Power", blurb: "Competitive CHR — dense, forward, loud" },
  { key: "max", label: "MAX", blurb: "Maximum controlled loudness — clipper-led drive" },
];

export type Profile = {
  slowGain: number;
  fastGain: number;
  thr: number[];
  ratio: number[];
  gain: number[];
  coherence: number;
  transient: number;
  dynEq: number;
  phatBass: number;
  clip: number;
};

const PROFILES: Record<MasterKey, Profile> = {
  clean: {
    slowGain: 2,
    fastGain: 1,
    thr: [-22, -18, -16, -14, -13, -12],
    ratio: [2.4, 2, 2.4, 2.8, 3.2, 3.6],
    gain: [0, 0, 0, 0, 0, 0],
    coherence: 96,
    transient: 0,
    dynEq: 0,
    phatBass: 0,
    clip: 1,
  },
  balanced: {
    slowGain: 4,
    fastGain: 2,
    thr: [-24, -20, -17, -15, -14, -13],
    ratio: [3, 2.5, 3, 3.5, 4, 4.5],
    gain: [1.5, 1, 0.5, 0, 0, -0.5],
    coherence: 94,
    transient: 1.5,
    dynEq: 30,
    phatBass: 25,
    clip: 3.5,
  },
  forward: {
    slowGain: 6,
    fastGain: 3,
    thr: [-24, -21, -18, -17, -16, -15],
    ratio: [3, 2.6, 3.2, 4, 4.6, 5],
    gain: [1, 0.5, 1, 2, 2, 1.5],
    coherence: 92,
    transient: 3,
    dynEq: 55,
    phatBass: 20,
    clip: 5,
  },
  power: {
    slowGain: 9,
    fastGain: 5,
    thr: [-26, -23, -20, -18, -17, -16],
    ratio: [4, 3.5, 4, 4.5, 5, 5.5],
    gain: [3, 2.5, 2, 1.5, 1, 0],
    coherence: 90,
    transient: 4.5,
    dynEq: 70,
    phatBass: 45,
    clip: 7.5,
  },
  max: {
    slowGain: 13,
    fastGain: 8,
    thr: [-30, -27, -24, -22, -21, -20],
    ratio: [5, 4.5, 5, 5.5, 6, 6.5],
    gain: [4, 3.5, 3, 2, 1.5, 1],
    coherence: 88,
    transient: 6,
    dynEq: 85,
    phatBass: 70,
    clip: 10,
  },
};

/** Read-only view of a character's scalar targets. */
export function masterProfile(level: MasterKey): Profile {
  return PROFILES[level];
}

/** Retune the existing band cards for a character. Threshold, ratio and
 *  gain are the character's values; attack, hold, release and width are
 *  the operator's and are preserved untouched. */
export function masterBands(level: MasterKey, current: BandCfg[]): BandCfg[] {
  const p = PROFILES[level];
  return current.map((b, i) => ({
    ...b,
    threshold: p.thr[i],
    ratio: p.ratio[i],
    gain: p.gain[i],
  }));
}

/** Fields that must snap (not interpolate) during a morph. */
const SNAP = new Set(["emphasis", "oversample", "blockSize", "mode"]);

function lerp(a: number, b: number, p: number) {
  return a + (b - a) * p;
}

function lerpAny(a: unknown, b: unknown, p: number, key: string): unknown {
  if (typeof a === "number" && typeof b === "number") {
    return SNAP.has(key) ? (p < 0.5 ? a : b) : lerp(a, b, p);
  }
  if (typeof a === "boolean" && typeof b === "boolean") return p < 0.5 ? a : b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((v, i) => lerpAny(v, b[i], p, key));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(a as Record<string, unknown>)) {
      out[k] = lerpAny(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        p,
        k,
      );
    }
    return out;
  }
  return p < 0.5 ? a : b;
}

/** Morph between two slots. Numeric processing parameters interpolate;
 *  enums, strings and booleans snap, so no invalid value is produced. */
export function morphConfig(a: ProcessorConfig, b: ProcessorConfig, p: number): ProcessorConfig {
  return lerpAny(a, b, clamp01(p), "root") as ProcessorConfig;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Program gain of a slot — what a level-match trim has to compensate. */
export function slotGain(cfg: ProcessorConfig): number {
  return cfg.sensus.bands.reduce((s, x) => s + x.gain, 0) / cfg.sensus.bands.length;
}
