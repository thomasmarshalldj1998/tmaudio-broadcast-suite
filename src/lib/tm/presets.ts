/**
 * TMAUDIO — processor configuration model.
 *
 * One flat, serialisable object drives the whole console. Presets are plain
 * patches over the base: no binaries, no obfuscation, every value is a decimal
 * you can read, diff and paste back in.
 */

import { BANDS } from "./dsp";

export type BandCfg = {
  threshold: number; // dBFS
  attack: number; // ms
  hold: number; // ms
  release: number; // ms
  gain: number; // dB
  width: number; // % of original side level
};

export type InputCfg = {
  slowAgcMs: number;
  fastAgcMs: number;
  slowGain: number;
  fastGain: number;
  declip: number; // %
  dequant: number; // %
  humReduction: number; // %
  noiseReduction: number; // dB
  dcBlock: boolean;
  speechDetect: boolean;
  gate: number; // dBFS
};

export type SensusCfg = {
  mode: "auto" | "transient" | "music" | "speech";
  blockSize: 32 | 64;
  centroidSmoothMs: number;
  agcWindowMs: number;
  bands: BandCfg[];
};

export type ImagingCfg = {
  haasMs: number;
  haas: boolean;
  monoSafe: boolean;
  sideChainHp: number;
  coherence: number; // % target
};

export type FmCfg = {
  emphasis: 50 | 75;
  lpfKhz: number;
  bassClip: number; // dB drive
  mainClip: number; // dB drive
  oversample: 8 | 16;
  pilot: number; // % modulation
  subcarrier: number; // % modulation
  rdsInjection: number; // % of total deviation
  maskEnforce: boolean;
  outputRate: number; // Hz
  rtpPort: number;
  rtpHost: string;
};

export type DabCfg = {
  bandwidthKhz: number;
  truePeak: number; // dBTP
  loudness: number; // LUFS
  codec: "xHE-AAC" | "HE-AACv2" | "AAC-LC";
  bitrate: number; // kbps
  preShaping: boolean;
};

export type WebCfg = {
  bandwidthKhz: number;
  loudness: number;
  truePeak: number;
  tilt: number; // dB spectral tilt match
  tns: number; // dB temporal noise shaping
  format: "AAC" | "MP3" | "Ogg";
  bitrate: number;
  mount: string;
};

export type HdCfg = {
  bandwidthKhz: number;
  hybridGain: number; // dB digital vs analog
  analogRef: number; // dB
  digitalRef: number; // dB
  hdcPreShaping: boolean;
  nrsc: boolean;
};

export type RdsCfg = {
  enabled: boolean;
  pi: number;
  ps: string;
  rt: string;
  pty: number;
  ct: boolean;
  eon: boolean;
  eonPi: number;
  tp: boolean;
  ta: boolean;
  ms: boolean;
  di: boolean;
  injection: number;
};

export type ProcessorConfig = {
  input: InputCfg;
  sensus: SensusCfg;
  imaging: ImagingCfg;
  fm: FmCfg;
  dab: DabCfg;
  web: WebCfg;
  hd: HdCfg;
  rds: RdsCfg;
};

const baseBands = (): BandCfg[] =>
  BANDS.map((b, i) => ({
    threshold: [-24, -20, -17, -15, -14, -13][i],
    attack: [12, 9, 7, 5, 4, 4][i],
    hold: [60, 50, 40, 30, 25, 25][i],
    release: [180, 160, 140, 120, 100, 90][i],
    gain: [1.5, 1, 0.5, 0, 0, -0.5][i],
    width: [60, 75, 90, 100, 110, 115][i],
  }));

export const BASE_CONFIG: ProcessorConfig = {
  input: {
    slowAgcMs: 240,
    fastAgcMs: 12,
    slowGain: 6,
    fastGain: 3,
    declip: 45,
    dequant: 30,
    humReduction: 60,
    noiseReduction: 6,
    dcBlock: true,
    speechDetect: true,
    gate: -54,
  },
  sensus: {
    mode: "auto",
    blockSize: 32,
    centroidSmoothMs: 40,
    agcWindowMs: 220,
    bands: baseBands(),
  },
  imaging: {
    haasMs: 11,
    haas: true,
    monoSafe: true,
    sideChainHp: 120,
    coherence: 96,
  },
  fm: {
    emphasis: 50,
    lpfKhz: 15,
    bassClip: 3,
    mainClip: 6,
    oversample: 16,
    pilot: 9,
    subcarrier: 90,
    rdsInjection: 3.5,
    maskEnforce: true,
    outputRate: 192000,
    rtpPort: 9001,
    rtpHost: "239.1.1.7",
  },
  dab: {
    bandwidthKhz: 20,
    truePeak: -1,
    loudness: -23,
    codec: "xHE-AAC",
    bitrate: 128,
    preShaping: true,
  },
  web: {
    bandwidthKhz: 16,
    loudness: -15,
    truePeak: -1,
    tilt: 2.5,
    tns: 3,
    format: "AAC",
    bitrate: 128,
    mount: "/stream.aac",
  },
  hd: {
    bandwidthKhz: 15,
    hybridGain: -1.5,
    analogRef: -8,
    digitalRef: -6,
    hdcPreShaping: true,
    nrsc: true,
  },
  rds: {
    enabled: true,
    pi: 0x1234,
    ps: "TMAUDIO",
    rt: "TMAUDIO Digital Broadcast Processing Suite",
    pty: 10,
    ct: true,
    eon: true,
    eonPi: 0xabcd,
    tp: false,
    ta: false,
    ms: true,
    di: true,
    injection: 3.5,
  },
};

const clampBands = (bands: BandCfg[]): BandCfg[] => {
  const base = baseBands();
  return base.map((b, i) => ({ ...b, ...(bands[i] ?? {}) }));
};

/** Deep-merge a partial patch onto a full config (preset loading). */
export function mergeConfig(
  base: ProcessorConfig,
  patch: DeepPatch<ProcessorConfig>,
): ProcessorConfig {
  const next = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const current = next[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      next[key] = { ...(current as object), ...(value as object) };
    } else {
      next[key] = value;
    }
  }
  const merged = next as unknown as ProcessorConfig;
  merged.sensus.bands = clampBands(merged.sensus.bands);
  return merged;
}

export type DeepPatch<T> = { [K in keyof T]?: Partial<T[K]> };

export type PresetKey = "fm" | "dab" | "web" | "hd";

export type Preset = {
  key: PresetKey;
  name: string;
  target: string;
  note: string;
  config: ProcessorConfig;
};

const withBands = (patch: Partial<SensusCfg>): SensusCfg => ({
  ...BASE_CONFIG.sensus,
  ...patch,
  bands: clampBands(patch.bands ?? BASE_CONFIG.sensus.bands),
});

export const PRESETS: Preset[] = [
  {
    key: "fm",
    name: "FM Optimised",
    target: "FM / MPX over IP",
    note: "50 µs pre-emphasis ahead of the limiter, dual-stage LoIMD clipping, SM.1268 policing.",
    config: mergeConfig(BASE_CONFIG, {
      sensus: withBands({
        bands: baseBands().map((b) => ({ ...b, gain: b.gain + 0.5 })),
      }),
      fm: { emphasis: 50, pilot: 9, rdsInjection: 3.5, mainClip: 6, maskEnforce: true },
      rds: { enabled: true, ct: true },
    }),
  },
  {
    key: "dab",
    name: "DAB+ Standard",
    target: "DAB+ / Digital Radio",
    note: "EBU R128 at −23 LUFS, ITU-R BS.1770 true-peak at −1 dBTP, 20 kHz for xHE-AAC.",
    config: mergeConfig(BASE_CONFIG, {
      dab: {
        bandwidthKhz: 20,
        loudness: -23,
        truePeak: -1,
        codec: "xHE-AAC",
        bitrate: 96,
        preShaping: true,
      },
      sensus: withBands({
        agcWindowMs: 300,
        bands: baseBands().map((b) => ({ ...b, release: b.release + 40 })),
      }),
      rds: { enabled: true, ct: true },
    }),
  },
  {
    key: "web",
    name: "Web 128 kbps",
    target: "Shoutcast / Icecast",
    note: "16 kHz gentle roll-off, spectral tilt + TNS pre-emphasis, −15 LUFS at −1 dBTP.",
    config: mergeConfig(BASE_CONFIG, {
      web: {
        bandwidthKhz: 16,
        loudness: -15,
        truePeak: -1,
        tilt: 3,
        tns: 4,
        format: "AAC",
        bitrate: 128,
      },
      sensus: withBands({
        bands: baseBands().map((b, i) => ({ ...b, threshold: b.threshold - (i > 3 ? 2 : 0) })),
      }),
      rds: { enabled: false },
    }),
  },
  {
    key: "hd",
    name: "HD Hybrid",
    target: "HD Radio / NRSC-5",
    note: "NRSC-5 compliant chain with hybrid gain balancing between analog and digital carriers.",
    config: mergeConfig(BASE_CONFIG, {
      hd: {
        bandwidthKhz: 15,
        hybridGain: -1.5,
        analogRef: -8,
        digitalRef: -6,
        hdcPreShaping: true,
        nrsc: true,
      },
      fm: { emphasis: 75, mainClip: 5 },
      rds: { enabled: true, ct: true, pty: 9 },
    }),
  },
];

export function getPreset(key: PresetKey): Preset {
  return PRESETS.find((p) => p.key === key) ?? PRESETS[0];
}

/** Serialise a config to copy-pasteable dotted decimal key/values. */
export function serializeConfig(
  cfg: ProcessorConfig,
  presetName: string,
): string {
  const lines: string[] = [];
  lines.push(`# TMAUDIO Digital Broadcast Processing Suite`);
  lines.push(`# preset: ${presetName}`);
  lines.push(`# format: <dotted.key> = <decimal value>   (32-bit float throughout)`);
  lines.push("");
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        value.forEach((item, i) =>
          walk(item as Record<string, unknown>, `${path}[${i}]`),
        );
      } else if (value && typeof value === "object") {
        walk(value as Record<string, unknown>, path);
      } else if (typeof value === "number") {
        lines.push(`${path} = ${value.toFixed(3)}`);
      } else if (typeof value === "boolean") {
        lines.push(`${path} = ${value ? 1 : 0}`);
      } else {
        lines.push(`${path} = "${String(value).replace(/"/g, '\\"')}"`);
      }
    }
  };
  walk(cfg as unknown as Record<string, unknown>, "");
  return lines.join("\n");
}

/** Parse the dotted format back into a config (used by the paste-to-load box). */
export function parseConfig(text: string): DeepPatch<ProcessorConfig> {
  const patch: Record<string, unknown> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    const valueText = rest.join("=").trim();
    const numeric = Number(valueText.replace(/"/g, ""));
    const value = valueText.startsWith('"')
      ? valueText.replace(/"/g, "")
      : Number.isFinite(numeric) && valueText !== ""
        ? valueText === "1" || valueText === "0"
          ? valueText === "1"
          : numeric
        : valueText;
    const parts = key.split(".");
    let node = patch;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i].replace(/\[\d+\]$/, "");
      const arrIndex = parts[i].match(/\[(\d+)\]/);
      if (arrIndex) {
        const idx = Number(arrIndex[1]);
        if (!Array.isArray(node[p])) node[p] = [];
        const arr = node[p] as unknown[];
        if (!arr[idx]) arr[idx] = {};
        node = arr[idx] as Record<string, unknown>;
      } else {
        if (typeof node[p] !== "object" || node[p] === null) node[p] = {};
        node = node[p] as Record<string, unknown>;
      }
    }
    const last = parts[parts.length - 1];
    node[last] = value;
  }
  return patch as DeepPatch<ProcessorConfig>;
}
