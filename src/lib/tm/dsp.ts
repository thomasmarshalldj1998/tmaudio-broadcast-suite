/**
 * TMAUDIO — shared DSP constants and helpers.
 *
 * Everything here is plain, human-readable math. No black boxes: the mask
 * table is the stepped spectrum mask used to police the FM multiplex, and the
 * band table is the fixed 6-way linear-phase Sensus crossover.
 */

export const ACCENT = "#F5A524";
export const PATH_COLORS = {
  fm: "#F5A524",
  dab: "#35C8D8",
  web: "#8B7CF6",
  hd: "#4ADE80",
} as const;

export type BandDef = {
  index: number;
  name: string;
  range: string;
  low: number;
  high: number;
  color: string;
};

/** Sensus 6-band linear-phase crossover (Hz). Crossovers are Linkwitz-Riley
 *  order-8 in the prototype design, applied with zero-phase FFT convolution. */
export const BANDS: BandDef[] = [
  { index: 0, name: "Bass", range: "< 80 Hz", low: 20, high: 80, color: "#B45309" },
  { index: 1, name: "Low-mid", range: "80 – 300 Hz", low: 80, high: 300, color: "#D97706" },
  { index: 2, name: "Mid", range: "300 Hz – 1 kHz", low: 300, high: 1000, color: "#F59E0B" },
  { index: 3, name: "Presence", range: "1 – 3.5 kHz", low: 1000, high: 3500, color: "#FBBF24" },
  { index: 4, name: "High-mid", range: "3.5 – 7 kHz", low: 3500, high: 7000, color: "#FCD34D" },
  { index: 5, name: "Detail", range: "7 – 12 kHz", low: 7000, high: 12000, color: "#FDE68A" },
];

export type MaskPoint = { f: number; db: number };

/**
 * ITU-R SM.1268 multiplex spectrum mask, expressed in dB relative to 100 %
 * modulation (75 kHz deviation). Values follow the Annex-1 simple spectrum
 * mask method used at monitoring sites, with the pilot, L±R and RDS regions
 * modelled as their regulatory ceilings.
 */
export const SM1268_MASK: MaskPoint[] = [
  { f: 0, db: 0 },
  { f: 15000, db: 0 },
  { f: 15001, db: -45 },
  { f: 18000, db: -45 },
  { f: 18950, db: -45 },
  { f: 19000, db: -21.1 },
  { f: 19050, db: -21.1 },
  { f: 19100, db: -45 },
  { f: 22900, db: -45 },
  { f: 23000, db: -0.9 },
  { f: 53000, db: -0.9 },
  { f: 53100, db: -45 },
  { f: 54550, db: -45 },
  { f: 54600, db: -31.5 },
  { f: 59400, db: -31.5 },
  { f: 59500, db: -45 },
  { f: 75000, db: -55 },
  { f: 100000, db: -60 },
];

/** Mask ceiling (dB) at an arbitrary multiplex frequency. */
export function maskAt(freq: number): number {
  const pts = SM1268_MASK;
  if (freq <= pts[0].f) return pts[0].db;
  const last = pts[pts.length - 1];
  if (freq >= last.f) return last.db;
  for (let i = 1; i < pts.length; i++) {
    if (freq <= pts[i].f) {
      const a = pts[i - 1];
      const b = pts[i];
      if (b.f === a.f) return b.db;
      const t = (freq - a.f) / (b.f - a.f);
      return a.db + t * (b.db - a.db);
    }
  }
  return last.db;
}

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const dbToAmp = (db: number) => Math.pow(10, db / 20);

export const ampToDb = (a: number) => 20 * Math.log10(Math.max(a, 1e-9));

/** Format a number with a fixed count of decimals, always the same width so
 *  tabular readouts never jitter. */
export function fixed(v: number, digits = 1): string {
  const s = v.toFixed(digits);
  return s === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : s;
}

export function signed(v: number, digits = 1, unit = ""): string {
  const s = v > 0 ? `+${v.toFixed(digits)}` : v.toFixed(digits);
  return `${s}${unit}`;
}

export function hex(v: number, digits: number): string {
  return v.toString(16).toUpperCase().padStart(digits, "0");
}

/** Deterministic-ish smooth pseudo noise, enough to make analyzers breathe. */
export function wobble(t: number, seed: number): number {
  return (
    Math.sin(t * 1.7 + seed) * 0.5 +
    Math.sin(t * 3.9 + seed * 2.3) * 0.3 +
    Math.sin(t * 8.3 + seed * 5.1) * 0.2
  );
}
