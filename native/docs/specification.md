# TMAUDIO — Developer Specification (Part 1/2)

**Status:** design baseline for v2.0 · **Scope:** psychoacoustic engine, signal flow,
transmission stack, latency budget, performance targets.
Companion document: [`implementation.md`](./implementation.md) — preset parameter tables,
C/C++ skeleton, roadmap, validation plan.

This specification is written against the existing foundation app in this repository
(`native/src/**`, `src/` web console). Where the foundation differs from the target, the
divergence is stated explicitly rather than hidden.

---

## 0. Core mission and design rules

TMAUDIO is a unified, open broadcast stack: **audio processor + MPX/FM exciter and
encoder + multi-platform transmitter output**. Linux is the primary target; Windows and
macOS are first-class.

Design rules (non-negotiable):

1. **No black boxes.** Every algorithm has a documented difference equation, transfer
   function or block description in `native/docs/`. Every preset is a human-readable
   decimal text file (`.tm`), not a binary blob.
2. **Deterministic and testable.** DSP is split into pure blocks with fixed-size frames;
   each block has unit tests against vectors in `tests/vectors/`.
3. **Real-time safe.** No allocation, locking, syscall or logging on the audio thread.
4. **Measure, never invent.** Every meter value is a measurement of the signal or of the
   engine's own scheduling. No decorative telemetry anywhere (console or engine).
5. **Psychoacoustic decisions, not octaves.** Split points, gating and gain priorities all
   derive from the 24-band Bark model in §1.

### Foundation deltas (explicit)

| Foundation today | Target | Path |
|---|---|---|
| `SensusEngine.h` — 6-band linear-phase FIR split | 8-band psychoacoustic split driven by a 24-Bark analysis bank | §1.2, §2.7 (6→8 band migration is parameter-compatible: bands are re-derived from Bark groups, existing `.tm` files remap by frequency) |
| `MpxMatrix.h`, `LoImdClipper.h`, `Crc10.h` | kept as-is; extended with composite clipper at 64×–256× and BS.412 power control | §2.13 |
| Web console: 6-band MB3 readouts, R128 estimator | engine implements EBU Tech 3341 exactly; console remains an operator overview fed by engine telemetry | `implementation.md` §5 |
| No audio I/O | ALSA/JACK/PipeWire/PortAudio/AES67 | §4.3 |

---

## 1. Psychoacoustic engine — the foundation

### 1.1 Bark filter bank (24 critical bands)

Analysis bank, **not** an octave or third-octave set. Critical-band edges (Hz), 25 edges
→ 24 bands:

```
 0    1    2    3    4    5    6    7    8    9   10   11   12
 0  100  200  300  400  510  630  770  920 1080 1270 1480 1720
13   14   15   16   17   18   19   20   21   22   23   24
2000 2320 2700 3150 3700 4400 5300 6400 7700 9500 12000 15500 20000
```

Cross-check with the Bark formula
`z(f) = 13·arctan(0.00076·f) + 3.5·arctan((f/7500)²)` — every edge sits within 0.15 Bark
of an integer boundary.

**Implementation (recommended):** complex modulated Gabor/STFT filterbank, Hann window,
50 % overlap, 2048 points at 96 kHz analysis rate (21.3 ms window, 10.7 ms hop).
Per-band level = sum of bin magnitudes inside the band with a 0.5-bin raised-cosine taper
at the edges (kills scalloping loss at band boundaries).

*Why STFT and not 24 FIRs:* 24 linear-phase FIRs at 96 kHz cost ~12× the MACs of one
FFT, and their group delay (≥ 5 ms for a usable transition) would eat the latency budget
in §6. The analysis bank is only used to make decisions; **the decisions are applied by
the processing bank (§1.2 / §2.7), which has its own phase behaviour**.

**Alternatives accepted (documented trade):**

| Bank | Latency | Cost @96k | Use when |
|---|---|---|---|
| STFT/Gabor 2048/50 % (chosen) | 10.7 ms analysis centre | 1 FFT + window | default |
| Windowed-sinc FIR, 257 taps, Kaiser β=8 | 1.34 ms, 3 dB transition at 100 Hz bands | ~65 kMAC/ch/block | LOW-latency profile |
| γ-tone IIR bank (24 cascaded 2-pole) | ~0.2 ms, phase-dispersive | ~480 ops/ch/block | headless/embedded profile |

### 1.2 Processing split — 8 bands derived from Bark, not from octaves

The dynamics bank is formed by grouping Bark bands in threes, so every crossover is a
critical-band boundary:

| Band | Barks grouped | Range (Hz) | Character |
|---|---|---|---|
| B1 | 0–2 | 20 – 300 | bass |
| B2 | 3–5 | 300 – 630 | low-mid |
| B3 | 6–8 | 630 – 1080 | mid |
| B4 | 9–11 | 1080 – 1720 | mid |
| B5 | 12–14 | 1720 – 2700 | presence |
| B6 | 15–17 | 2700 – 4400 | presence |
| B7 | 18–20 | 4400 – 7700 | brilliance |
| B8 | 21–23 | 7700 – 15500 | air (15.5–20 kHz handled by B8 tail + brickwall) |

**Crossovers:** Linkwitz–Riley 4th order (two cascaded Butterworth-2, Q = 0.7071 per
section) — −6 dB at each corner, flat magnitude sum, 0° between branches → **phase-coherent
recombination**, so the summed output has no comb filter at the seams.

* Filter form: transposed direct-form-II biquads, 64-bit coefficient precision, 32-bit
  state (denormal flush each block).
* Transition: 24 dB/oct. Alternative high-resolution mode: 511-tap linear-phase FIR
  (0.02 dB passband ripple, 60 dB stopband, 5.3 ms @96 k) when the latency profile allows.
* Per-band delay alignment: each branch is delayed to the group delay of the slowest
  branch (measured, not assumed) before recombination.

### 1.3 Simultaneous and temporal masking

**Simultaneous masking — spreading function** across Bark distance `Δz`
(masker → masker, asymmetric, per-band thresholds in dB SPL-equivalent):

```
S(Δz) =  Δz ≥ 0 :  −10.0·Δz + 2.5·(Δz/2)²   (upward spread, shallower)
S(Δz) =  Δz < 0 :  −27.5·|Δz|                (downward spread, steep)
```

Implementation: matrix multiply `T_masked = T_own + S` over the 24-band vector (24×24
constant matrix, 576 MACs/block — negligible). Masking threshold per band
`T(b) = max over maskers of (L(m) + S(b−m))`, then

```
usable_headroom(b) = L(b) − T(b)          // dB above masking floor
```

**Temporal masking:**

| Region | Window | Slope |
|---|---|---|
| Pre-masking | 5 ms before a level step | −25 dB/ms |
| Post-masking | 20 ms strong, decays to 100 ms | −12 dB/ms first 20 ms, then −1.5 dB/ms |

Applied as a time-varying floor on the gain curve: gain may not move the band's noise
floor **below** the temporal mask, otherwise the removal itself becomes audible
(classic "pumping"/"breathing" artefact).

**Mask-aware gain rule (the core principle):**

```
gain_dyn(b)      = computed by the band dynamics (§2.7)
gain_mask_limit  = amount allowed by simultaneous + temporal masking headroom
gain_applied(b)  = clamp(gain_dyn, −headroom(b), 0)      // never unmask
```

*Reduction below the masking headroom is refused*, so noise reduction and downward
compression only act where the ear cannot hear the removal. Where a station wants
audible "clean-up", the operator raises the `mask_allowance` parameter (0–12 dB) — the
default is 0 dB (strict masking compliance).

### 1.4 ISO 226 equal-loudness weighting

ISO 226:2003 contours are implemented as a **per-Bark static gain table** (interpolated
at 40 phon reference, i.e. the −20 phon-ish contour typical of a monitoring level), and
applied to:

* noise-reduction thresholds (so LF/HF thresholds follow hearing sensitivity),
* the perceptual loudness control loop (not the compliance meter — see §1.5),
* metering annotation only (never to the compliance measurement).

Constraint: total applied weighting is limited to ±6 dB and is **flat at 1 kHz by
construction**, so it can be bypassed for A/B. A unit test asserts the table matches
published ISO 226 table values within ±1 dB at 11 test frequencies.

### 1.5 Perceptual loudness controller

Two loudness numbers exist and must never be confused:

| Name | Definition | Use |
|---|---|---|
| **Compliance loudness** | Strict ITU-R BS.1770-4: K-weighting (high-shelf +4 dB @ 1681 Hz, Q 0.707 + high-pass @ 38 Hz), 400 ms blocks, 75 % overlap, −70 LUFS absolute gate, −10 LU relative gate | metering, logging, export, preset targets |
| **Control loudness** | K-weighting **plus** ISO 226 and Bark-domain weighting, computed on momentary (400 ms) and short-term (3 s) windows | the AGC/limiter drive loop |

Rule: *psychoacoustic weighting happens before the integration windows* in the control
path; the compliance path stays bit-exact to the standard. LRA follows EBU Tech 3342
(3 s short-term values, −70 LUFS absolute gate, −20 LU relative gate, 10th–95th
percentile). Gating and block handling are implemented in `native/src/percept/Loudness.h`
with EBU Tech 3341 test cases as unit tests.

### 1.6 Adaptive per-band lookahead

| Band group | Lookahead (selectable) | Rationale |
|---|---|---|
| B1–B2 (20–630 Hz) | 1–3 ms | a 300 Hz cycle is 3.3 ms; 1–3 ms covers a significant phase range at low cost |
| B3–B6 (630 Hz–4.4 kHz) | 3–8 ms | protects consonants and plosives |
| B7–B8 (4.4–20 kHz) | 5–15 ms | transients here are short but perceptually sharp; more margin = cleaner limiting |

Total engine latency is selectable **2 ms … 90 ms** (budget in §6). Lookahead is
implemented as per-band fractional delay lines (Lagrange 3rd-order interpolation) so the
delay can move with the profile without clicks; the dry path is delayed by the maximum
band delay and recombined by crossfade when the profile changes.

### 1.7 Dual-envelope transient separation

Per band, two envelopes are tracked from the same rectified signal:

```
fast: attack 0.15 ms, release 12 ms   → transient detector / protection
slow: attack 30 ms,  release 180 ms   → loudness/density driver
```

* `transient_index(b) = fast(b) − slow(b)` in dB.
* Loudness-driven gain is computed from the slow envelope only; the fast envelope can
  *veto* a gain reduction for the length of the transient window (hold 5–20 ms), so drums
  and consonants pass through un-squashed while sustained material gets the density.
* Handover between the two paths is a constant-power crossfade over 8 ms.

### 1.8 Pre-echo suppression

Before applying a downward gain step, look ahead for a rising transient:

```
if (transient detected within lookahead) && (gain would drop before it):
    schedule the gain step to start AFTER the transient peak + hold
```

This is the AAC pre-echo control principle applied to a dynamics processor: gain
reductions never begin in the quiet span immediately before a transient (that span is
where pre-echo is audible).

### 1.9 Cochlear compression curves

Per-band input/output curve approximating basilar-membrane behaviour:

* linear to `knee` (default −42 dBFS),
* compression above the knee, ratio schedule rising with band index:
  B1–B2 2.0:1, B3–B6 1.8:1, B7–B8 1.5:1,
* level-dependent ratio increase: `ratio += 0.4·(L − L_ref)/20` above −18 dBFS,
* soft-knee width 6 dB, release 80–400 ms (longer for low bands, per critical-band
  integration time).

---

## 2. Signal flow — thirteen stages, in order

Each stage is an independent graph node (§4.4) with an enable, a wet/dry, and a
parameter block. Recommended algorithms and hard specs:

### 2.0 Full block diagram

```
 IN ─►[1 de-hum]─►[2 de-clip]─►[3 noise]─►[4 phase/mono]─►[5 wideband AGC]─►[6 spectral balancer]
                                                                     │
                          ┌──────────────────────────────────────────┘
                          ▼
 [7 8-band split dynamics]─►[8 dynamic EQ]─►[9 transient protect]─►[10 bass mgmt]─►[11 stereo]─►[12 true-peak]
         ▲                                                                                        │
         │                       psychoacoustic control loop (§1)                                │
         └── 24-band Bark analysis ─► simultaneous + temporal masking ─► gain limit + veto ───────┘
                                                                                                 │
                                                                                                 ▼
                          [13 path split] ─► FM/MPX │ streaming │ DAB+ │ AM │ HD   (detail in §3)
                                                                                                 │
        ┌───────────────┬──────────────────┬───────────────────┬────────────────────┬────────────┤
        ▼               ▼                  ▼                   ▼                    ▼            ▼
  AES3/analogue    µMPX RTP/UDP       HLS/DASH           ETI/EDI frame      C-QUAM AM TX   NRSC-5
  + composite      (192 kHz MPX)      Icecast           (ensemble)                            encoder
```

Filter and algorithm specifications per block are in the table below; masking,
lookahead and envelope details are in §1; per-stage latency in §5.

| # | Stage | Algorithm / spec | Key parameters (defaults) | Latency |
|---|---|---|---|---|
| 1 | De-hum / de-interference | Adaptive line enhancer: mains-frequency PLL (49.5–60.5 Hz, ±0.2 Hz) + 20 harmonic narrow notches (biquad, Q 40–120, adaptive depth 0–60 dB); fallback LMS with 256-tap noise-only reference | depth 18 dB, harmonics 12, auto on/off at −6 dB hysteresis | 1.0 ms |
| 2 | De-clipper | Detect flat-topped runs ≥ 4 samples within 0.4 dB of full scale → **predictive reconstruction**: LPC(24) prediction of the missing span + cubic slope matching at both edges, then 0.2 ms equal-power crossfade; spectral completion constrained to the masking threshold | run length 4, LPC order 24, confidence gate 0.7 | 2.5 ms |
| 3 | Adaptive noise reduction | Per-Bark MMSE-STSA / decision-directed SNR (Ephraim–Malah), 512-pt STFT @48 k (75 % overlap); oversubtraction α 1.0–2.0; floor β tied to the **masking threshold** (never subtract below it → no "underwater" artefacts); musical-noise suppression by 3-band post-smoothing | α 1.4, β 0.12, attack 3 ms, release 120 ms | 5.3 ms |
| 4 | Phase / mono compatibility | Mid-side domain: mono-sum meter, correlation tracker, width limiter; azimuth correction via ±90° Hilbert all-pass + 64-tap LMS (time-constant 10 ms) | mono-safe on, azimuth auto, width max 120 % | 1.5 ms |
| 5 | Wideband AGC | Gated AGC: noise-floor sensing (10th-percentile tracker, 5 s window), gate = floor + 12 dB; attack 5 ms / hold 80 ms / release 800 ms; speech "dry voice" mode = separate 300 Hz–3.4 kHz priority detector that pins speech near reference | target −18 dBFS, range ±12 dB, speech mode auto | 0.5 ms |
| 6 | Spectral balancer | Dynamic match to the station signature curve: current vs target spectrum in 1/6-octave bands, correction ≤ ±6 dB, adaptation 10–60 s, density-weighted (silent bands don't move) | curve from preset, speed 30 s, max ±6 dB | 1.5 ms (FIR 65 tap) |
| 7 | **8-band psychoacoustic split dynamics** | Per band (§1.2): compressor (ratio 1.5–6:1, soft knee 4–8 dB) + brickwall limiter (ratio ∞, lookahead = §1.6, release 40–200 ms). Gains from §1.3/§1.7 rules. Stereo-link modes: **full**, **mid-only** (link M, unlinked S — preserves image), **partial** (link factor 0–1) | thr per band, ratio 2.5–4.5, link `mid-only` | 0.3–1.5 ms (IIR) |
| 8 | Dynamic EQ overlay | Spectral-density driven peak/notch (up to 4 nodes): density = Bark-domain variance; attack 8 ms, release 300 ms, gain ±4 dB; only acts where density departs from the station curve | nodes 4, max ±4 dB | 0.4 ms |
| 9 | Transient preservation | Consumes §1.7 `transient_index`; plosive (2–8 kHz burst, <8 ms), drum (broadband step), consonant (4–6 kHz, 10–40 ms) detectors → up to 100 % gain-reduction veto, hold 5–20 ms | protect 80 %, hold 12 ms | 0 (control path) |
| 10 | Bass management | (a) mono-fold below configurable frequency; (b) harmonic excitement: 2nd+3rd harmonics generated at −34 dB, envelope-followed, band-limited < 160 Hz; (c) sub-synthesis: envelope-driven sine reconstruction below 45 Hz; (d) **pre-clipper bass shaping** so LF peaks are pre-curved before they reach the clipper | fold 120 Hz, excitement 18 %, sub-synth 0–30 % | 1.2 ms |
| 11 | Stereo enhancement | Width = f(correlation, density): centre-heavy material auto-collapses to ≤ 40 %; Haas decorrelation applied **only outside 300 Hz–5 kHz** (the intelligibility region), 8–20 ms on the side channel only | width 100 %, Haas 8 ms, region gate on | 1.0 ms |
| 12 | **True-peak limiter** | 8× / 16× polyphase oversampling (48-tap/phase, Kaiser β=9, ≥ 90 dB stopband), inter-sample detector, lookahead 1.5–5 ms, 4th-order Butterworth gain smoothing (no overshoot, per ITU-R BS.1770 Annex 2 test), release 60–200 ms adaptive to spectrum | ceiling −1.0 dBTP, attack 0 ms (lookahead), release 90 ms | 2.0 ms |
| 13 | Path split | see §3 | — | see §3 |

*Order rationale:* restoration first (so later stages never see corrupt peaks), then
level (AGC before any spectral decision), then station signature, then band dynamics,
then density-aware overlays, then transient protection (immediately before the clipper so
its protection window is still valid), bass and image conditioning, and finally true-peak
limiting as the last word before encoding.

---

## 3. Path split and outputs

```
                        ┌──────── FM / MPX path ───────────────────────────┐
                        │ pre-emphasis 50/75/15 µs/none                    │
                        │  → composite clipper 64×…256× (phase-linear)     │
  stage 12 ─────────────┤  → MPX power control (ITU-R BS.412, no ducking)  │──► stereo encoder
                        │  → 19 kHz pilot + 57 kHz RDS/SCA notches         │      → RF/exciter out
                        │  → pilot level/phase trim, MPX dev monitor       │      (AES3 / analogue / µMPX RTP)
                        └──────────────────────────────────────────────────┘
                        ┌──────── streaming ───────────────────────────────┐
                        │ codec pre-conditioning filter (16 kHz @128k…)    │──► HLS / DASH / Icecast
                        │ low-bitrate true-peak limiter, TNS pre-shaping   │
                        └──────────────────────────────────────────────────┘
                        ┌──────── DAB+ ────────────────────────────────────┐
                        │ band-limit → loudness align → ETI/EDI frame      │──► ensemble
                        └──────────────────────────────────────────────────┘
                        ┌──────── AM ──────────────────────────────────────┐
                        │ asymmetric clipper (positive/negative independent)│──► C-QUAM option
                        │ NRSC AM curve, sideband mask conformance         │      → AM TX
                        └──────────────────────────────────────────────────┘
                        ┌──────── HD (hybrid) ─────────────────────────────┐
                        │ hybrid analog/digital gain balance, emission     │──► NRSC-5 encoder
                        │ mask policing, HDC+ spectral shaping             │
                        └──────────────────────────────────────────────────┘
```

### 3.1 FM / MPX path detail

1. **Pre-emphasis** (50 µs Europe / 75 µs Americas / 15 µs Japan AM-FM / none) applied to
   the audio *before* clipping, matching the foundation's documented convention
   (`native/docs/developer-reference.md`). De-emphasis is available for monitor only.
2. **Composite clipper** — clips the L+R/± sub-multiplex at 64× (12.288 MHz @192 kHz) or
   256× (49.152 MHz) oversampling: halfband cascade, symmetrical or
   selective-asymmetrical shaping (asymmetric mode reduces audible IM by weighting the
   positive/nreshold independently), then anti-alias halfband back to 192 kHz. Cost
   budget in §7.
3. **MPX power control** per ITU-R BS.412: measures occupied multiplex power, control
   loop 2–10 s, ±3 dB, gain applied only to non-critical multiplex regions so no
   audible pumping (never a broadband duck).
4. **Pilot & subcarrier protection:** 19 kHz pilot (default 9 % of deviation, phase-locked
   to the same NCO as 38/57 kHz, drift < ±1°), notches at 19/38/57 kHz in the clipper
   feedback path so clipping cannot inject energy into pilot/RDS regions.
5. **RDS encoder:** 57 kHz BPSK, 1187.5 bps (57 k / 48), biphase shaping, raised-cosine
   filter (α = 0.5), injection 4 % of total deviation (2 %–6 % range), CRC-10 +
   offset words per EN 50067 / IEC 62106 (implemented today in `src/rds/Crc10.h`).
   Fields: PS (8), DLS / RadioText (64 characters, UCS-2 **and** ISO-8859-1 modes), PI,
PTY, TP/TA, AF, CT (group 4A, NTP-disciplined clock), EON, M/S — including the DLS
streaming metadata feed from the playout system (HTTP PUT / JSON).
6. **Outputs:** 192 kHz float MPX (µMPX RTP/UDP), AES3 at the chain rate, analogue L/R
   + composite (where hardware exposes it).

### 3.2 True-peak compliance

Ceilings: FM −1.0 dBTP, HD −2.0 dBTP, DAB+ −1.0 dBTP, streaming −1.0 dBTP,
AM −0.5 dB (peak, envelope dependent). Overshoot verified with the BS.1770 Annex 2
stimulus set; target ≤ 0.1 dB measured overshoot at 4×, 8×, 16× test rates.

---

## 4. Monitoring, control and architecture

### 4.1 Metering (all measured, never modelled)

LUFS-I / LUFS-S / LUFS-M, LRA (Tech 3342), true peak, **PLR** = TP − LUFS-I,
**crest factor** = TP − RMS, modulation index %, MPX power (BS.412), pilot %, correlation,
loudness distribution histogram (1 LU bins, session + 24 h), per-band gain-reduction
history, safety counters (clip / limiter / dropout / underrun) with window selection.

### 4.2 Analysis

FFT 4096 (Hann, 75 % overlap) + Bark-scale spectrogram (24 rows, log time);
before/after difference view (post-DSP minus pre-DSP in dB, ±12 dB scale); per-band GR
overlay; click-any-block signal-flow diagram wired to live parameters.

### 4.3 I/O

* Backends: ALSA (primary), JACK, PipeWire/Pulse, PortAudio (Windows/macOS).
* AoIP: AES67/Ravenna (RTP + PTP IEEE 1588, 48 kHz, 125 µs/1 ms packets), Dante via
  AES67 interoperability (native Dante module optional, closed SDK behind a build flag).
* Clock: PTP (gPTP profile) preferred, word-clock/BWC otherwise; sample-rate conversion
  by polyphase windowed-sinc, >140 dB SNDR.

### 4.4 Modular DSP graph

Directed acyclic graph of nodes with typed ports; each node: `prepare()`, `process()`,
`reset()`, `bypass()`, parameter schema. Reordering and per-node bypass are runtime-safe
(dry/wry crossfade 10 ms). Scripting hooks: Lua 5.4 (sandboxed, no I/O, 1 ms budget per
block) and Python via a side-channel process for offline/preset authoring only.

### 4.5 Control plane

* REST (JSON) + WebSocket (binary parameter frames, 20 Hz snapshot + event push).
* HTML5 remote UI (the existing `src/` console is the design reference).
* Multi-user permissions: viewer / operator / engineer / admin, per-endpoint ACL,
  session tokens with expiry, audit entries in the event log (categories INFO, AUDIO,
  DSP, ROUTING, WARNING, ERROR).
* Headless mode: no GUI, TOML config + API only, systemd unit examples in
  `native/docs/portable-deployment.md`.
* Preset synchronisation across a network: NTP-disciplined schedule, versioned preset
  hashes, atomic switch with rollback.

### 4.6 Portability

C++20 core (no exceptions/RTTI on the audio path), SIMD kernels: AVX2/FMA (x86-64),
NEON (ARM64), SSE4.2 fallback, scalar reference for tests. Zero mandatory runtime
dependencies — static linking by default (`native/CMakeLists.txt` already sets this).

### 4.7 Transmitter telemetry and alerting

Ingested once per second from the transmitter/exporter (HTTP JSON, SNMP, or serial /
dry-contact gateway) and published as measured values only:

| Channel | Derivation / range | Alert (hysteresis, configurable) |
|---|---|---|
| Forward power `Pf` | reported, W or dBk | warn < −1 dB vs 5-min median |
| Reflected power `Pr` | reported, W | warn > 10 % of `Pf` |
| **VSWR** | `Γ = √(Pr/Pf)`, `VSWR = (1+Γ)/(1−Γ)` | warn > 1.50, error > 2.00 (latched 60 s) |
| Transmitter gain | `Pf / drive`, dB, 5-min trend | drift > ±1.0 dB/24 h |
| PA temperature / supply | as reported | manufacturer thresholds |
| RF deviation / MPX power | from the exciter and our own BS.412 meter | cross-check mismatch > 1 dB |

All state changes are written to the event log (categories `ROUTING`, `WARNING`,
`ERROR`) with 90-day retention, and alert escalation is available via webhook/email.
Telemetry never fabricates a value: channels the transmitter does not report read as
`unavailable`, not zero.

---

## 5. Latency budget per stage

Three selectable profiles. All values in milliseconds, measured at 48 kHz (FM MPX path
runs internally at 192 kHz; resampler cost included).

| Stage | LOW (≈2 ms) | STANDARD (≈10 ms) | MAX (≈90 ms) |
|---|---|---|---|
| Input resample / sync | 0.20 | 0.35 | 0.35 |
| 1 De-hum (pass-through mode) | 0.10 | 1.00 | 1.00 |
| 2 De-clipper | 0.00 | 2.50 | 2.50 |
| 3 Noise reduction (time-domain mode) | 0.40 | 5.30 | 5.30 |
| 4 Phase / mono correction | 0.40 | 1.50 | 1.50 |
| 5 Wideband AGC | 0.50 | 0.50 | 0.50 |
| 6 Spectral balancer | 0.00 | 1.50 | 1.50 (FIR 65 tap) |
| 7 Band dynamics (IIR bank / FIR bank) | 0.30 | 1.20 | 5.30 (511-tap linear phase) |
| 8 Dynamic EQ | 0.40 | 0.40 | 0.40 |
| 9 Transient protection (control) | 0.00 | 0.00 | 0.00 |
| 10 Bass management | 0.60 | 1.20 | 1.20 |
| 11 Stereo enhancement | 0.50 | 1.00 | 1.00 |
| 12 True-peak limiter | 0.60 | 2.00 | 5.00 |
| Lookahead (band-aligned, max group) | 1.50 | 8.00 | 15.00 |
| 13a FM pre-emphasis + composite clipper | 1.20 | 1.60 | 4.00 |
| 13b Codec pre-conditioning | 1.00 | 2.00 | 4.00 |
| **Sum (13a path)** | **7.80** | **29.55** | **44.05** |
| Output device buffer (64/128/256) | 1.33 / 2.67 / 5.33 | same | same |
| **End-to-end, typical** | **≈9.1** | **≈32.2** | **≈49.4** |

*The selectable 2–90 ms range refers to processing latency; profiles are realised by
combinations of the rows above. LOW is achieved by bypassing stages 1/2/6 (documented
as a degradation, shown in the UI), MAX by adding the FIR banks, MAX lookahead and
16× true-peak oversampling. Every profile must be verified by impulse measurement in
`tests/latency_probe` before release — the table is a design target, not a claim.*

---

## 6. Reference architecture (process model)

```
┌────────────────────┐   shared-memory / WS    ┌──────────────────────────┐
│ GUI process        │◄───────────────────────►│ Engine process           │
│ (Qt/console/web)   │   parameter frames      │  T1 audio I/O (RT)       │
└────────────────────┘   telemetry snapshots   │  T2 DSP graph (RT)       │
┌────────────────────┐                         │  T3 metering (normal)    │
│ Remote UI (HTML5)  │◄────── REST/WS ────────►│  T4 control/net (normal) │
└────────────────────┘                         └──────────────────────────┘
```

* T1/T2: `SCHED_FIFO` where permitted, preallocated, lock-free SPSC rings between
  stages, block size 64 frames (1.33 ms @48 k) — processing is done in 64-frame blocks
  to keep coefficient/state hot in L1.
* T3: consumes a ring from T2 (drop-allowed), publishes meter snapshots at 20 Hz.
* T4: HTTP/WS, config, preset store, logging, NTP. Never touches audio memory.
* Telemetry ring is **single-writer, lock-free, drop-on-full** — control plane can never
  block the audio thread.

---

## 7. Performance targets

| Metric | Target | Notes |
|---|---|---|
| Full chain (all 13 stages, stereo, 48 kHz) | ≤ 8 % of one 3.5 GHz Zen3 core | measured with `perf`, release build |
| FM MPX composite clipper at 64× (12.288 MHz) | ≤ 1.5 % core | 256× profile: ≤ 4 % core |
| 24-band Bark analysis + masking | ≤ 1.5 % core | one FFT + 576-MAC spread matrix |
| True-peak limiter 16× | ≤ 1.0 % core | polyphase, shared across channels |
| Metering (all loudness windows + histogram) | ≤ 0.5 % core | T3 thread |
| Total, headless FM chain @48 k | ≤ 12 % core | hard CI regression gate |
| RAM (engine, RSS) | ≤ 128 MB | incl. 4 × 30 min history buffers |
| RT allocations / locks / syscalls after `prepare()` | **0** | asserted by test harness |
| Control-plane latency (button → telemetry) | ≤ 150 ms p95 | |
| Preset morph / switch | click-free, ≤ `preset_crossfade_ms` (50–4000 ms) | equal-power |
| Determinism | bit-identical output for identical input + config across runs | golden-vector test |

**CI gates:** `ctest` unit suite, golden-vector bit-exactness, latency probe, CPU
benchmark with a 2 % regression threshold, RT-safety assertion run, EBU Tech 3341/3343
loudness conformance, BS.1770 Annex 2 true-peak overshoot, BS.412 MPX power, SM.1268
spectrum mask.

---

## 8. Deliverable index

| Deliverable | Location |
|---|---|
| Block diagram + algorithms + filter specs | this document §2, §3, §1 |
| Latency budget per stage | this document §5 |
| Performance benchmarks & thread model | this document §6, §7 |
| Initial parameter values per preset | [`implementation.md`](./implementation.md) §1 |
| C/C++ DSP skeleton with prototypes | [`implementation.md`](./implementation.md) §2 |
| Implementation roadmap | [`implementation.md`](./implementation.md) §3 |
| Validation & test plan | [`implementation.md`](./implementation.md) §4 |
