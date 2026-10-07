import { PATH_COLORS, fixed } from "@/lib/tm/dsp";
import {
  LevelMeter,
  MpxAnalyzer,
  SpectrumAnalyzer,
  loudness,
  programLevel,
  truePeak,
  useTick,
} from "@/components/tm/analyzers";
import {
  Fader,
  Led,
  Legend,
  RackUnit,
  Segmented,
} from "@/components/tm/ui";
import { Switch } from "@/components/ui/switch";
import { useConsole } from "./context";
import type { PresetKey } from "@/lib/tm/presets";

const CHAINS: { key: PresetKey; label: string; color: string }[] = [
  { key: "fm", label: "FM / MPX", color: PATH_COLORS.fm },
  { key: "dab", label: "DAB+", color: PATH_COLORS.dab },
  { key: "web", label: "WEB", color: PATH_COLORS.web },
  { key: "hd", label: "HD", color: PATH_COLORS.hd },
];

function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-[#0E1014] px-3 py-2.5 transition-colors hover:border-border">
      <span className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-foreground/90">{label}</span>
        {note ? (
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
            {note}
          </span>
        ) : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Meters({
  target,
  ceiling,
  color,
  extra,
}: {
  target: number;
  ceiling: number;
  color: string;
  extra?: string;
}) {
  useTick(90);
  const t = performance.now() / 1000;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-[#0E1014] p-4">
      <div className="flex items-center justify-between">
        <Legend>Chain meters</Legend>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {extra}
        </span>
      </div>
      <LevelMeter
        label="Integrated loudness"
        value={loudness(t, target)}
        min={-40}
        max={-4}
        unit="LUFS"
        accent={color}
      />
      <LevelMeter
        label="True peak"
        value={truePeak(t, ceiling)}
        min={-12}
        max={2}
        ceiling={ceiling}
        unit="dBTP"
        accent={color}
      />
      <LevelMeter
        label="Programme (LR)"
        value={programLevel(t)}
        min={-46}
        max={2}
        ceiling={0}
        unit="dBFS"
        accent={color}
      />
      <div className="flex justify-between border-t border-border/50 pt-2 font-mono text-[10px] tabular-nums text-muted-foreground">
        <span>target {fixed(target, 0)} LUFS</span>
        <span>ceiling {fixed(ceiling, 1)} dBTP</span>
      </div>
    </div>
  );
}

/* ================================================================== *
 * 04 — PARALLEL OUTPUT CHAINS
 * ================================================================== */

export function OutputChainsSection() {
  const { cfg, set, presetKey, loadPreset, running } = useConsole();
  const chain = CHAINS.find((c) => c.key === presetKey) ?? CHAINS[0];
  const color = chain.color;
  const fm = cfg.fm;
  const dab = cfg.dab;
  const web = cfg.web;
  const hd = cfg.hd;

  return (
    <RackUnit
      index="04"
      title="Parallel Output Chains"
      eyebrow="four independent signal paths · no shared processing"
      accent={color}
      right={
        <Segmented<PresetKey>
          value={presetKey}
          onChange={(v) => loadPreset(v)}
          accent={color}
          options={CHAINS.map((c) => ({ value: c.key, label: c.label }))}
        />
      }
    >
      {presetKey === "fm" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-3">
            <MpxAnalyzer
              running={running}
              pilot={fm.pilot}
              subcarrier={fm.subcarrier}
              injection={fm.rdsInjection}
              maskEnforce={fm.maskEnforce}
              emphasis={fm.emphasis}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-muted-foreground">
              <span>
                L+R 0–15 kHz · 19 kHz pilot {fixed(fm.pilot, 1)} % · 38 kHz
                DSB-SC {fixed(fm.subcarrier, 0)} % · 57 kHz RDS BPSK
              </span>
              <span className="font-mono tabular-nums text-[#4ADE80]">
                {fm.maskEnforce ? "MASK ENFORCED" : "MASK BYPASSED"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Legend>Pre-emphasis (ahead of limiter)</Legend>
                <Segmented<50 | 75>
                  value={fm.emphasis}
                  onChange={(v) => set("fm", { emphasis: v })}
                  accent={color}
                  options={[
                    { value: 50, label: "50 µs · EU" },
                    { value: 75, label: "75 µs · US" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Legend>LoIMD oversampling</Legend>
                <Segmented<8 | 16>
                  value={fm.oversample}
                  onChange={(v) => set("fm", { oversample: v })}
                  accent={color}
                  options={[
                    { value: 8, label: "8×" },
                    { value: 16, label: "16×" },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fader
                label="Brickwall LPF"
                value={fm.lpfKhz}
                min={10}
                max={16}
                step={0.1}
                unit="kHz"
                accent={color}
                onChange={(v) => set("fm", { lpfKhz: v })}
              />
              <Fader
                label="Bass stage clip · 0–300 Hz"
                value={fm.bassClip}
                min={0}
                max={12}
                step={0.1}
                unit="dB"
                accent={color}
                onChange={(v) => set("fm", { bassClip: v })}
              />
              <Fader
                label="Main stage clip"
                value={fm.mainClip}
                min={0}
                max={18}
                step={0.1}
                unit="dB"
                accent={color}
                onChange={(v) => set("fm", { mainClip: v })}
              />
              <Fader
                label="Pilot injection"
                value={fm.pilot}
                min={0}
                max={10}
                step={0.1}
                unit="%"
                accent={color}
                onChange={(v) => set("fm", { pilot: v })}
              />
              <Fader
                label="L−R subcarrier"
                value={fm.subcarrier}
                min={0}
                max={100}
                step={1}
                digits={0}
                unit="%"
                accent={color}
                onChange={(v) => set("fm", { subcarrier: v })}
              />
              <Fader
                label="RDS injection"
                value={fm.rdsInjection}
                min={0}
                max={6}
                step={0.1}
                unit="% dev"
                accent={PATH_COLORS.dab}
                onChange={(v) => set("fm", { rdsInjection: v })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="ITU-R SM.1268 policing"
                note="selective attenuation, not clipping"
                checked={fm.maskEnforce}
                onChange={(v) => set("fm", { maskEnforce: v })}
              />
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-[#0E1014] px-3 py-2.5">
                <span className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-foreground/90">
                    µMPX RTP / UDP out
                  </span>
                  <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
                    {fm.rtpHost}:{fm.rtpPort}
                  </span>
                </span>
                <Led on={running} label="stream" color="#F5A524" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/50 pt-3 font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>MPX output {fm.outputRate.toLocaleString("en-US")} Hz PCM</span>
              <span>IMD &lt; −60 dBc @ 100 % mod</span>
              <span>pilot drift &lt; ±1°</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Meters
              target={-14}
              ceiling={-1}
              color={color}
              extra="FM composite"
            />
            <SpectrumAnalyzer running={running} accent={color} gainDb={2} />
            <div className="rounded-lg border border-border/50 bg-[#0E1014] p-3 text-[10px] leading-relaxed text-muted-foreground">
              The bass stage clips 0–300 Hz on its own path before summation so
              intermodulation products never spread across the multiplex, then
              the main stage soft-clips at {fm.oversample}× and is re-filtered
              down. Pre-emphasis is applied{" "}
              <span className="text-foreground/80">before</span> limiting so the
              HF ceiling is the thing being limited, not the noise floor.
            </div>
          </div>
        </div>
      )}

      {presetKey === "dab" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Legend>Codec pre-shaping target</Legend>
                <Segmented<string>
                  value={dab.codec}
                  onChange={(v) => set("dab", { codec: v as typeof dab.codec })}
                  accent={color}
                  options={[
                    { value: "xHE-AAC", label: "xHE-AAC" },
                    { value: "HE-AACv2", label: "HE-AACv2" },
                    { value: "AAC-LC", label: "AAC-LC" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Legend>Encoder bitrate</Legend>
                <Segmented<number>
                  value={dab.bitrate}
                  onChange={(v) => set("dab", { bitrate: v })}
                  accent={color}
                  options={[
                    { value: 64, label: "64k" },
                    { value: 96, label: "96k" },
                    { value: 128, label: "128k" },
                    { value: 192, label: "192k" },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fader
                label="Audio bandwidth"
                value={dab.bandwidthKhz}
                min={10}
                max={20}
                step={0.5}
                unit="kHz"
                accent={color}
                onChange={(v) => set("dab", { bandwidthKhz: v })}
              />
              <Fader
                label="EBU R128 target"
                value={dab.loudness}
                min={-32}
                max={-9}
                step={0.5}
                unit="LUFS"
                accent={color}
                onChange={(v) => set("dab", { loudness: v })}
              />
              <Fader
                label="True-peak ceiling"
                value={dab.truePeak}
                min={-3}
                max={0}
                step={0.1}
                unit="dBTP"
                accent="#FF4D4D"
                onChange={(v) => set("dab", { truePeak: v })}
              />
              <Fader
                label="Sensus AGC window"
                value={cfg.sensus.agcWindowMs}
                min={40}
                max={600}
                step={10}
                digits={0}
                unit="ms"
                accent={color}
                onChange={(v) => set("sensus", { agcWindowMs: v })}
              />
            </div>
            <Toggle
              label="ITU-R BS.1770 true-peak limiter"
              note="4× oversampled inter-sample detection"
              checked={dab.preShaping}
              onChange={(v) => set("dab", { preShaping: v })}
            />
            <div className="grid gap-3 rounded-lg border border-border/50 bg-[#0E1014] p-4 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  Loudness
                </span>
                Gated integrated measurement to EBU R128, −23 LUFS with no
                clipping headroom sacrificed to reach it.
              </p>
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  True peak
                </span>
                Inter-sample peaks held at {fixed(dab.truePeak, 1)} dBTP so the
                DAB+ encoder never sees an over.
              </p>
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  Bandwidth
                </span>
                {fixed(dab.bandwidthKhz, 1)} kHz gentle roll-off tuned to the
                {dab.codec} quantiser at {dab.bitrate} kbps.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Meters target={dab.loudness} ceiling={dab.truePeak} color={color} extra="DAB+ chain" />
            <SpectrumAnalyzer running={running} accent={color} gainDb={1} />
          </div>
        </div>
      )}

      {presetKey === "web" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Legend>Stream format</Legend>
                <Segmented<string>
                  value={web.format}
                  onChange={(v) => set("web", { format: v as typeof web.format })}
                  accent={color}
                  options={[
                    { value: "AAC", label: "AAC" },
                    { value: "MP3", label: "MP3" },
                    { value: "Ogg", label: "Ogg" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Legend>Bitrate</Legend>
                <Segmented<number>
                  value={web.bitrate}
                  onChange={(v) => set("web", { bitrate: v })}
                  accent={color}
                  options={[
                    { value: 64, label: "64k" },
                    { value: 96, label: "96k" },
                    { value: 128, label: "128k" },
                    { value: 192, label: "192k" },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fader
                label="Codec bandwidth"
                value={web.bandwidthKhz}
                min={8}
                max={20}
                step={0.5}
                unit="kHz"
                accent={color}
                onChange={(v) => set("web", { bandwidthKhz: v })}
              />
              <Fader
                label="Integrated target"
                value={web.loudness}
                min={-22}
                max={-9}
                step={0.5}
                unit="LUFS"
                accent={color}
                onChange={(v) => set("web", { loudness: v })}
              />
              <Fader
                label="True peak"
                value={web.truePeak}
                min={-3}
                max={0}
                step={0.1}
                unit="dBTP"
                accent="#FF4D4D"
                onChange={(v) => set("web", { truePeak: v })}
              />
              <Fader
                label="Spectral tilt match"
                value={web.tilt}
                min={0}
                max={8}
                step={0.1}
                unit="dB/oct"
                accent={color}
                onChange={(v) => set("web", { tilt: v })}
              />
              <Fader
                label="Temporal noise shaping"
                value={web.tns}
                min={0}
                max={10}
                step={0.1}
                unit="dB"
                accent={color}
                onChange={(v) => set("web", { tns: v })}
              />
              <div className="flex flex-col justify-end gap-2 rounded-lg border border-border/60 bg-[#0E1014] px-3 py-2.5">
                <Legend>Icecast mount</Legend>
                <span className="font-mono text-[11px] text-foreground/85">
                  {web.mount}
                </span>
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-border/50 bg-[#0E1014] p-4 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  128 kbps sweet spot
                </span>
                16 kHz gentle roll-off keeps the quantiser out of trouble and
                the top end out of the noise floor.
              </p>
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  Hole filling
                </span>
                Spectral tilt and TNS pre-emphasis are shaped so the encoder's
                discarded bands stay masked.
              </p>
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  Loudness
                </span>
                {fixed(web.loudness, 0)} LUFS integrated sits with streaming
                peers at −1.0 dBTP true peak.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Meters target={web.loudness} ceiling={web.truePeak} color={color} extra="Web chain" />
            <SpectrumAnalyzer running={running} accent={color} gainDb={0} />
          </div>
        </div>
      )}

      {presetKey === "hd" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Fader
                label="HD audio bandwidth"
                value={hd.bandwidthKhz}
                min={10}
                max={20}
                step={0.5}
                unit="kHz"
                accent={color}
                onChange={(v) => set("hd", { bandwidthKhz: v })}
              />
              <Fader
                label="Hybrid gain balance"
                value={hd.hybridGain}
                min={-6}
                max={6}
                step={0.1}
                unit="dB"
                accent={color}
                onChange={(v) => set("hd", { hybridGain: v })}
              />
              <Fader
                label="Analog carrier ref"
                value={hd.analogRef}
                min={-20}
                max={0}
                step={0.5}
                unit="dB"
                accent={color}
                onChange={(v) => set("hd", { analogRef: v })}
              />
              <Fader
                label="Digital carrier ref"
                value={hd.digitalRef}
                min={-20}
                max={0}
                step={0.5}
                unit="dB"
                accent={color}
                onChange={(v) => set("hd", { digitalRef: v })}
              />
              <Fader
                label="FM pre-emphasis"
                value={cfg.fm.emphasis}
                min={50}
                max={75}
                step={25}
                digits={0}
                unit="µs"
                accent={PATH_COLORS.fm}
                onChange={(v) => set("fm", { emphasis: v as 50 | 75 })}
              />
              <Fader
                label="Main clip drive"
                value={cfg.fm.mainClip}
                min={0}
                max={18}
                step={0.1}
                unit="dB"
                accent={PATH_COLORS.fm}
                onChange={(v) => set("fm", { mainClip: v })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="NRSC-5 compliant processing"
                note="mono/stereo hybrid mask"
                checked={hd.nrsc}
                onChange={(v) => set("hd", { nrsc: v })}
              />
              <Toggle
                label="HDC+ codec pre-shaping"
                note="spectral envelope match"
                checked={hd.hdcPreShaping}
                onChange={(v) => set("hd", { hdcPreShaping: v })}
              />
            </div>
            <div className="grid gap-3 rounded-lg border border-border/50 bg-[#0E1014] p-4 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  Hybrid balance
                </span>
                Digital and analog carriers are gain-matched so a listener
                moving between them hears no level jump.
              </p>
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  NRSC-5
                </span>
                Blended masking keeps in-band splatter inside the licensed
                emission mask at full modulation.
              </p>
              <p>
                <span className="block text-[10px] tracking-[0.16em] text-foreground/70 uppercase">
                  HDC+
                </span>
                Pre-emphasis shaped for the digital codec's bit allocation so
                HF detail survives at moderate bitrates.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Meters target={-16} ceiling={-2} color={color} extra="HD hybrid" />
            <SpectrumAnalyzer running={running} accent={color} gainDb={1.5} />
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-[#0E1014] px-3 py-2.5 text-[10px] text-muted-foreground">
              <span>Digital ref</span>
              <span className="font-mono tabular-nums text-foreground/85">
                {fixed(hd.digitalRef, 1)} dB
              </span>
              <span>Analog ref</span>
              <span className="font-mono tabular-nums text-foreground/85">
                {fixed(hd.analogRef, 1)} dB
              </span>
            </div>
          </div>
        </div>
      )}
    </RackUnit>
  );
}
