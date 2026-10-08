# TMAUDIO — Implementation Package (Part 2/2)

**Companion to [`specification.md`](./specification.md).** Contains the three remaining
deliverables: initial parameter values per preset, the C/C++ DSP skeleton with function
prototypes, and the implementation roadmap with its validation plan.

---

## 1. Initial parameter values per preset

Band split is identical for every preset (8 bands derived from the 24-Bark bank,
`specification.md` §1.2):

`20–300 · 300–630 · 630–1080 · 1080–1720 · 1720–2700 · 2700–4400 · 4400–7700 · 7700–15500 Hz`

Band values are listed in band order B1…B8. Every value is in range and maps onto an
existing control in the foundation console (`src/pages/console/**`, `.tm` preset files).

### 1.1 Preset family baselines

| Parameter | FM Competitive (CHR) | FM Natural | DAB+ | Streaming 128 | HD Hybrid | AM |
|---|---|---|---|---|---|---|
| Loudness target (LUFS) | **−9.0** | −14.0 | −23.0 | −14.0 | −16.0 | −10.0 |
| True-peak ceiling (dBTP) | −1.0 | −1.0 | −1.0 | −1.0 | −2.0 | −0.5 |
| PLR target (dB) | 8.0 | 11.0 | 10.0 | 9.0 | 9.0 | 12.0 |
| Crest factor target (dB) | 6.5 | 10.0 | 7.5 | 7.0 | 7.5 | 11.0 |
| De-clipper (%) | 60 | 40 | 30 | 50 | 40 | 70 |
| Noise reduction α / β | 1.2 / 0.15 | 1.0 / 0.20 | 1.4 / 0.10 | 1.4 / 0.12 | 1.2 / 0.15 | 1.6 / 0.08 |
| Mask allowance (dB) | 3.0 | 0.0 | 2.0 | 2.0 | 1.0 | 4.0 |
| AGC target (dBFS) | −18.0 | −20.0 | −22.0 | −19.0 | −20.0 | −16.0 |
| AGC A/H/R (ms) | 5 / 80 / 800 | 8 / 100 / 1200 | 5 / 80 / 900 | 6 / 90 / 1000 | 5 / 80 / 800 | 4 / 60 / 700 |
| AGC speech mode | auto | off | auto | off | auto | **on** |
| Spectral balancer (dB max) | ±4.0 | ±6.0 | ±3.0 | ±3.0 | ±4.0 | ±5.0 |
| Band thresholds B1…B8 (dBFS) | −30,−27,−24,−22,−21,−20,−19,−18 | −24,−20,−17,−15,−14,−13,−12,−12 | −26,−23,−20,−18,−17,−16,−15,−15 | −25,−22,−19,−17,−16,−15,−14,−14 | −27,−24,−21,−19,−18,−17,−16,−16 | −28,−25,−22,−20,−19,−18,−17,−17 |
| Band ratios B1…B8 (:1) | 5.0,4.5,5.0,5.5,6.0,6.5,6.0,5.0 | 3.0,2.5,3.0,3.5,4.0,4.5,4.0,3.0 | 4.0,3.5,4.0,4.5,5.0,5.5,5.0,4.0 | 3.5,3.0,3.5,4.0,4.5,5.0,4.5,3.5 | 4.5,4.0,4.5,5.0,5.5,6.0,5.5,4.5 | 3.5,3.0,3.5,4.0,4.5,5.0,4.5,3.5 |
| Band A/R (ms) low→high | 12/180 → 4/90 | 20/300 → 6/140 | 14/220 → 5/100 | 16/240 → 5/110 | 10/160 → 4/80 | 12/200 → 5/100 |
| Stereo link | mid-only | full | mid-only | mid-only | mid-only | full (mono) |
| Dynamic EQ nodes / max | 4 / ±3.0 dB | 4 / ±4.0 dB | 3 / ±2.5 dB | 3 / ±2.5 dB | 4 / ±3.0 dB | 2 / ±3.0 dB |
| Transient protect (%) | 85 | 70 | 80 | 80 | 85 | 60 |
| Bass fold (Hz) / excitement | 120 / 22 % | 100 / 12 % | 120 / 18 % | 140 / 15 % | 120 / 20 % | 150 / 10 % |
| Sub-synthesis (%) | 18 | 0 | 12 | 10 | 15 | 0 |
| Width max / Haas | 110 % / 10 ms | 100 % / 0 ms | 110 % / 8 ms | 105 % / 8 ms | 110 % / 10 ms | n/a (mono) |
| True-peak A/R (ms) | 90 | 120 | 90 | 100 | 80 | 150 |
| Pre-emphasis | 50 µs (EU) / 75 µs (US) | same | n/a | n/a | n/a | NRSC AM curve |
| Composite clip drive (dB) | 8.0 | 3.5 | — | — | — | — |
| Composite clip oversample | 64× | 64× | — | — | — | — |
| MPX power target (BS.412) | 100 % | 92 % | — | — | — | — |
| Pilot / RDS injection | 9.0 % / 4.0 % | 9.0 % / 3.5 % | — | — | — | — |
| Codec pre-conditioning | — | — | 16 kHz shelf, TNS on | 15.5 kHz LPF, TNS on | HDC+ shaping | — |
| Latency profile | STANDARD | MAX | STANDARD | LOW | STANDARD | LOW |

### 1.2 Additional factory entries

Same schema as §1.1, deltas only:

| Preset | Deltas from its family baseline |
|---|---|
| FM 50 µs / FM 75 µs | emphasis 50 / 75 µs; MPX power 100 / 95 %; identical dynamics |
| FM Speech & News | speech mode **on**, transient 90 %, B1 ratio 4.0, width 95 % |
| FM Ultra-Clean | NR α 1.8, mask allowance 0 dB, de-clip 80 % |
| Web 128 | as Streaming 128 + 15 kHz LPF, crest 7.0 dB, −1.0 dBTP |
| Web 64 / Web 320 | same chain, bandwidth 13.5 / 20 kHz, targets −15.0 / −13.0 LUFS |
| DAB+ Speech | speech mode on, target −21.0 LUFS |
| HD Hybrid | ceiling −2.0 dBTP, hybrid balance 0 dB, mask policing on |
| AM C-QUAM | asymmetric clipper on, sideband mask per regional rule, crest 11 dB |

### 1.3 Master character overlay (console unit 01)

The console's CLEAN / BALANCED / FORWARD / POWER / MAX control is a **coordinated
overlay on the family baseline** — it writes only parameters that already exist:

| Character | AGC slow+fast (dB) | Threshold offset | Ratio scale | Band gain tilt | Coherence | Clip drive | Extras (enh / dynEQ / bass) |
|---|---|---|---|---|---|---|---|
| CLEAN | 2 + 1 | +2 dB (lazier) | ×0.8 | flat | 96 % | 1.0 dB | 0 / 0 / 0 |
| BALANCED | 4 + 2 | 0 (baseline) | ×1.0 | baseline | 94 % | 3.5 dB | 1.5 / 30 / 25 |
| FORWARD | 6 + 3 | −1 dB | ×1.05 | +2 dB tilt 1–7 kHz | 92 % | 5.0 dB | 3.0 / 55 / 20 |
| POWER | 9 + 5 | −3 dB | ×1.2 | +2.5 dB LF / +1 dB HF | 90 % | 7.5 dB | 4.5 / 70 / 45 |
| MAX | 13 + 8 | −6 dB | ×1.35 | +4 dB LF / +1.5 dB HF | 88 % | 10.0 dB | 6.0 / 85 / 70 |

Values are clamped to control ranges so no preset can drive a UI control out of bounds.

---

## 2. C/C++ DSP skeleton

### 2.1 Tree (new files marked •, existing foundation files noted)

```
native/src/
├── core/            • block.h • buffer.h • simd.h • graph.h • params.h • ring.h • log.h
├── percept/         • bark_bank.h • masking.h • iso226.h • loudness.h • transient.h • lookahead.h
├── stages/          • dehum.h • declip.h • denoise.h • phasecorr.h • agc.h
│                    • spectral_balancer.h • band_dynamics.h • dynamic_eq.h
│                    • bass.h • stereo_width.h • true_peak.h
├── chains/
│   ├── fm/          MpxMatrix.h (exists) · LoImdClipper.h (exists)
│   │                • composite_clipper.h • mpx_power.h • pilot.h • fm_path.h
│   ├── streaming/   • streaming_path.h
│   ├── dab/         • dab_path.h
│   ├── am/          • am_path.h
│   └── hd/          • hd_path.h
├── rds/             Crc10.h (exists) • encoder.h • dls.h
├── io/              • alsa.h • jack.h • portaudio.h • aes67.h • resampler.h • clock.h
├── control/         • engine.h • preset_store.h • rest.h • ws.h • auth.h • events.h
├── script/          • lua_hooks.h • python_hooks.h
└── sensus/          SensusEngine.h (exists — extends to 8 bands, bark-driven)
```

### 2.2 Core types

```c
/* core/block.h — the only container that crosses the audio thread */
#define TM_MAX_CH 8
typedef struct tm_fmt  { double sample_rate; int channels; int frames; } tm_fmt;
typedef struct tm_block { float* ch[TM_MAX_CH]; int frames; int channels; int64_t t0; } tm_block;
typedef struct tm_gain { const char* node; int band; float db; } tm_gain;   /* one stage's actuation */

/* core/graph.h — DAG of nodes; prepare once, process with zero allocation */
typedef struct tm_node tm_node;
typedef struct tm_graph tm_graph;
typedef struct tm_node_vtbl {
  int   (*prepare)(tm_node*, const tm_fmt*);          /* alloc/coeffs, non-RT   */
  void  (*process)(tm_node*, tm_block* io);           /* RT, no alloc/lock/log  */
  void  (*reset)(tm_node*);                           /* flush state            */
  float (*latency_ms)(const tm_node*);                /* for the §5 budget      */
} tm_node_vtbl;

tm_graph* tm_graph_create(void);
int   tm_graph_add   (tm_graph*, const tm_node_vtbl*, const char* name, void* state);
int   tm_graph_connect(tm_graph*, const char* from, const char* to, int port);
void  tm_graph_bypass(tm_graph*, const char* name, int enable, float fade_ms);
int   tm_graph_reorder(tm_graph*, const char* name, int new_index);   /* 10 ms equal-power */
float tm_graph_latency_ms(const tm_graph*);
void  tm_graph_process(tm_graph*, tm_block* io);       /* RT */
void  tm_graph_destroy(tm_graph*);
```

### 2.3 Psychoacoustic core

```c
/* percept/bark_bank.h — 24 critical bands, STFT/Gabor (see spec §1.1) */
typedef enum tm_bark_mode { TM_BARK_STFT, TM_BARK_FIR, TM_BARK_GAMMATONE } tm_bark_mode;
typedef struct tm_bark_bank tm_bark_bank;
typedef struct tm_bark_frame {
  float level_db[24];     /* band energy, K-weighted reference */
  float mask_db[24];      /* simultaneous+temporal masking threshold */
  float headroom_db[24];  /* level − mask: the mask-aware gain budget */
  float transient_index;  /* global fast−slow index */
} tm_bark_frame;

tm_bark_bank* tm_bark_create(const tm_fmt*, tm_bark_mode);
void tm_bark_analyze(tm_bark_bank*, const tm_block* in, tm_bark_frame* out);
void tm_bark_destroy(tm_bark_bank*);

/* percept/masking.h — spreading matrix + temporal gates */
typedef struct tm_masking tm_masking;
void  tm_masking_init(tm_masking*, const float slope_up[24], const float slope_down[24]);
void  tm_masking_step(tm_masking*, const tm_bark_frame* in, float allowance_db);
float tm_masking_gain_limit(const tm_masking*, int band);   /* dB, never unmask */
float tm_masking_temporal_floor(const tm_masking*, int band, float now_ms);

/* percept/iso226.h */
void  tm_iso226_table(float out_gain_db[24], float phon);    /* ±6 dB clamp, 0 dB @1 kHz */
float tm_iso226_apply(int band, float level_db, float phon); /* pure, unit-tested */

/* percept/loudness.h — compliance path is bit-exact BS.1770-4 / Tech 3341 */
typedef struct tm_loudness tm_loudness;
void  tm_loudness_push(tm_loudness*, const tm_block* in);
float tm_loudness_momentary(const tm_loudness*);    /* LUFS, 400 ms */
float tm_loudness_shortterm(const tm_loudness*);    /* LUFS, 3 s    */
float tm_loudness_integrated(const tm_loudness*);   /* gated, Tech 3341 */
float tm_loudness_lra(const tm_loudness*);          /* LU, Tech 3342    */
float tm_loudness_control(const tm_loudness*);      /* + ISO226/Bark weighting (control path only) */
float tm_true_peak(const tm_loudness*, int ch, int oversample);   /* 4/8/16× */

/* percept/transient.h + lookahead.h */
typedef struct tm_envelope { float fast_db, slow_db, transient_index; } tm_envelope;
void  tm_envelope_step(tm_envelope*, const float* x, int n, const tm_env_cfg*);
float tm_lookahead_delay_ms(const tm_block*, int band);            /* per-band 1–15 ms */
void  tm_pre_echo_schedule(float* gain_curve, int n, int transient_pos, float hold_ms);
```

### 2.4 Stages

```c
/* stages/dehum.h  */ tm_dehum*   tm_dehum_create(const tm_fmt*, float mains_hz, int harmonics);
                      void        tm_dehum_process(tm_dehum*, tm_block* io);
/* stages/declip.h */ tm_declip*  tm_declip_create(const tm_fmt*, int run_len, int lpc_order);
                      float       tm_declip_process(tm_declip*, tm_block* io);   /* returns % repaired */
/* stages/denoise.h*/ tm_denoise* tm_denoise_create(const tm_fmt*, const tm_denoise_cfg*);
                      void        tm_denoise_process(tm_denoise*, tm_block* io,
                                                     const tm_bark_frame*, const tm_masking*);
/* stages/phasecorr.h */ tm_phase* tm_phase_create(const tm_fmt*);
                      void        tm_phase_process(tm_phase*, tm_block* io, float* correlation);
/* stages/agc.h    */ tm_agc*     tm_agc_create(const tm_fmt*, const tm_agc_cfg*);
                      void        tm_agc_process(tm_agc*, tm_block* io, float* gain_db);
/* stages/band_dynamics.h — spec §2 stage 7 */
typedef enum tm_link_mode { TM_LINK_FULL, TM_LINK_MID, TM_LINK_PARTIAL } tm_link_mode;
typedef struct tm_band_cfg { float thr_db, ratio, atk_ms, hold_ms, rel_ms, knee_db, makeup_db; } tm_band_cfg;
tm_band_dynamics* tm_band_create(const tm_fmt*, const tm_band_cfg[8], tm_link_mode, float link_amt);
void  tm_band_set(tm_band_dynamics*, int band, const tm_band_cfg*);      /* RT-safe param write */
void  tm_band_process(tm_band_dynamics*, tm_block* io, const tm_bark_frame*, const tm_masking*);
void  tm_band_gr(const tm_band_dynamics*, float out_gr_db[8]);           /* live telemetry */
/* stages/dynamic_eq.h, bass.h, stereo_width.h — same create/process/set shape */

/* stages/true_peak.h — spec §2 stage 12 */
typedef struct tm_limiter_cfg { float ceiling_dbtp, release_ms; int oversample, lookahead; } tm_limiter_cfg;
tm_limiter* tm_limiter_create(const tm_fmt*, const tm_limiter_cfg*);
void  tm_limiter_process(tm_limiter*, tm_block* io, float* gr_db);
float tm_limiter_overshoot_meas(const tm_limiter*);   /* self-check vs BS.1770 A2 */
```

### 2.5 Transmission chains

```c
/* chains/fm/composite_clipper.h + chains/fm/fm_path.h */
typedef enum tm_clip_mode { TM_CLIP_SYM, TM_CLIP_ASYM } tm_clip_mode;
typedef struct tm_mpx_cfg {
  int emphasis_us;            /* 50 | 75 | 15 | 0 */
  float pilot_pct, rds_injection_pct, subcarrier_pct;
  float clip_drive_db; int clip_oversample; tm_clip_mode clip_mode;  /* 64…256× */
  float bs412_target_pct; int bs412_window_s;
} tm_mpx_cfg;
typedef struct tm_mpx_telemetry {
  float mpx_power_pct, pilot_pct, dev_pct, clip_gr_db, im_headroom_db;
} tm_mpx_telemetry;
tm_mpx* tm_mpx_create(const tm_fmt*, const tm_mpx_cfg*);      /* uses MpxMatrix.h, LoImdClipper.h */
void    tm_mpx_process(tm_mpx*, const tm_block* audio, tm_block* mpx192k, tm_mpx_telemetry* t);
void    tm_mpx_set(tm_mpx*, const tm_mpx_cfg*);
/* chains/{streaming,dab,am,hd}_path.h — same shape:
   tm_<path>_create / _process / _set / _telemetry */

/* rds/encoder.h — wraps existing Crc10.h */
typedef struct tm_rds tm_rds;
int   tm_rds_set_field(tm_rds*, const char* key, const char* utf8);  /* PS, RT, PI, PTY, CT… */
void  tm_rds_process(tm_rds*, float* biphase_out, int n, float pilot_phase);
```

### 2.6 I/O, control, scripting

```c
/* io/* — RT callback contract: prepare() off-thread, process() alloc-free */
typedef void (*tm_audio_cb)(const tm_block* in, tm_block* out, void* user);
int   tm_io_open(const char* backend /* alsa|jack|pw|portaudio|aes67 */, const tm_fmt*, tm_audio_cb, void*);
void  tm_io_close(int handle);

/* control/engine.h */
typedef struct tm_engine tm_engine;
typedef struct tm_engine_cfg { const char* preset_path; int block; int threads; int headless; } tm_engine_cfg;
tm_engine* tm_engine_create(const tm_engine_cfg*);
int  tm_engine_start(tm_engine*);            /* spawns T1..T4 */
void tm_engine_stop(tm_engine*);
int  tm_engine_load_preset(tm_engine*, const char* path, float morph_ms);
int  tm_engine_set_param(tm_engine*, const char* node, const char* key, float v, float ramp_ms);
int  tm_engine_bypass(tm_engine*, const char* node, int on, float ramp_ms);
void tm_engine_telemetry(tm_engine*, tm_telemetry* out);   /* snapshot, non-RT */

/* control/{rest,ws,events}.h */
int  tm_rest_start(uint16_t port, tm_engine*, const tm_auth_cfg*);
int  tm_ws_attach(tm_engine*, void (*cb)(const tm_telemetry*, void*), void* user);
void tm_event_log(tm_engine*, tm_severity, const char* cat, const char* fmt, ...);

/* script/lua_hooks.h */
int  tm_lua_load(tm_engine*, const char* path);            /* sandboxed, 1 ms/block budget */
int  tm_lua_on_block(tm_engine*, int node, const char* fn);

/* script/python_hooks.h — side-channel only (offline authoring, analysis, preset
   generation); never entered from the RT path by design */
int  tm_python_init(const char* interpreter, const char* search_path);
int  tm_python_call(const char* module, const char* fn,
                    const tm_param_set* in, tm_param_set* out);
```

**RT contract (enforced by `tests/rt_audit`):** anything reachable from
`tm_graph_process` / `tm_*_process` must perform zero heap allocation, zero mutex
acquisition, zero syscalls, no denormal-producing divisions (FTZ/DAZ enabled), and no
`printf`. Violations fail CI.

---

## 3. Implementation roadmap

| Phase | Weeks | Scope | Exit criteria |
|---|---|---|---|
| **P0 Foundations** | 1–2 | Build/CI matrix (Linux/mac/Win, AVX2+NEON+scalar), block engine, ring buffers, SIMD helpers, test harness, golden-vector framework, RT audit tool | `ctest` green on all targets; RT audit passes on a stub graph; scalar==SIMD bit-exact |
| **P1 Perception core** | 3–7 | 24-Bark bank (STFT + FIR variants), spreading/temporal masking, ISO 226 table, BS.1770-4/Tech 3341/3342 loudness, true-peak detector, envelope/transient engine, lookahead, latency probe | EBU Tech 3341/3343 vectors pass; ISO 226 table within ±1 dB; Bark edges within 0.15 Bark; measured latency within ±10 % of spec §5 |
| **P2 Dynamics** | 8–13 | De-hum, de-clipper, NR, phase/mono, AGC, spectral balancer, 8-band split dynamics with mask-aware gains, dynamic EQ, transient veto, bass management, stereo enhancement, crest controller, true-peak limiter | Golden vectors bit-exact; mask-aware rule unit tests; limiter overshoot ≤0.1 dB (BS.1770 A2); blind ABX: no audible pumping at target PLR |
| **P3 FM / MPX chain** | 14–19 | Emphasis, composite clipper (64×/256×, sym/asym), BS.412 power control, pilot/NCO/notches, stereo encoder, RDS generator (all fields), µMPX RTP out | SM.1268 mask pass; BS.412 power within ±0.5 dB of target; pilot drift < ±1°; RDS CRC error-free over 10⁶ blocks; clipper IM < −60 dBc |
| **P4 Output paths** | 20–25 | Streaming codec pre-conditioning + HLS/DASH, DAB+ ETI/EDI, HD hybrid, AM asymmetric + C-QUAM option | Per-path loudness/ceiling conformance; codec round-trip TP ≤ ceiling; ETI frame validity |
| **P5 Restoration** | 26–30 | Predictive de-clip, adaptive de-hiss (masking-floor bound), speech/music classifier (<100 ms switch), azimuth, mono-safety, crest presets | Clip-reconstruction SNR gain ≥6 dB on test set; classifier F1 ≥0.95; profile switch click-free |
| **P6 Control plane** | 31–37 | Graph reordering/bypass, preset store + morph, REST/WS API, HTML5 remote, permissions/audit, headless + systemd, Lua hooks, NTP preset sync | API contract tests; A/B/morph click-free; two-machine preset sync drift ≤1 s; headless boots and serves API with GUI absent |
| **P7 Hardening & release** | 38–44 | Perf gates (spec §7), 48 h soak, listening panel (20 × blind ABX vs reference chain), documentation, packaging (AppImage/deb/rpm/msi/dmg), v1.0 tag | All CI gates green incl. CPU regression; soak with 0 dropouts; listening panel ≥ no-difference vs target chain; docs complete for every algorithm |

**Cross-cutting:** every phase lands with its unit tests, its documentation paragraph in
`native/docs/`, and its parameter schema so the web console can expose it without rework.

---

## 4. Validation plan

| Class | What | Pass condition |
|---|---|---|
| Unit | biquads, polyphase, spreading matrix, gates, CRC-10 | scalar vs SIMD bit-exact; analytic reference within 1e-6 |
| Conformance | EBU Tech 3341/3342/3343, BS.1770-4, BS.1770 A2 true peak, BS.412, SM.1268 | published reference values within stated tolerance |
| Golden vectors | full chain, fixed input + fixed preset | bit-identical across runs/platforms |
| Latency probe | impulse through each profile | within ±10 % of §5 table |
| Performance | `perf` benchmark, 1000-block average | ≤ §7 budgets, ≤2 % regression vs previous CI |
| RT audit | allocation/lock/syscall tracing under load | 0 violations after `prepare()` |
| Perceptual | blind ABX vs target chain (FM Competitive, −9 LUFS) | panel reports no artefact at or below target PLR |
| Soak | 48 h continuous encode + remote control churn | 0 dropouts/underruns, RSS stable ±2 % |
| Field | 2-week pilot on a live stream | zero alarm-level events unexplained by the event log |

---

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 64×–256× composite clipper cost on shared hardware | profiles at 8×/64×/256×; CI benchmark gate; NEON/AVX2 kernels per phase P3 |
| Mask-aware gain rule too conservative (station sounds "unclean") | `mask_allowance` 0–12 dB per preset; strict default, audition A/B in console |
| Latency table drifts from reality | latency probe is a release gate; table is re-measured each phase |
| Eight-band migration breaks existing `.tm` library | frequency-based band remap on load, with a one-time, logged conversion |
| Preset/sync complexity in multi-user setups | versioned hashes + atomic switch + rollback (P6 exit criterion) |
