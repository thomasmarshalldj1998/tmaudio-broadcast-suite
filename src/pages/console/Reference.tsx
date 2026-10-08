import { PATH_COLORS } from "@/lib/tm/dsp";
import {
  getPreset,
  parseConfig,
  serializeConfig,
} from "@/lib/tm/presets";
import { RackUnit, Segmented } from "@/components/tm/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { useConsole } from "./context";

type RefTab = "config" | "architecture" | "pipeline" | "build" | "compare";

const TREE = `tmaudio/
├─ CMakeLists.txt                  # C++20, AVX2/NEON auto-detect
├─ cmake/toolchains/{msvc,clang,gcc}.cmake
├─ src/
│  ├─ core/
│  │  ├─ ProcessorGraph.h          # 32-sample block scheduler
│  │  ├─ AudioBuffer.h             # 32-bit float, 64-byte aligned
│  │  ├─ SampleRateConverter.h     # 96k <-> 192k polyphase
│  │  └─ CpuBudget.h               # per-chain real-time accounting
│  ├─ dsp/
│  │  ├─ simd/{Kernels.h, Avx2.h, Neon.h, Dispatch.h}
│  │  ├─ filters/{FirDesign.h, ZeroPhaseFir.h, LinkwitzRiley8.h}
│  │  ├─ fft/{FftPlan.h, Window.h, OverlapAdd.h}
│  │  ├─ dynamics/{Envelope.h, DensityTiming.h, GainComputer.h}
│  │  └─ analysis/{Centroid.h, TransientDensity.h, SpeechDetect.h}
│  ├─ sensus/
│  │  ├─ SensusEngine.h            # 6-band linear-phase crossover
│  │  ├─ SensusBand.h              # thr / atk / hold / rel per band
│  │  └─ ImagingStage.h            # M-S, Haas, mono-safe fold
│  ├─ repair/{Declipper.h, Dequantiser.h, HumRejector.h, DcBlock.h}
│  ├─ chains/
│  │  ├─ fm/{FmChain.h, PreEmphasis.h, LoImdClipper.h,
│  │  │      MpxMatrix.h, Sm1268Mask.h, PilotGen.h, RtpUdpSink.h}
│  │  ├─ dab/{DabChain.h, TruePeakLimiter.h, EbuR128.h, CodecShape.h}
│  │  ├─ web/{WebChain.h, TiltMatch.h, TnsPreEmphasis.h, IcecastSink.h}
│  │  └─ hd/{HdChain.h, HybridBalancer.h, Nrsc5Mask.h, HdcShape.h}
│  ├─ rds/{RdsEncoder.h, Crc10.h, BlockAssembler.h,
│  │       BiphaseShaper.h, BpskModulator.h, GroupScheduler.h}
│  ├─ io/{AsioDevice.h, WasapiDevice.h, AlsaDevice.h, CoreAudioDevice.h}
│  └─ app/main.cpp
├─ gui/                            # JUCE 8
│  ├─ MainWindow.h
│  ├─ panels/{InputPanel, SensusPanel, ChainPanel, RdsPanel, MeterPanel}
│  └─ look/{TmAudioLookAndFeel.h, Knob.h, SpectrumDisplay.h}
├─ presets/{fm_optimized, dab_standard, web_128, hd_hybrid}.tm
├─ tests/                          # Catch2: CRC vectors, IMD, mask conformance
├─ docs/{algorithms,mpx_matrix,rds_blocks,compliance}.md
└─ third_party/{juce, fftw, catch2}`;

const PIPELINE = `// ---- ProcessorGraph::process() — one 32-sample block ------------------
void ProcessorGraph::process(AudioBuffer& in) noexcept {
    repair_.run(in);                       // declip, dequant, hum, DC
    DualSpeedAgc::apply(in, slow_, fast_, speech_.isSpeech());

    Analysis a = analyse(in);              // centroid, transient density
    double t0 = timing_.interpolate(a);    // <- no fixed times anywhere
    sensus_.process(in, a, t0);            // 6-band zero-phase split

    imaging_.process(in, width_, haas_, monoSafe_);

    if (chains_.fm.enabled)   fmChain_.process(in, a);
    if (chains_.dab.enabled)  dabChain_.process(in, a);
    if (chains_.web.enabled)  webChain_.process(in, a);
    if (chains_.hd.enabled)   hdChain_.process(in, a);
}

// ---- DensityAdaptiveTiming — block-rate interpolation -----------------
Timings DensityAdaptiveTiming::interpolate(const Analysis& a) {
    if (a.speech)      return widen(speechLaw_, a.agcWindowMs);
    if (a.transientDensity > 0.6) return fastLaw_;      // drums
    if (a.centroid < 900.0) return slowMusicLaw_;       // sustained bed
    return mix(slowMusicLaw_, fastLaw_, a.transientDensity);
}

// ---- LoImdClipper: two stages, bass isolated --------------------------
void FmChain::clipStage(AudioBuffer& b, double driveDb) {
    auto bass = lowPass(b, 300.0);         // separate 0-300 Hz path
    auto rest = highPass(b, 300.0);
    applySoftClip(bass, driveDb * 0.5);    // no IMD spread into HF
    applySoftClip(rest, driveDb);          // 16x oversample -> clip -> filter
    b = sum(bass, rest);
}

// ---- MpxMatrix: composite at 192 kHz ----------------------------------
void MpxMatrix::run(const Stereo& lr, double pilotPhase) {
    const auto sum = (lr.L + lr.R) * 0.5;          // L+R, 0-15 kHz
    const auto dif = (lr.L - lr.R) * 0.5;          // L-R
    out = sum
        + sine(19000.0, pilotPhase) * (pilotPct / 100.0)
        + dif * cos(38000.0 * t) * (subPct / 100.0)
        + rdsBpsk(57000.0, pilotPhase * 3.0);      // 3x pilot: zero drift
    out = sm1268_.enforce(out);                    // selective attenuation
}`;

const BUILD = `# ---------------------------------------------------------------------------
# TMAUDIO — build instructions and dependency list
# ---------------------------------------------------------------------------

# Dependencies
#   CMake >= 3.24, C++20 compiler (MSVC 19.3x / Clang 17+ / GCC 13+)
#   JUCE 8            — GUI, audio device abstraction          (vendored)
#   FFTW3f            — single-precision FFT for zero-phase FIR
#   libsndfile        — WAV/AIFF I/O for test vectors
#   asio / RtMidi      — Windows low-latency + MIDI learn (optional)
#   Catch2 3          — unit tests (CRC-10 vectors, IMD, mask conformance)
#   pkg-config, Ninja — build drivers
#
# Linux   : sudo apt install cmake ninja-build libfftw3-dev libsndfile1-dev \\
#                        libasound2-dev libx11-dev libxrandr-dev
# macOS   : brew install cmake ninja fftw libsndfile
# Windows : vcpkg install fftw3 libsndfile;  JUCE via FetchContent

cmake -S . -B build -G Ninja \\
      -DCMAKE_BUILD_TYPE=Release \\
      -DTMAUDIO_SIMD=AUTO \\          # AVX2 | NEON | AUTO | SCALAR
      -DTMAUDIO_GUI=ON \\
      -DTMAUDIO_TESTS=ON

cmake --build build --parallel
ctest --test-dir build --output-on-failure

# Real-time performance target: < 12 % of one core for 4 chains at 96 kHz
# on a 2019 laptop, measured by tools/rt_benchmark.

# Run
./build/tmaudio --preset presets/fm_optimized.tm --device "ASIO:TMAUDIO"`;

const COMPARE: { area: string; tmaudio: string; others: [string, string][] }[] = [
  {
    area: "Timing model",
    tmaudio: "Density-adaptive: attack/release interpolated per 32-sample block from spectral centroid + transient density",
    others: [
      ["StereoTool", "fixed per-band times with a few content presets"],
      ["BreakawayOne", "adaptive but closed source, timings not user-visible"],
      ["Omnia / Orban", "fixed or slow program-dependent laws"],
    ],
  },
  {
    area: "Signal paths",
    tmaudio: "Four genuinely independent chains, each with its own filter set and limiter",
    others: [
      ["StereoTool", "one chain, per-output EQ tweaks"],
      ["BreakawayOne", "one shared chain with output stages"],
      ["Omnia / Orban", "single chain per hardware unit"],
    ],
  },
  {
    area: "MPX clipping",
    tmaudio: "Two-stage LoIMD: 0-300 Hz clipped separately, 8-16x oversampled main stage",
    others: [
      ["StereoTool", "single clipper stage"],
      ["BreakawayOne", "single clipper stage"],
      ["Omnia / Orban", "clipper then clipper-driven limiter, hardware DSP"],
    ],
  },
  {
    area: "Pre-emphasis order",
    tmaudio: "50/75 µs applied before limiting so the HF ceiling is what is limited",
    others: [
      ["StereoTool", "selectable, order differs per mode"],
      ["BreakawayOne", "applied late in the chain"],
      ["Omnia / Orban", "emphasis inside the analog-style block"],
    ],
  },
  {
    area: "RDS encoder",
    tmaudio: "Built in: PI/PS/RT/CT/EON, CRC-10 + offset words, 3x-pilot phase lock",
    others: [
      ["StereoTool", "RDS text only, external encoder usually still required"],
      ["BreakawayOne", "not included"],
      ["Omnia / Orban", "external RDS encoder"],
    ],
  },
  {
    area: "Source & presets",
    tmaudio: "C++20, every algorithm documented; presets are plain decimal text",
    others: [
      ["StereoTool", "closed source, binary preset blobs"],
      ["BreakawayOne", "closed source"],
      ["Omnia / Orban", "closed hardware and software"],
    ],
  },
  {
    area: "Platform support",
    tmaudio: "Windows 10+, Linux, macOS from one CMake tree",
    others: [
      ["StereoTool", "Windows, Linux, macOS (uneven)"],
      ["BreakawayOne", "Windows, Linux"],
      ["Omnia / Orban", "vendor-locked hardware or Windows"],
    ],
  },
];

const STANDARDS = [
  ["Zero-phase filters where audible", "linear-phase FIR everywhere in-band"],
  ["No pre-echo or transient smearing", "overlap-add window validated by unit test"],
  ["IMD > 60 dB below carrier at 100 % mod", "two-stage LoIMD clipper"],
  ["Pilot phase stability < ±1°", "19/38/57 kHz all derived from one NCO"],
  ["RDS error-free across receivers", "CRC-10 syndrome check on every block"],
  ["Loudness targets met without clipping", "gated R128 + true-peak limiter"],
];

export function ReferenceSection() {
  const { cfg, presetKey, set, loadPreset, markDirty } = useConsole();
  const [tab, setTab] = useState<RefTab>("config");
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const preset = getPreset(presetKey);
  const text = serializeConfig(cfg, preset.name);
  const shown = draft ?? text;

  useEffect(() => {
    setDraft(null);
  }, [presetKey]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const load = () => {
    const patch = parseConfig(shown) as unknown as Record<
      string,
      object | undefined
    >;
    for (const [section, value] of Object.entries(patch)) {
      if (value) {
        (set as unknown as (k: string, p: object) => void)(section, value);
      }
    }
    setDraft(null);
    markDirty();
  };

  return (
    <RackUnit
      index="18"
      title="Presets, Architecture & Compliance"
      eyebrow="deliverables · plain-text configs · open source tree"
      accent={PATH_COLORS.web}
      right={
        <Segmented<RefTab>
          value={tab}
          onChange={setTab}
          accent={PATH_COLORS.web}
          size="sm"
          options={[
            { value: "config", label: "Config" },
            { value: "architecture", label: "Architecture" },
            { value: "pipeline", label: "Pipeline" },
            { value: "build", label: "Build" },
            { value: "compare", label: "Compare" },
          ]}
        />
      }
    >
      {tab === "config" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                {preset.name} — every value is a readable decimal
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {text.split("\n").length} keys
              </span>
            </div>
            <Textarea
              value={shown}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Serialized processor configuration"
              className="h-[380px] resize-none font-mono text-[11px] leading-[1.55] tabular-nums"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy} className="gap-2">
                {copied ? "Copied" : "Copy config"}
              </Button>
              <Button size="sm" variant="outline" onClick={load}>
                Re-apply edited values
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Discard edits
              </Button>
              <span className="self-center font-mono text-[10px] text-muted-foreground">
                no binaries · no obfuscation · diff-able presets
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Shipped presets
            </span>
            {[
              ["FM Optimised", "fm", "50 µs · LoIMD 2-stage · SM.1268"],
              ["DAB+ Standard", "dab", "−23 LUFS · −1 dBTP · 20 kHz"],
              ["Web 128 kbps", "web", "16 kHz · −15 LUFS · TNS"],
              ["HD Hybrid", "hd", "NRSC-5 · hybrid gain balance"],
            ].map(([name, key, note]) => (
              <button
                key={key}
                type="button"
                onClick={() => loadPreset(key as typeof presetKey)}
                className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  presetKey === key
                    ? "border-[#8B7CF6]/60 bg-[#8B7CF6]/10"
                    : "border-border/60 bg-[#1E232A] hover:border-border"
                }`}
              >
                <span className="text-[11px] font-medium text-foreground/90">
                  {name}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {note}
                </span>
              </button>
            ))}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Preset files are the same dotted key/value text shown on the left,
              so a preset is a patch you can read, paste into a review, or ship
              in a git diff.
            </p>
          </div>
        </div>
      )}

      {tab === "architecture" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-[#12161B] p-4 font-mono text-[11px] leading-[1.6] text-foreground/80">
            {TREE}
          </pre>
          <div className="flex flex-col gap-3">
            <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Deliverable · dependencies
            </span>
            <ul className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              {[
                ["JUCE 8", "GUI, devices, cross-platform shell"],
                ["FFTW3f", "single-precision FFT for linear-phase FIR"],
                ["libsndfile", "test vectors and file I/O"],
                ["Catch2 3", "CRC-10 vectors, IMD, mask conformance"],
                ["ASIO / RtMidi", "Windows low-latency, MIDI learn"],
              ].map(([dep, use]) => (
                <li
                  key={dep}
                  className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2"
                >
                  <span className="font-mono text-foreground/85">{dep}</span>
                  <span className="text-right">{use}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-border/50 bg-[#1E232A] p-3 text-[10px] leading-relaxed text-muted-foreground">
              SIMD kernels dispatch at runtime: AVX2 on x86-64, NEON on Apple
              Silicon and ARM Linux, scalar fallback everywhere else — one source
              tree, identical output on all three.
            </div>
          </div>
        </div>
      )}

      {tab === "pipeline" && (
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-[#12161B] p-4 font-mono text-[11px] leading-[1.65] text-foreground/80">
          {PIPELINE}
        </pre>
      )}

      {tab === "build" && (
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-[#12161B] p-4 font-mono text-[11px] leading-[1.65] text-foreground/80">
          {BUILD}
        </pre>
      )}

      {tab === "compare" && (
        <div className="flex flex-col gap-5">
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border/60 bg-[#1E232A] text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                  <th className="px-3 py-2.5 font-medium">Area</th>
                  <th className="px-3 py-2.5 font-medium text-[#F5A524]">
                    TMAUDIO
                  </th>
                  <th className="px-3 py-2.5 font-medium">StereoTool</th>
                  <th className="px-3 py-2.5 font-medium">BreakawayOne</th>
                  <th className="px-3 py-2.5 font-medium">Omnia / Orban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {COMPARE.map((row) => (
                  <tr key={row.area} className="align-top hover:bg-[#2A313A]">
                    <td className="px-3 py-3 text-[11px] font-medium text-foreground/90">
                      {row.area}
                    </td>
                    <td className="px-3 py-3 text-[11px] leading-relaxed text-[#F5A524]">
                      {row.tmaudio}
                    </td>
                    {row.others.map(([name, value]) => (
                      <td
                        key={name}
                        className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Quality standards enforced in CI
            </span>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {STANDARDS.map(([title, how]) => (
                <div
                  key={title}
                  className="flex gap-3 rounded-lg border border-border/60 bg-[#1E232A] p-3"
                >
                  <span className="mt-0.5 text-[#4ADE80]">✓</span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[11px] leading-snug font-medium text-foreground/90">
                      {title}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {how}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </RackUnit>
  );
}
