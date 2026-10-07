# TMAUDIO USER GUIDE — v1.0 Standalone Edition

## 1. Portable deployment

* Copy the distribution folder to disk or USB; launch the executable.
* Point **Preset folder** at `./presets` (default) — presets are plain text,
  so you can edit them in any editor while the application is running.
* Set your interface: Windows WASAPI/ASIO, Linux ALSA/JACK, macOS CoreAudio.
  96 kHz is the native rate; MPX runs at 192 kHz internally.
* Outputs: assign FM composite (MPX @ 192 kHz PCM, or µMPX RTP/UDP), DAB+ PCM,
  Web encoder, HD pair. Each is an independent chain — mute or repatch one
  without touching the others.

## 2. Tuning

Start from the factory preset closest to your format, then:

* **Input repair** — declip/de-hiss only as much as the source needs; watch
  the input spectrum for *restored* HF, not for level.
* **Dual-loop AGC** — slow attack 150–500 ms and slow release 400–2000 ms for
  long-term programme balance; the fast loop (attack 5–30 ms, hold 20–100 ms,
  release 50–200 ms) exists only for transient guard.
* **Sensus** — per band, set threshold where gain reduction just starts to
  move, then choose ratio for character. Timing is density-adaptive: do not
  chase attack/release unless a band genuinely misbehaves on your content.
* **Imaging** — watch the correlation scope; if mono fold-down drops below
  about 0.7, raise coherence or enable mono-safe before touching width.
* **Path limiter** — pre-emphasis first (50 µs EU / 75 µs US, **before** the
  limiter), then clip drive. With SM.1268 enforcement on, push loudness until
  the mask indicator reacts; that is your legal ceiling.
* **Loudness** — DAB+ to −23 LUFS / −1.0 dBTP, Web to −14…−16 LUFS, HD to the
  NRSC hybrid balance you measured on air.

## 3. Platform setup

| Platform | Artifact | Notes |
|---|---|---|
| Windows 10+ x64 | `TMAUDIO.exe` | Portable, static CRT — no VC redist. ASIO for low latency, WASAPI exclusive otherwise. |
| Linux | `TMAUDIO.AppImage` | Double-click after `chmod +x`. ALSA by default, JACK for explicit routing. `--appimage-extract-and-run` for no-FUSE hosts. |
| macOS | `TMAUDIO.app` | Universal (arm64 + x86_64). Drag to `/Applications` or run in place. |

* **Web remote:** enable in *Station Features* → browse to
  `http://<host>:8080` from any device for metering and preset recall
  (local network only; nothing leaves your network).

## 4. Compliance

* The **24 h compliance log** records integrated loudness, short-term
  maximum, true peak, modulation depth, pilot level and pass/fail status
  every 10 minutes.
* Export **CSV** for the regulator, or **Print/PDF** for a signed report.
* **RDS:** syndrome check on every block, error rate displayed live; keep
  injection inside 2–6 % modulation and drift stays below ±1°.
* **Mask:** ITU-R SM.1268 enforcement is selective attenuation, so loudness is
  preserved instead of clipped away.
