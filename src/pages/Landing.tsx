import { PATH_COLORS, BANDS, fixed } from "@/lib/tm/dsp";
import { BASE_CONFIG } from "@/lib/tm/presets";
import {
  BandActivity,
  CompositeWaveform,
} from "@/components/tm/analyzers";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Waves } from "lucide-react";
import { Link } from "react-router";
import logo from "@/assets/logo.svg";

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const rise = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: EASE },
};

const CHAINS = [
  {
    key: "fm",
    tag: "01",
    name: "FM / MPX over IP",
    color: PATH_COLORS.fm,
    line: "192 kHz composite, µMPX RTP/UDP",
    specs: [
      "50 / 75 µs pre-emphasis BEFORE limiting",
      "15 kHz linear-phase brickwall",
      "Two-stage LoIMD clipping · 8–16× OS",
      "19 kHz pilot 9 % · 38 kHz DSB-SC 90 %",
      "57 kHz BPSK RDS, EN 50067",
      "ITU-R SM.1268 mask, selective attenuation",
    ],
  },
  {
    key: "dab",
    tag: "02",
    name: "DAB+ / Digital Radio",
    color: PATH_COLORS.dab,
    line: "20 kHz · xHE-AAC / HE-AACv2",
    specs: [
      "ITU-R BS.1770 true-peak → −1 dBTP",
      "EBU R128 gated loudness → −23 LUFS",
      "Codec pre-shaping 48–192 kbps",
      "Inter-sample detection at 4× OS",
      "No clipping spent to reach target",
      "Phase-coherent stereo image",
    ],
  },
  {
    key: "web",
    tag: "03",
    name: "Web Radio",
    color: PATH_COLORS.web,
    line: "16 kHz gentle roll-off · AAC / MP3 / Ogg",
    specs: [
      "Built for the 128 kbps sweet spot",
      "Spectral tilt matching",
      "Temporal noise shaping pre-emphasis",
      "Hole-filling compatible response",
      "−14 to −16 LUFS · −1.0 dBTP",
      "Shoutcast / Icecast HTTP out",
    ],
  },
  {
    key: "hd",
    tag: "04",
    name: "HD Radio",
    color: PATH_COLORS.hd,
    line: "NRSC-5 · HDC+ codec",
    specs: [
      "NRSC-5 compliant processing",
      "Hybrid analog/digital gain balance",
      "Licensed emission mask policing",
      "Spectral shaping for HDC+",
      "Carrier-referenced level targets",
      "Mono/stereo hybrid handling",
    ],
  },
];

const FLOW = [
  "Input 96 kHz",
  "Repair",
  "Dual-speed AGC",
  "Sensus 6-band",
  "Imaging M/S",
  "Four chains",
  "Outputs",
];

const DELIVERABLES = [
  ["Project architecture", "full C++20 directory tree, CMake + JUCE"],
  ["DSP pipeline headers", "ProcessorGraph, Sensus, timing law"],
  ["MPX matrix + LoIMD clipper", "composite generator, two-stage clip"],
  ["RDS block assembler", "CRC-10, offset words, biphase → BPSK"],
  ["Build instructions", "deps, toolchains, RT benchmark target"],
  ["Four broadcast presets", "FM Optimised · DAB+ · Web 128 · HD"],
  ["Comparison checklist", "vs StereoTool, BreakawayOne, Omnia, Orban"],
];

const VS = [
  ["Timing model", "interpolated per 32-sample block", "fixed laws / presets"],
  ["Signal paths", "four independent chains", "one shared chain"],
  ["MPX clipping", "bass isolated, 8–16× oversampled", "single clipper stage"],
  ["RDS encoder", "built in, phase-locked to pilot", "external encoder"],
  ["Source & presets", "open C++20, decimal text presets", "closed, binary blobs"],
];

const STANDARDS = [
  ["Zero-phase filters", "linear-phase FIR where it is audible"],
  ["No pre-echo", "overlap-add windows validated in CI"],
  ["IMD < −60 dBc", "at full 100 % modulation"],
  ["Pilot drift < ±1°", "19/38/57 kHz from one NCO"],
  ["RDS error-free", "syndrome check on every block"],
  ["Targets without clipping", "gated R128 + true-peak limiter"],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0B0C0E] text-foreground">
      {/* ------------------------------ nav ------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-[#0B0C0E]/92 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="TMAUDIO"
              width={30}
              height={30}
              className="rounded-md ring-1 ring-white/10"
            />
            <span className="flex flex-col">
              <span className="text-[13px] leading-none font-semibold tracking-[0.16em]">
                TMAUDIO
              </span>
              <span className="mt-1 text-[9px] leading-none tracking-[0.18em] text-muted-foreground uppercase">
                Broadcast Processing Suite
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[12px] text-muted-foreground md:flex">
            <a href="#chains" className="transition-colors hover:text-foreground">
              Chains
            </a>
            <a href="#sensus" className="transition-colors hover:text-foreground">
              Sensus
            </a>
            <a href="#compare" className="transition-colors hover:text-foreground">
              Compare
            </a>
            <a href="#open" className="transition-colors hover:text-foreground">
              Open source
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-muted-foreground sm:flex"
            >
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-[#F5A524] text-[#141005] hover:bg-[#FFB84A]"
            >
              <Link to="/dashboard">
                Open console
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ------------------------------ hero ----------------------------- */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
          }}
        />
        <div className="relative mx-auto max-w-[1240px] px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F5A524]/30 bg-[#F5A524]/8 px-3 py-1.5 text-[10px] tracking-[0.2em] text-[#F5A524] uppercase">
              <Waves className="size-3" />
              Open · cross-platform · broadcast compliant
            </span>

            <h1 className="mt-6 text-4xl leading-[1.04] font-semibold tracking-[-0.03em] text-foreground sm:text-6xl">
              A broadcast processor
              <br />
              with <span className="text-[#F5A524]">nothing hidden</span>.
            </h1>

            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              TMAUDIO runs four fully independent processing chains — FM/MPX,
              DAB+, Web and HD — from one 96 kHz, 32-bit float graph. Linear-phase
              filtering, density-adaptive dynamics, low-IMD clipping and a
              phase-coherent RDS encoder, every algorithm written out in plain
              C++20 you can read.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 bg-[#F5A524] text-[#141005] hover:bg-[#FFB84A]"
              >
                <Link to="/dashboard">
                  Launch the processor
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/80 bg-[#121417] hover:bg-[#171A1F]"
              >
                <Link to="/auth?returnTo=%2Fdashboard">Sign in to save presets</Link>
              </Button>
            </div>

            <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-5 border-t border-border/60 pt-6 sm:grid-cols-4">
              {[
                ["96 kHz", "native input"],
                ["192 kHz", "MPX composite"],
                ["4", "parallel chains"],
                ["32-bit", "float throughout"],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="font-mono text-xl tabular-nums text-foreground">
                    {v}
                  </dt>
                  <dd className="mt-1 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    {k}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-12"
          >
            <div className="overflow-hidden rounded-xl border border-border/70 bg-[#121417] shadow-[0_30px_80px_-50px_rgba(0,0,0,1)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-[#161A1F] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-[2px] rounded-full bg-[#F5A524] shadow-[0_0_6px_#F5A52488]" />
                  <div>
                    <p className="text-[13px] leading-none font-semibold">
                      FM multiplex composite
                    </p>
                    <p className="mt-1 text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                      L+R · pilot · DSB-SC · RDS — one clock, zero drift
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span className="text-[#4ADE80]">● LIVE</span>
                  <span>192 000 Hz</span>
                  <span>100 % MOD</span>
                </div>
              </div>
              <div className="p-4">
                <CompositeWaveform running height={230} />
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span>
                    <span className="text-[#F5A524]">■</span> L+R 0–15 kHz
                  </span>
                  <span>PILOT 19 kHz · 9 %</span>
                  <span>L−R 38 kHz · 90 %</span>
                  <span className="text-[#35C8D8]">RDS 57 kHz · 1187.5 Bd</span>
                  <span className="ml-auto text-[#4ADE80]">
                    IMD &lt; −60 dBc · drift &lt; ±1°
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------ flow ----------------------------- */}
      <section className="border-y border-border/60 bg-[#0E1014]">
        <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {FLOW.map((stage, i) => (
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex items-center gap-2"
              >
                <span className="rounded-md border border-border/70 bg-[#14171C] px-3 py-2 text-[11px] whitespace-nowrap text-foreground/85">
                  <span className="mr-2 font-mono text-[10px] text-[#F5A524]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {stage}
                </span>
                {i < FLOW.length - 1 && (
                  <span className="text-muted-foreground/50">→</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- chains ---------------------------- */}
      <section id="chains" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...rise} className="max-w-2xl">
          <span className="text-[10px] tracking-[0.2em] text-[#F5A524] uppercase">
            Parallel output chains
          </span>
          <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">
            Four targets, four completely separate chains.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Not one chain duplicated four times. Each path gets its own filters,
            its own limiter and its own compliance mask, fed from a shared
            analysis front end that never re-shapes the audio twice.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CHAINS.map((chain, i) => (
            <motion.article
              key={chain.key}
              {...rise}
              transition={{ ...rise.transition, delay: i * 0.07 }}
              className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-[#121417] transition-colors hover:border-border"
            >
              <div
                className="flex items-center justify-between border-b border-border/60 bg-[#161A1F] px-4 py-3"
                style={{ boxShadow: `inset 0 2px 0 0 ${chain.color}` }}
              >
                <span className="font-mono text-[10px]" style={{ color: chain.color }}>
                  {chain.tag}
                </span>
                <Radio className="size-3.5" style={{ color: chain.color }} />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <h3 className="text-[15px] font-semibold tracking-tight">
                  {chain.name}
                </h3>
                <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {chain.line}
                </p>
                <ul className="mt-1 flex flex-col gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  {chain.specs.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span style={{ color: chain.color }}>·</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard"
                  className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] font-medium text-foreground/70 transition-colors group-hover:text-foreground"
                >
                  Open this chain
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ----------------------------- sensus ---------------------------- */}
      <section id="sensus" className="border-y border-border/60 bg-[#0E1014]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_minmax(0,460px)]">
          <motion.div {...rise}>
            <span className="text-[10px] tracking-[0.2em] text-[#F5A524] uppercase">
              TMAUDIO Sensus
            </span>
            <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">
              Timing that is calculated, never preset.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Every block of 32 or 64 samples, Sensus measures spectral centroid
              and transient density and interpolates the attack and release of
              all six bands from that measurement. Drums get a fast/fast law,
              sustained beds a slow/programme-adaptive law, speech a gentle law
              with a widened AGC window. This is the difference between a
              processor that reacts to the record and one that applies a preset
              to it.
            </p>

            <div className="mt-8 overflow-hidden rounded-lg border border-border/60">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border/60 bg-[#14171C] text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                    <th className="px-3 py-2 font-medium">Band</th>
                    <th className="px-3 py-2 font-medium">Range</th>
                    <th className="px-3 py-2 font-medium">Threshold</th>
                    <th className="px-3 py-2 font-medium">Width</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {BANDS.map((b, i) => {
                    const cfg = BASE_CONFIG.sensus.bands[i];
                    return (
                      <tr key={b.index} className="hover:bg-[#14171C]">
                        <td className="px-3 py-2 text-[12px] font-medium">
                          <span className="mr-2 font-mono text-[10px]" style={{ color: b.color }}>
                            {i + 1}
                          </span>
                          {b.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {b.range}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-foreground/85">
                          {fixed(cfg.threshold, 1)} dBFS
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {fixed(cfg.width, 0)} %
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div {...rise} transition={{ ...rise.transition, delay: 0.1 }}>
            <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-[#121417] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Live band activity
                </span>
                <span className="font-mono text-[10px] text-[#F5A524]">
                  density-adaptive
                </span>
              </div>
              <BandActivity
                running
                mode="auto"
                thresholds={BASE_CONFIG.sensus.bands.map((b) => b.threshold)}
              />
              <div className="grid gap-3 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-[#0E1014] p-3">
                  <span className="block text-[10px] tracking-[0.14em] text-foreground/80 uppercase">
                    Drums
                  </span>
                  fast attack · fast release
                </div>
                <div className="rounded-lg border border-border/50 bg-[#0E1014] p-3">
                  <span className="block text-[10px] tracking-[0.14em] text-foreground/80 uppercase">
                    Music
                  </span>
                  slow attack · programme release
                </div>
                <div className="rounded-lg border border-border/50 bg-[#0E1014] p-3">
                  <span className="block text-[10px] tracking-[0.14em] text-foreground/80 uppercase">
                    Speech
                  </span>
                  gentle · widened AGC window
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------- compare ---------------------------- */}
      <section id="compare" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...rise} className="max-w-2xl">
          <span className="text-[10px] tracking-[0.2em] text-[#F5A524] uppercase">
            Where it wins
          </span>
          <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">
            Against the incumbents.
          </h2>
        </motion.div>

        <motion.div
          {...rise}
          className="mt-8 overflow-x-auto rounded-xl border border-border/70 bg-[#121417]"
        >
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/60 bg-[#161A1F] text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium text-[#F5A524]">
                  TMAUDIO
                </th>
                <th className="px-4 py-3 font-medium">StereoTool / BreakawayOne</th>
                <th className="px-4 py-3 font-medium">Omnia / Orban</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {VS.map(([area, tmaudio, others]) => (
                <tr key={area} className="hover:bg-[#161A1F]">
                  <td className="px-4 py-3 text-[12px] font-medium text-foreground/90">
                    {area}
                  </td>
                  <td className="px-4 py-3 text-[12px] leading-relaxed text-[#F5A524]">
                    {tmaudio}
                  </td>
                  <td className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
                    {others}
                  </td>
                  <td className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
                    {others}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* --------------------------- deliverables ------------------------ */}
      <section id="open" className="border-t border-border/60 bg-[#0E1014]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <motion.div {...rise}>
            <span className="text-[10px] tracking-[0.2em] text-[#F5A524] uppercase">
              Open, documented, auditable
            </span>
            <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">
              Every deliverable ships with the source.
            </h2>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {DELIVERABLES.map(([title, note]) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-lg border border-border/60 bg-[#121417] p-3.5"
                >
                  <span className="mt-0.5 text-[#4ADE80]">✓</span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-foreground/90">
                      {title}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {note}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {STANDARDS.map(([title, note]) => (
                <div
                  key={title}
                  className="rounded-lg border border-border/50 bg-[#121417] p-3"
                >
                  <span className="block text-[11px] font-medium text-foreground/90">
                    {title}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.pre
            {...rise}
            transition={{ ...rise.transition, delay: 0.1 }}
            className="overflow-x-auto rounded-xl border border-border/70 bg-[#0A0C0E] p-5 font-mono text-[11px] leading-[1.7] text-foreground/80"
          >{`// src/sensus/DensityTiming.h — no fixed times exist
struct Timings { double attackMs, releaseMs; };

Timings interpolate(const Analysis& a) noexcept {
  if (a.isSpeech)          return speechLaw(a.agcWindowMs);
  if (a.transientDensity > 0.6)
                           return fastLaw;      // drums
  if (a.centroid < 900.0)  return musicLaw;     // sustained bed
  return mix(musicLaw, fastLaw, a.transientDensity);
}

// src/rds/Crc10.h — G(x) = x^10+x^8+x^7+x^5+x^4+x^3+1
uint16_t checkword(uint16_t block, uint16_t offset) {
  uint32_t reg = uint32_t(block) << 10;
  for (int bit = 25; bit >= 10; --bit)
    if (reg & (1u << bit)) reg ^= 0x5B9u << (bit - 10);
  return uint16_t(reg & 0x3FF) ^ offset;
}`}</motion.pre>
        </div>
      </section>

      {/* ------------------------------ cta ------------------------------ */}
      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
        <motion.div
          {...rise}
          className="relative overflow-hidden rounded-2xl border border-border/70 bg-[#121417] px-6 py-12 text-center sm:px-12 sm:py-16"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(60% 80% at 50% 0%, rgba(245,165,36,0.14), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">
              Put it on the air.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Load a preset, watch the multiplex, read every value in plain
              decimal text. The console runs the same graph the C++ engine does.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 bg-[#F5A524] text-[#141005] hover:bg-[#FFB84A]"
              >
                <Link to="/dashboard">
                  Open the console
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/80 bg-[#0E1014] hover:bg-[#14171C]"
              >
                <Link to="/auth">Create an account</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[11px] text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2">
            <img src={logo} alt="" width={18} height={18} className="rounded" />
            TMAUDIO Digital Broadcast Processing Suite
          </span>
          <span className="font-mono tabular-nums">
            C++20 · JUCE · AVX2 / NEON · Windows · Linux · macOS
          </span>
        </div>
      </footer>
    </div>
  );
}
