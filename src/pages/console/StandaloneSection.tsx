import { PATH_COLORS } from "@/lib/tm/dsp";
import { RackUnit, Segmented } from "@/components/tm/ui";
import { useState } from "react";

type DocTab = "build" | "deploy" | "guide" | "devref";

const BUILD = `# ===========================================================================
# TMAUDIO v1.0 STANDALONE EDITION — static build, one executable per platform
# Every library, codec and runtime component is compiled in. Nothing is
# loaded from outside the executable at run time.
# ===========================================================================

# native/CMakeLists.txt (key options)
option(TMAUDIO_STANDALONE "Single self-contained executable" ON)
option(TMAUDIO_STATIC_RUNTIME "Static CRT / libstdc++ / libc++"  ON)
option(TMAUDIO_SIMD "AVX2 | NEON | AUTO | SCALAR"               "AUTO")
option(TMAUDIO_CODECS "Static AAC/MP3/Ogg encoders"              ON)
option(TMAUDIO_GUI "JUCE STANDALONE window"                      ON)

# Dependencies (all vendored into third_party/, statically linked)
#   JUCE 8         — STANDALONE app target only (no VST/AU/AAX wrapper)
#   FFTW3f         — single precision FFT, built with -DENABLE_SHARED=OFF
#   libsndfile     — static .a / .lib for test-vector I/O
#   LAME, libopus, libvorbis, fdk-aac — encoders, static, no dlopen
#   Catch2 3       — unit tests only, never shipped

# Windows 10+ (portable x64 .exe, /MT, no VC redist required)
cmake -S native -B build/win -G "Visual Studio 17 2022" -A x64 \\
      -DTMAUDIO_STANDALONE=ON -DTMAUDIO_STATIC_RUNTIME=ON
cmake --build build/win --config Release --parallel
pwsh native/scripts/package-windows.ps1      # -> dist/TMAUDIO.exe

# Linux (AppImage, no system packages, no install)
cmake -S native -B build/linux -G Ninja -DCMAKE_BUILD_TYPE=Release \\
      -DTMAUDIO_STANDALONE=ON -DTMAUDIO_STATIC_RUNTIME=ON
cmake --build build/linux --parallel
ctest --test-dir build/linux --output-on-failure
bash native/scripts/package-linux.sh         # -> dist/TMAUDIO.AppImage

# macOS (Universal .app: arm64 + x86_64, codesigned, drag-and-drop)
cmake -S native -B build/mac -G Ninja \\
      -DCMAKE_BUILD_TYPE=Release \\
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \\
      -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \\
      -DTMAUDIO_STANDALONE=ON -DTMAUDIO_STATIC_RUNTIME=ON
cmake --build build/mac --parallel
bash native/scripts/package-macos.sh          # -> dist/TMAUDIO.app

# Verification gate before a build is called v1.0:
#   * ldd/otool -L/dumpbin show no unresolved third-party DLLs
#   * the whole dist/ folder copies to a USB stick and runs on a clean VM
#   * presets load from the folder beside the executable`;

const DEPLOY = `PORTABLE DEPLOYMENT  —  run from any folder or USB drive
================================================================

dist/
├─ TMAUDIO.exe | TMAUDIO.AppImage | TMAUDIO.app
├─ presets/            *.tm  plain-text decimal configs (read/write)
├─ logs/               24 h compliance CSV, rolling 30 days
└─ README.txt

 1. Copy dist/ anywhere — no installer, no admin/root rights, no registry
    keys, no services, no scheduled tasks, no telemetry, no network calls
    other than the stream destinations you configure yourself.
 2. Presets live beside the executable and are opened as plain text: the
    folder is the configuration root, so a USB stick is a complete station.
 3. First run creates logs/ only. Delete the folder and nothing else
    changes — the application state is entirely in presets/ + your config.
 4. Windows: SmartScreen may warn on an unsigned portable exe — "More info →
    Run anyway", or sign with your own certificate (signtool script in
    native/scripts/package-windows.ps1).
 5. Linux: chmod +x TMAUDIO.AppImage (double-click after that). FUSE is not
    required: ./TMAUDIO.AppImage --appimage-extract-and-run works anywhere.
 6. macOS: right-click → Open on first launch, or xattr -dr com.apple.quarantine
    TMAUDIO.app. Universal binary runs natively on Apple Silicon and Intel.
 7. Uninstall = delete the folder.`;

const GUIDE = `TMAUDIO USER GUIDE — v1.0 STANDALONE EDITION
================================================================

1. PORTABLE DEPLOYMENT
   • Copy the distribution folder to disk or USB; launch the executable.
   • Point "Preset folder" at ./presets (default) — presets are plain
     text, so you can edit them in any editor while the app is running.
   • Set your interface: Windows WASAPI/ASIO, Linux ALSA/JACK, macOS
     CoreAudio. 96 kHz is the native rate; MPX runs at 192 kHz internally.
   • Outputs: assign FM composite (MPX @ 192 kHz PCM, or µMPX RTP/UDP),
     DAB+ PCM, Web encoder, HD pair. Each is an independent chain — mute or
     repatch one without touching the others.

2. TUNING
   • Start from a factory preset closest to your format, then:
     a. Input repair — declip/de-hiss only as much as the source needs;
        watch the input spectrum for restored HF, not for level.
     b. Dual-loop AGC — set slow attack for programme grooming (150–500 ms),
        slow release 400–2000 ms for long-term balance; fast loop only for
        transient guard (5–30 ms attack, 20–100 ms hold, 50–200 ms release).
     c. Sensus — per band, set threshold where GR just starts to move, then
        choose ratio for character. Timing is density-adaptive: do NOT chase
        attack/release unless a band misbehaves on your content.
     d. Imaging — check the correlation scope; if mono fold-down drops below
        ~0.7 raise coherence or enable mono-safe before touching width.
     e. Path limiter — pre-emphasis first (50 µs EU / 75 µs US, BEFORE the
        limiter), then clip drive. With SM.1268 enforcement on, push loudness
        until the mask indicator reacts; that is your legal ceiling.
     f. Loudness — DAB+ to −23 LUFS / −1.0 dBTP, Web to −14…−16 LUFS,
        HD to the NRSC hybrid balance you measured on air.

3. PLATFORM SETUP
   • Windows 10+ x64: portable .exe, no VC redist (static CRT). Low latency
     with ASIO drivers; WASAPI exclusive otherwise.
   • Linux: AppImage, double-click. ALSA by default; JACK if you need
     explicit routing. AppImage --appimage-extract-and-run for no-FUSE hosts.
   • macOS: Universal .app, drag to /Applications or run in place.
   • Web remote: enable in Station Features → browse to http://<host>:8080
     from any device for metering and preset recall (local network only).

4. COMPLIANCE
   • 24 h compliance log records integrated loudness, short-term maximum,
     true peak, modulation depth, pilot level and status every 10 minutes.
   • Export CSV for the regulator, or Print/PDF for a signed report.
   • RDS: syndrome check on every block, error rate displayed live; keep
     injection inside 2–6 % modulation and drift stays below ±1°.
   • Mask: ITU-R SM.1268 enforcement is selective attenuation, so loudness
     is preserved instead of clipped away.`;

const DEVREF = `DEVELOPER REFERENCE — block diagram & filter specification
================================================================

  ┌──────────┐   ┌──────────┐   ┌───────────────────────────┐
  │ Input    │──▶│ Repair   │──▶│ Dual-loop AGC             │
  │ 96 kHz   │   │ declip   │   │ slow: A150-500 R400-2000  │
  │ 32-bit f │   │ dequant  │   │ fast: A5-30 H20-100       │
  └──────────┘   │ de-hiss  │   │       R50-200             │
                 │ DC block │   │ + speech classifier       │
                 └──────────┘   └────────────┬──────────────┘
                                             ▼
                 ┌───────────────────────────────────────────┐
                 │ SENSUS — 6-band linear-phase crossover    │
                 │ 0-80 | 80-300 | 300-1k | 1k-3.5k |        │
                 │ 3.5k-7k | 7k-12k                          │
                 │ per band: thr, ratio, atk, hold, rel      │
                 │ timing = f(centroid, transient density)   │
                 └────────────────────┬──────────────────────┘
                                      ▼
                 ┌───────────────────────────────────────────┐
                 │ Imaging: per-band width, Haas 0-30 ms,    │
                 │ mono-safe fold, correlation control       │
                 └──────┬──────────┬──────────┬──────────┬───┘
                        ▼          ▼          ▼          ▼
                   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
                   │ FM/MPX │ │ DAB+   │ │ WEB    │ │ HD     │
                   │192 kHz │ │20 kHz  │ │16 kHz  │ │15-20k  │
                   └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
                       ▼          ▼          ▼          ▼
                  MPX/RTP     PCM→ETI   Icecast/SHOUTcast  HD pair

FILTER SPECIFICATION
  Stage                 Type              Spec
  --------------------- ----------------- ----------------------------------
  Sensus crossover      linear-phase FIR  8192 tap @ 96 kHz, Kaiser β=8.6,
                                          ±0.05 dB passband, >90 dB stopband,
                                          zero phase, group delay constant
  15 kHz brickwall LPF  linear-phase FIR  4096 tap, ±0.05 dB to 14.8 kHz,
                                          −80 dB by 15.2 kHz
  De-emphasis           IIR (matched)     50/75 µs, ±0.05 dB, phase-linearised
  Anti-image (clip OS)  linear-phase FIR  8×/16× oversample, −90 dB images
  True-peak limiter     4× OS FIR         BS.1770-4, attack 0.5 ms lookahead
  Crossover integrity   summing           |Σ bands − input| < 0.01 dB, 20 Hz-20 kHz

LATENCY BUDGET (96 kHz, 32-sample block)
  input→AGC        0.5 ms   Sensus FIR   42.7 ms (linear-phase, pre-ringing
  imaging          0.3 ms                windowed, no pre-echo above −70 dB)
  chains           1.2 ms   MPX @192k    0.4 ms
  ------------------------------------------------------------ total ~45 ms
  (DJ low-latency bypass path: 0.9 ms end-to-end)

QUALITY GATES (CI)
  IMD products < −60 dBc at 100 % modulation · pilot drift < ±1° ·
  RDS syndrome match on every block · loudness target ±0.1 LU ·
  no pre-echo above −70 dB relative to transient`;

export function StandaloneSection() {
  const [tab, setTab] = useState<DocTab>("build");

  const body =
    tab === "build"
      ? BUILD
      : tab === "deploy"
        ? DEPLOY
        : tab === "guide"
          ? GUIDE
          : DEVREF;

  const titles: Record<DocTab, [string, string]> = {
    build: ["Standalone build", "static linking · one executable per platform"],
    deploy: ["Portable deployment", "run from any folder or USB · no services"],
    guide: ["User guide", "deployment → tuning → platform setup → compliance"],
    devref: ["Developer reference", "block diagram · filter specification · latency"],
  };

  return (
    <RackUnit
      index="16"
      title="Standalone Edition — Build, Deploy & Documentation"
      eyebrow="single self-contained executable · no external runtime"
      accent={PATH_COLORS.web}
      right={
        <Segmented<DocTab>
          value={tab}
          onChange={setTab}
          accent={PATH_COLORS.web}
          size="sm"
          options={[
            { value: "build", label: "Build" },
            { value: "deploy", label: "Deploy" },
            { value: "guide", label: "User guide" },
            { value: "devref", label: "Dev reference" },
          ]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {[
          ["Windows 10+", "portable .exe /MT"],
          ["Linux", "single-file AppImage"],
          ["macOS", "Universal .app"],
          ["Runtime deps", "none"],
        ].map(([k, v]) => (
          <span
            key={k}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-[#1E232A] px-2.5 py-1.5"
          >
            <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
              {k}
            </span>
            <span className="font-mono text-[10px] text-foreground/85">{v}</span>
          </span>
        ))}
      </div>
      <p className="mb-4 text-[10px] leading-relaxed text-muted-foreground">
        The full documents ship with the source at{" "}
        <span className="font-mono text-foreground/80">
          native/docs/{" "}
        </span>
        — build-and-package.md, portable-deployment.md, user-guide.md and
        developer-reference.md.
      </p>

      <div className="flex items-center justify-between pb-2">
        <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {titles[tab][0]}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {titles[tab][1]}
        </span>
      </div>

      <pre className="max-h-[560px] overflow-auto rounded-lg border border-border/60 bg-[#12161B] p-4 font-mono text-[11px] leading-[1.62] whitespace-pre-wrap text-foreground/80">
        {body}
      </pre>
    </RackUnit>
  );
}
