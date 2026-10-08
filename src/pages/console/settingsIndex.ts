/* ------------------------------------------------------------------ *
 * Settings index — the single source of truth for navigation.
 * `id` must match the RackUnit anchor (`unit-<index>` in ui.tsx).
 * Synonyms live in `keywords` so "stream TX", "encoder", "pilot",
 * "loudness" etc. all resolve to the right rack unit.
 * ------------------------------------------------------------------ */

export type SettingGroup =
  | "Master"
  | "Processing"
  | "Analysis"
  | "Monitoring"
  | "Diagnostics"
  | "System";

export const GROUP_ORDER: SettingGroup[] = [
  "Master",
  "Processing",
  "Analysis",
  "Monitoring",
  "Diagnostics",
  "System",
];

export type SettingEntry = {
  id: string;
  unit: string;
  title: string;
  group: SettingGroup;
  /** short label used by the side rail */
  short: string;
  keywords: string;
};

export const SETTINGS: SettingEntry[] = [
  {
    id: "unit-01",
    unit: "01",
    group: "Master",
    short: "TMAUDIO Master",
    title: "TMAUDIO Master — character, preset slots, morph",
    keywords:
      "master clean balanced forward power max preset a b compare bypass level match morph start engine engineer mode",
  },

  {
    id: "unit-02",
    unit: "02",
    group: "Processing",
    short: "Input stage",
    title: "Input stage — de-hum, de-clip, noise, gate, AGC",
    keywords:
      "input repair dehum de-hum hum declip de-clip noise reduction gate speech dc block agc slow fast dry voice",
  },
  {
    id: "unit-03",
    unit: "03",
    group: "Processing",
    short: "Multiband / MB3",
    title: "Sensus multiband — MB3, band dynamics, crossover",
    keywords:
      "multiband mb3 band low mid high threshold ratio attack hold release gain crossover timing engineer advanced",
  },
  {
    id: "unit-04",
    unit: "04",
    group: "Processing",
    short: "Imaging & M/S",
    title: "Imaging & mid-side — width, mono-safety, correlation",
    keywords:
      "stereo width haas mono safe coherence side channel correlation azimuth image enhance",
  },
  {
    id: "unit-05",
    unit: "05",
    group: "Processing",
    short: "Processing activity",
    title: "Processing activity — live gain reduction",
    keywords: "activity gain reduction gr agc mb3 clipper limiter live",
  },
  {
    id: "unit-06",
    unit: "06",
    group: "Processing",
    short: "Output chains · TX / stream",
    title: "Output chains — station TX, stream & encoder",
    keywords:
      "stream tx transmitter transmit encoder encode icecast shoutcast publish rtp udp network output bitrate codec aac mp3 ogg opus station feed host port fm dab web hd",
  },
  {
    id: "unit-06",
    unit: "06",
    group: "Processing",
    short: "FM MPX & pilot",
    title: "FM MPX — pre-emphasis, clip drive, pilot & deviation",
    keywords:
      "mpx fm emphasis 50us 75us pilot 19khz 38khz composite clipper deviation modulation exciter",
  },
  {
    id: "unit-07",
    unit: "07",
    group: "Processing",
    short: "Stream TX matrix",
    title: "Stream TX encoder matrix — 8 slots, protocols & codecs",
    keywords:
      "stream tx encoder encode slot1 slot2 3 4 5 6 7 8 icy shoutcast icecast tcp udp srt socket ring buffer drop congestion bitrate opus aac mp3 publish mount host port network non-http direct",
  },
  {
    id: "unit-08",
    unit: "08",
    group: "Processing",
    short: "RDS / DLS",
    title: "RDS / DLS encoder — PI, PS, RadioText, 57 kHz",
    keywords:
      "rds dls radio text pi ps rt ct pty traffic af 57khz subcarrier metadata station id programme service",
  },

  {
    id: "unit-09",
    unit: "09",
    group: "Analysis",
    short: "Loudness & true peak",
    title: "Loudness & true peak — target, offset, ceiling",
    keywords:
      "loudness lufs lra momentary short term integrated target offset ceiling true peak dbtp r128 bs.1770 compliance",
  },
  {
    id: "unit-10",
    unit: "10",
    group: "Analysis",
    short: "Spectrum analysis",
    title: "Spectrum analysis — pre-DSP vs post-DSP",
    keywords: "spectrum fft spectrogram frequency pre-dsp post-dsp analysis graph",
  },

  {
    id: "unit-11",
    unit: "11",
    group: "Monitoring",
    short: "Monitoring",
    title: "Monitoring — source, A/B, mono, dim, mute",
    keywords:
      "monitor headphones listen source input processed output a b mono dim mute level match",
  },

  {
    id: "unit-12",
    unit: "12",
    group: "Diagnostics",
    short: "Audio path",
    title: "Audio path — routing, latency, buffer, health",
    keywords:
      "routing path latency buffer sample rate channels dropouts underruns health status input output stream",
  },
  {
    id: "unit-13",
    unit: "13",
    group: "Diagnostics",
    short: "Safety counters",
    title: "Safety counters — clip, limiter, dropout events",
    keywords: "safety counters clip events limiter events dropouts underruns window",
  },
  {
    id: "unit-14",
    unit: "14",
    group: "Diagnostics",
    short: "Event log",
    title: "Event log — INFO / AUDIO / DSP / ROUTING / WARNING / ERROR",
    keywords: "log events history warnings errors audit info audio dsp routing",
  },

  {
    id: "unit-15",
    unit: "15",
    group: "System",
    short: "Factory presets",
    title: "Factory preset library — .tm files, save & load",
    keywords:
      "preset factory save load import export tm library profile chr classical talk news balanced",
  },
  {
    id: "unit-16",
    unit: "16",
    group: "System",
    short: "Station features",
    title: "Station features — silence, fallback, AES67, compliance",
    keywords:
      "silence detect fallback source aes67 ravenna patch bay watermark compliance 24h log web remote dynamic eq phat bass crossfade",
  },
  {
    id: "unit-17",
    unit: "17",
    group: "System",
    short: "Build & deploy",
    title: "Standalone build & deploy — exe, AppImage, docs",
    keywords: "build deploy install package appimage windows linux macos docs standalone portable",
  },
  {
    id: "unit-18",
    unit: "18",
    group: "System",
    short: "Reference",
    title: "Reference — architecture, standards & comparison",
    keywords: "reference architecture standards comparison checklist documentation compliance",
  },
];

/** One entry per rack unit (first wins) — used by the side rail. */
export const NAV_UNITS: SettingEntry[] = SETTINGS.filter(
  (e, i, a) => a.findIndex((x) => x.id === e.id) === i,
);

/** Substring search over title + group + keywords, title matches rank first. */
export function searchSettings(q: string): SettingEntry[] {
  const query = q.trim().toLowerCase();
  if (!query) return SETTINGS;
  const terms = query.split(/\s+/);
  return SETTINGS.map((e) => {
    const title = e.title.toLowerCase();
    const hay = `${title} ${e.group} ${e.keywords} ${e.unit}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (!hay.includes(t)) return null;
      score += title.includes(t) ? 4 : e.keywords.includes(t) ? 2 : 1;
    }
    // Exact-phrase title match wins outright: "stream tx encoder" must
    // land on the TX matrix, not on a panel that merely mentions it.
    if (title.includes(query)) score += 6;
    return { e, score };
  })
    .filter((x): x is { e: SettingEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}
