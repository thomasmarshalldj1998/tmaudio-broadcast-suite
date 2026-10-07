# DEVELOPER REFERENCE — block diagram & filter specification

```
 ┌──────────┐   ┌──────────┐   ┌──────────────────────────────────┐
 │ Input    │──▶│ Repair   │──▶│ Dual-loop AGC                    │
 │ 96 kHz   │   │ declip   │   │  slow  A 150-500  R 400-2000 ms  │
 │ 32-bit f │   │ dequant  │   │  fast  A 5-30 H 20-100 R 50-200  │
 └──────────┘   │ de-hiss  │   │  + speech classifier (auto-widen)│
                │ DC block │   └───────────────┬──────────────────┘
                └──────────┘                   ▼
                ┌────────────────────────────────────────────────┐
                │ SENSUS — 6-band linear-phase crossover         │
                │ 0-80 │ 80-300 │ 300-1k │ 1k-3.5k │ 3.5k-7k │   │
                │ 7k-12k                                             │
                │ per band: threshold, ratio, attack, hold, release │
                │ timing = f(centroid, transient density) / 32 smp  │
                └────────────────────┬───────────────────────────┘
                                     ▼
                ┌────────────────────────────────────────────────┐
                │ Imaging: per-band width, Haas 0-30 ms,         │
                │ mono-safe fold, correlation control            │
                └──────┬──────────┬──────────┬──────────┬────────┘
                       ▼          ▼          ▼          ▼
                  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
                  │ FM/MPX │ │ DAB+   │ │ WEB    │ │ HD     │
                  │192 kHz │ │20 kHz  │ │16 kHz  │ │15-20 kHz│
                  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
                      ▼          ▼          ▼          ▼
                 MPX / RTP    PCM→ETI   Icecast/     HD pair
                              (192k)    SHOUTcast
```

## Filter specification

| Stage | Type | Specification |
|---|---|---|
| Sensus crossover | linear-phase FIR | 8192 tap @ 96 kHz, Kaiser β = 8.6, ±0.05 dB passband, > 90 dB stopband, constant group delay |
| 15 kHz brickwall LPF | linear-phase FIR | 4096 tap, ±0.05 dB to 14.8 kHz, −80 dB by 15.2 kHz |
| Pre-emphasis | IIR, phase-linearised | 50 / 75 µs, ±0.05 dB, applied **before** limiting |
| Anti-image (clip OS) | linear-phase FIR | 8× / 16× oversample, −90 dB images |
| True-peak limiter | 4× OS FIR | ITU-R BS.1770-4, 0.5 ms lookahead |
| Crossover integrity | summation test | \|Σ bands − input\| < 0.01 dB, 20 Hz – 20 kHz |

## Latency budget (96 kHz, 32-sample block)

| Stage | Time |
|---|---|
| input → AGC | 0.5 ms |
| Sensus FIR | 42.7 ms (linear-phase; pre-ringing windowed so no pre-echo above −70 dB) |
| imaging | 0.3 ms |
| chains | 1.2 ms |
| MPX @ 192 kHz | 0.4 ms |
| **total** | **≈ 45 ms** (DJ low-latency bypass path: 0.9 ms end-to-end) |

## Quality gates (CI)

* IMD products < −60 dBc at 100 % modulation
* Pilot drift < ±1°
* RDS syndrome match on every block
* Loudness target within ±0.1 LU of preset
* No pre-echo above −70 dB relative to the transient
* No third-party runtime libraries in the packaged binary
