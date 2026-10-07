/**
 * TMAUDIO — Factory preset library (v1.0 Standalone Edition).
 *
 * Thirty-one broadcast-optimised presets in the naming convention used by
 * top-tier processors. Every preset is a *complete* processor configuration:
 * input repair, dual-loop AGC, all six Sensus bands (threshold / ratio /
 * attack / hold / release / gain / width), imaging, the path-specific
 * limiter + clipper, loudness targets and output levels.
 *
 * Presets are plain patches over the base, serialised to the same readable
 * dotted decimal format as the rest of the config — no binaries, no
 * encryption, no obfuscation.
 */

import {
  BASE_CONFIG,
  baseBands,
  mergeConfig,
  type BandCfg,
  type PresetKey,
  type ProcessorConfig,
} from "./presets";

export type FactoryCategory =
  | "fm50"
  | "fm75"
  | "dab"
  | "web"
  | "hd"
  | "general";

export type FactoryPreset = {
  id: string;
  name: string;
  category: FactoryCategory;
  chain: PresetKey;
  note: string;
  config: ProcessorConfig;
};

export const FACTORY_CATEGORIES: {
  key: FactoryCategory;
  label: string;
  chain: PresetKey;
  blurb: string;
}[] = [
  { key: "fm50", label: "FM 50 µs · EU", chain: "fm", blurb: "European pre-emphasis, SM.1268 policing" },
  { key: "fm75", label: "FM 75 µs · US", chain: "fm", blurb: "North American pre-emphasis curve" },
  { key: "dab", label: "DAB+", chain: "dab", blurb: "R128 −23 LUFS, BS.1770 true peak" },
  { key: "web", label: "Web Radio", chain: "web", blurb: "Codec-matched, 128 kbps sweet spot" },
  { key: "hd", label: "HD Radio", chain: "hd", blurb: "NRSC-5 hybrid + HDC+ shaping" },
  { key: "general", label: "General purpose", chain: "fm", blurb: "Universal, gentle and live" },
];

/** Per-band overrides indexed by band number. */
const bands = (over: Record<number, Partial<BandCfg>>): BandCfg[] =>
  baseBands().map((b, i) => ({ ...b, ...(over[i] ?? {}) }));

/** Shift every band's threshold / gain together. */
const tilt = (thresholdDb: number, gainDb: number, ratioAdd = 0): BandCfg[] =>
  baseBands().map((b) => ({
    ...b,
    threshold: b.threshold + thresholdDb,
    gain: b.gain + gainDb,
    ratio: b.ratio + ratioAdd,
  }));

const make = (
  id: string,
  name: string,
  category: FactoryCategory,
  chain: PresetKey,
  note: string,
  patch: Parameters<typeof mergeConfig>[1],
): FactoryPreset => ({
  id,
  name,
  category,
  chain,
  note,
  config: mergeConfig(BASE_CONFIG, patch),
});

export const FACTORY_PRESETS: FactoryPreset[] = [
  /* ------------------------------------------------------------------ *
   * FM — 50 µs (EU)
   * ------------------------------------------------------------------ */
  make(
    "fm50-balanced",
    "FM 50µs — Balanced",
    "fm50",
    "fm",
    "Reference voicing: even density, neutral tonality, conservative drive.",
    {
      sensus: { bands: tilt(0, 0) },
      fm: { emphasis: 50, mainClip: 5.5, bassClip: 3, pilot: 9, rdsInjection: 4 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm50-bright",
    "FM 50µs — Bright",
    "fm50",
    "fm",
    "Open top end for acoustically dead studios; HF drive without clip grit.",
    {
      sensus: {
        bands: bands({
          3: { threshold: -13, ratio: 3, gain: 1.5 },
          4: { threshold: -13, ratio: 3.5, gain: 2.5 },
          5: { threshold: -12, ratio: 4, gain: 3.5, release: 120 },
        }),
      },
      fm: { emphasis: 50, mainClip: 6, bassClip: 2.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm50-high-density",
    "FM 50µs — High Density",
    "fm50",
    "fm",
    "Maximum average level for competitive rock/ECHR formats, mask-compliant.",
    {
      input: { slowAgcMs: 300, slowReleaseMs: 1200, slowGain: 8 },
      sensus: { agcWindowMs: 260, bands: tilt(-3, 0.5, 1) },
      fm: { emphasis: 50, mainClip: 8, bassClip: 4, oversample: 16, maskEnforce: true },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm50-music-drive",
    "FM 50µs — Music Drive",
    "fm50",
    "fm",
    "Wide, punchy and loud for hot AC, dance and CHR music libraries.",
    {
      input: { fastAgcMs: 8, fastHoldMs: 55, fastReleaseMs: 90 },
      sensus: {
        mode: "transient",
        bands: bands({
          0: { threshold: -26, ratio: 4, attack: 6, gain: 2.5 },
          1: { threshold: -21, ratio: 3, gain: 1.5 },
          5: { threshold: -13, ratio: 4, gain: 2 },
        }),
      },
      imaging: { coherence: 94, haasMs: 13 },
      fm: { emphasis: 50, mainClip: 7, bassClip: 4.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm50-speech-news",
    "FM 50µs — Speech & News",
    "fm50",
    "fm",
    "Dialogue-first: gentle presence lift, wide AGC window, no pumping.",
    {
      input: { speechDetect: true, slowAgcMs: 380, slowReleaseMs: 1500, fastAgcMs: 18 },
      sensus: {
        mode: "speech",
        agcWindowMs: 380,
        bands: bands({
          2: { threshold: -18, ratio: 2.5, attack: 10, release: 200, gain: 1.5 },
          3: { threshold: -15, ratio: 2.5, attack: 8, release: 180, gain: 2 },
          4: { threshold: -16, ratio: 2.5, release: 160, gain: 1 },
          5: { threshold: -18, ratio: 2, release: 140, gain: -1 },
        }),
      },
      imaging: { coherence: 100, haas: false, monoSafe: true },
      fm: { emphasis: 50, mainClip: 5, bassClip: 2.5 },
      rds: { enabled: true, ct: true, ta: true, injection: 4 },
    },
  ),
  make(
    "fm50-classic-warm",
    "FM 50µs — Classic Warm",
    "fm50",
    "fm",
    "Old-school weight: controlled bass, softened presence, smooth HF.",
    {
      sensus: {
        bands: bands({
          0: { threshold: -25, ratio: 3.5, attack: 14, release: 220, gain: 2 },
          1: { threshold: -20, ratio: 3, gain: 2 },
          2: { threshold: -17, ratio: 3, gain: 1 },
          3: { threshold: -16, ratio: 3, gain: -1 },
          4: { threshold: -14, ratio: 3.5, gain: -1.5 },
          5: { threshold: -13, ratio: 4, gain: -2 },
        }),
      },
      fm: { emphasis: 50, mainClip: 5, bassClip: 3.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm50-ultra-clean",
    "FM 50µs — Ultra Clean",
    "fm50",
    "fm",
    "Audiophile/classical: minimal clipping, wide dynamics, pristine MPX.",
    {
      input: { declip: 70, dequant: 45, noiseReduction: 8, humReduction: 80 },
      sensus: {
        agcWindowMs: 420,
        bands: tilt(4, -0.5),
      },
      imaging: { coherence: 98, haasMs: 8 },
      fm: { emphasis: 50, mainClip: 3, bassClip: 1.5, oversample: 16, maskEnforce: true },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm50-max-loudness",
    "FM 50µs — Maximum Loudness",
    "fm50",
    "fm",
    "Maximum permitted modulation: full clip drive with mask enforcement on.",
    {
      input: { slowAgcMs: 320, slowGain: 9, fastGain: 4 },
      sensus: { agcWindowMs: 200, bands: tilt(-5, 1, 1.5) },
      imaging: { coherence: 92 },
      fm: {
        emphasis: 50,
        mainClip: 10,
        bassClip: 5.5,
        oversample: 16,
        maskEnforce: true,
        pilot: 9,
      },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),

  /* ------------------------------------------------------------------ *
   * FM — 75 µs (US)
   * ------------------------------------------------------------------ */
  make(
    "fm75-balanced",
    "FM 75µs — Balanced",
    "fm75",
    "fm",
    "US reference voicing with 75 µs applied ahead of the limiter.",
    {
      sensus: { bands: tilt(0, 0) },
      fm: { emphasis: 75, mainClip: 5.5, bassClip: 3, maskEnforce: true },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm75-bright",
    "FM 75µs — Bright",
    "fm75",
    "fm",
    "Air and sparkle for FM formats; HF controlled before it reaches clip.",
    {
      sensus: {
        bands: bands({
          3: { threshold: -13, gain: 1.5 },
          4: { threshold: -13, gain: 2.5 },
          5: { threshold: -12, gain: 3.5 },
        }),
      },
      fm: { emphasis: 75, mainClip: 6, bassClip: 2.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm75-high-density",
    "FM 75µs — High Density",
    "fm75",
    "fm",
    "High-average-level US CHR/rock voicing, NRSC-friendly spectral shape.",
    {
      input: { slowAgcMs: 300, slowReleaseMs: 1200, slowGain: 8 },
      sensus: { agcWindowMs: 250, bands: tilt(-3, 0.5, 1) },
      fm: { emphasis: 75, mainClip: 8, bassClip: 4, oversample: 16 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm75-music-drive",
    "FM 75µs — Music Drive",
    "fm75",
    "fm",
    "Punch-forward US music preset with aggressive bass stage handling.",
    {
      input: { fastAgcMs: 8, fastHoldMs: 60, fastReleaseMs: 85 },
      sensus: {
        mode: "transient",
        bands: bands({
          0: { threshold: -26, ratio: 4, attack: 6, gain: 2.5 },
          5: { threshold: -13, gain: 2 },
        }),
      },
      imaging: { coherence: 94, haasMs: 13 },
      fm: { emphasis: 75, mainClip: 7, bassClip: 4.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm75-speech-news",
    "FM 75µs — Speech & News",
    "fm75",
    "fm",
    "Talk radio and news: intelligibility first, loudness second.",
    {
      input: { speechDetect: true, slowAgcMs: 380, slowReleaseMs: 1600, fastAgcMs: 18 },
      sensus: {
        mode: "speech",
        agcWindowMs: 400,
        bands: bands({
          2: { threshold: -18, ratio: 2.5, attack: 10, release: 210, gain: 1.5 },
          3: { threshold: -15, ratio: 2.5, attack: 8, release: 180, gain: 2 },
          5: { threshold: -18, ratio: 2, gain: -1 },
        }),
      },
      imaging: { coherence: 100, haas: false, monoSafe: true },
      fm: { emphasis: 75, mainClip: 5, bassClip: 2.5 },
      rds: { enabled: true, ct: true, ta: true, injection: 4 },
    },
  ),
  make(
    "fm75-classic-warm",
    "FM 75µs — Classic Warm",
    "fm75",
    "fm",
    "Warm, rounded US oldies/nostalgia voicing with controlled HF.",
    {
      sensus: {
        bands: bands({
          0: { threshold: -25, ratio: 3.5, attack: 14, release: 220, gain: 2 },
          1: { threshold: -20, gain: 2 },
          3: { gain: -1 },
          4: { gain: -1.5 },
          5: { gain: -2.5 },
        }),
      },
      fm: { emphasis: 75, mainClip: 5, bassClip: 3.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm75-ultra-clean",
    "FM 75µs — Ultra Clean",
    "fm75",
    "fm",
    "Low-drive US audiophile preset; clip stage barely working.",
    {
      input: { declip: 70, dequant: 45, noiseReduction: 8 },
      sensus: { agcWindowMs: 420, bands: tilt(4, -0.5) },
      imaging: { coherence: 98, haasMs: 8 },
      fm: { emphasis: 75, mainClip: 3, bassClip: 1.5, oversample: 16 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "fm75-max-loudness",
    "FM 75µs — Maximum Loudness",
    "fm75",
    "fm",
    "Maximum permitted US modulation with full mask enforcement.",
    {
      input: { slowAgcMs: 320, slowGain: 9, fastGain: 4 },
      sensus: { agcWindowMs: 200, bands: tilt(-5, 1, 1.5) },
      imaging: { coherence: 92 },
      fm: { emphasis: 75, mainClip: 10, bassClip: 5.5, oversample: 16, maskEnforce: true },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),

  /* ------------------------------------------------------------------ *
   * DAB+
   * ------------------------------------------------------------------ */
  make(
    "dab-standard",
    "DAB+ Standard",
    "dab",
    "dab",
    "EBU R128 −23 LUFS / −1.0 dBTP, 20 kHz for xHE-AAC at 96 kbps.",
    {
      dab: { bandwidthKhz: 20, loudness: -23, truePeak: -1, codec: "xHE-AAC", bitrate: 96, preShaping: true },
      sensus: { agcWindowMs: 320, bands: tilt(2, 0) },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "dab-enhanced-clarity",
    "DAB+ Enhanced Clarity",
    "dab",
    "dab",
    "Detail-forward voicing for jewel-box radios and speech-heavy muxes.",
    {
      dab: { bandwidthKhz: 20, loudness: -23, truePeak: -1, codec: "xHE-AAC", bitrate: 128, preShaping: true },
      sensus: {
        bands: bands({
          3: { threshold: -14, gain: 1.5 },
          4: { threshold: -13, gain: 2 },
          5: { threshold: -12, gain: 2.5 },
        }),
      },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "dab-speech-news",
    "DAB+ Speech & News",
    "dab",
    "dab",
    "Talk/podcast multiplex: gentle compression, widened AGC, no HF bite.",
    {
      dab: { bandwidthKhz: 16, loudness: -23, truePeak: -1, codec: "HE-AACv2", bitrate: 64, preShaping: true },
      input: { speechDetect: true, slowAgcMs: 360, slowReleaseMs: 1600 },
      sensus: {
        mode: "speech",
        agcWindowMs: 400,
        bands: bands({
          2: { threshold: -18, ratio: 2.5, release: 220, gain: 1.5 },
          3: { threshold: -15, ratio: 2.5, release: 190, gain: 2 },
          5: { threshold: -18, ratio: 2, gain: -1.5 },
        }),
      },
      imaging: { coherence: 100, haas: false },
      rds: { enabled: true, ct: true, ta: true, injection: 4 },
    },
  ),
  make(
    "dab-music-focus",
    "DAB+ Music Focus",
    "dab",
    "dab",
    "Wide stereo image and punch for music-led DAB services at 128 kbps.",
    {
      dab: { bandwidthKhz: 20, loudness: -23, truePeak: -1, codec: "xHE-AAC", bitrate: 128, preShaping: true },
      input: { fastAgcMs: 9, fastHoldMs: 50 },
      sensus: {
        mode: "transient",
        bands: bands({ 0: { threshold: -26, ratio: 4, gain: 2.5 }, 5: { gain: 2 } }),
      },
      imaging: { coherence: 95, haasMs: 14 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),

  /* ------------------------------------------------------------------ *
   * Web radio
   * ------------------------------------------------------------------ */
  make(
    "web-128-aac",
    "Web 128 kbps AAC",
    "web",
    "web",
    "Reference streaming voicing: 16 kHz, −15 LUFS, TNS pre-emphasis.",
    {
      web: { bandwidthKhz: 16, loudness: -15, truePeak: -1, tilt: 3, tns: 4, format: "AAC", bitrate: 128 },
      rds: { enabled: false },
    },
  ),
  make(
    "web-96-aac",
    "Web 96 kbps AAC",
    "web",
    "web",
    "Bandwidth-hungry codec: gentler top end, stronger masking tilt.",
    {
      web: { bandwidthKhz: 15, loudness: -15, truePeak: -1, tilt: 4, tns: 5, format: "AAC", bitrate: 96 },
      sensus: { bands: bands({ 5: { threshold: -15, gain: -1.5 } }) },
      rds: { enabled: false },
    },
  ),
  make(
    "web-192-mp3",
    "Web 192 kbps MP3",
    "web",
    "web",
    "Generous bitrate: full bandwidth, musical dynamics, −14 LUFS.",
    {
      web: { bandwidthKhz: 18, loudness: -14, truePeak: -1, tilt: 1.5, tns: 2, format: "MP3", bitrate: 192 },
      sensus: { agcWindowMs: 340 },
      rds: { enabled: false },
    },
  ),
  make(
    "web-speech-optimised",
    "Web Speech Optimised",
    "web",
    "web",
    "Podcast/talk stream: narrow bandwidth, wide AGC, −16 LUFS.",
    {
      web: { bandwidthKhz: 14, loudness: -16, truePeak: -1, tilt: 2, tns: 3, format: "AAC", bitrate: 96 },
      input: { speechDetect: true, slowAgcMs: 400, slowReleaseMs: 1800, fastAgcMs: 20 },
      sensus: {
        mode: "speech",
        agcWindowMs: 440,
        bands: bands({
          2: { threshold: -18, ratio: 2.5, release: 230, gain: 1.5 },
          3: { threshold: -15, ratio: 2.5, release: 200, gain: 2.5 },
          5: { threshold: -19, ratio: 2, gain: -2 },
        }),
      },
      imaging: { coherence: 100, haas: false },
      rds: { enabled: false },
    },
  ),
  make(
    "web-warm-music",
    "Web Warm Music",
    "web",
    "web",
    "Cozy music stream for jazz/soul channels; soft top, firm low-mid.",
    {
      web: { bandwidthKhz: 16, loudness: -15, truePeak: -1, tilt: 3.5, tns: 3, format: "AAC", bitrate: 128 },
      sensus: {
        bands: bands({
          0: { threshold: -25, ratio: 3.5, gain: 2 },
          1: { threshold: -20, gain: 1.5 },
          4: { gain: -1 },
          5: { gain: -2 },
        }),
      },
      rds: { enabled: false },
    },
  ),

  /* ------------------------------------------------------------------ *
   * HD Radio
   * ------------------------------------------------------------------ */
  make(
    "hd-hybrid-balanced",
    "HD Hybrid Balanced",
    "hd",
    "hd",
    "Matched analog/digital coverage zones, NRSC-5 mask held.",
    {
      hd: { bandwidthKhz: 15, hybridGain: -1.5, analogRef: -8, digitalRef: -6, hdcPreShaping: true, nrsc: true },
      fm: { emphasis: 75, mainClip: 5.5, maskEnforce: true },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "hd-digital-first",
    "HD Digital First",
    "hd",
    "hd",
    "Optimised for HD-only listeners: full 20 kHz, digital carrier leads.",
    {
      hd: { bandwidthKhz: 20, hybridGain: 1.5, analogRef: -10, digitalRef: -5, hdcPreShaping: true, nrsc: true },
      fm: { emphasis: 75, mainClip: 4.5 },
      sensus: { bands: bands({ 5: { threshold: -12, gain: 2 } }) },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "hd-analogue-compatible",
    "HD Analogue Compatible",
    "hd",
    "hd",
    "Analog-leaning voicing that still satisfies the digital mask.",
    {
      hd: { bandwidthKhz: 15, hybridGain: -3, analogRef: -6, digitalRef: -8, hdcPreShaping: true, nrsc: true },
      fm: { emphasis: 75, mainClip: 6, bassClip: 3.5 },
      sensus: { bands: tilt(-1, 0.5) },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),

  /* ------------------------------------------------------------------ *
   * General purpose
   * ------------------------------------------------------------------ */
  make(
    "general-universal",
    "Universal Broadcast",
    "general",
    "fm",
    "One preset for any target: safe thresholds, honest dynamics.",
    {
      sensus: { agcWindowMs: 300, bands: tilt(0, 0) },
      fm: { emphasis: 50, mainClip: 5.5, maskEnforce: true },
      dab: { loudness: -23, truePeak: -1 },
      web: { loudness: -15, truePeak: -1 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "general-gentle",
    "Gentle Processing",
    "general",
    "fm",
    "Long-term level help only — for orchestral and high-dynamic sources.",
    {
      input: { slowAgcMs: 450, slowReleaseMs: 2000, fastAgcMs: 25, slowGain: 3, fastGain: 1 },
      sensus: { agcWindowMs: 520, bands: tilt(8, -1) },
      imaging: { coherence: 99, haasMs: 6 },
      fm: { emphasis: 50, mainClip: 3, bassClip: 1.5 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
  make(
    "general-live-low-latency",
    "Live Low Latency",
    "general",
    "fm",
    "Studio-to-transmitter live path: short lookahead, tight hold, fast return.",
    {
      input: {
        slowAgcMs: 150,
        slowReleaseMs: 400,
        fastAgcMs: 5,
        fastHoldMs: 20,
        fastReleaseMs: 50,
        slowGain: 4,
        fastGain: 2,
      },
      sensus: {
        blockSize: 32,
        centroidSmoothMs: 8,
        agcWindowMs: 80,
        bands: baseBands().map((b) => ({
          ...b,
          attack: Math.max(1, b.attack * 0.35),
          hold: Math.min(60, b.hold * 0.4),
          release: Math.max(30, b.release * 0.35),
        })),
      },
      imaging: { haas: false, coherence: 100 },
      fm: { emphasis: 50, mainClip: 4.5, bassClip: 2.5, oversample: 8 },
      rds: { enabled: true, ct: true, injection: 4 },
    },
  ),
];

export function factoryPresetsFor(category: FactoryCategory): FactoryPreset[] {
  return FACTORY_PRESETS.filter((p) => p.category === category);
}

export function findFactoryPreset(id: string): FactoryPreset | undefined {
  return FACTORY_PRESETS.find((p) => p.id === id);
}
