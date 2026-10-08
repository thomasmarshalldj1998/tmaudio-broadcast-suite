import { BANDS, PATH_COLORS, fixed } from "@/lib/tm/dsp";
import {
  BandActivity,
  CorrelationScope,
  SpectrumAnalyzer,
} from "@/components/tm/analyzers";
import {
  Fader,
  GrBar,
  Knob,
  Led,
  Legend,
  RackUnit,
  Readout,
  Segmented,
} from "@/components/tm/ui";
import { Switch } from "@/components/ui/switch";
import { useConsole } from "./context";
import { useMaster } from "./master";

function Toggle({
  label,
  checked,
  onChange,
  note,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  note?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-[#1E232A] px-3 py-2.5 transition-colors hover:border-border">
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

/* ================================================================== *
 * 01 — INPUT STAGE
 * ================================================================== */

export function InputSection() {
  const { cfg, set, running } = useConsole();
  const i = cfg.input;

  return (
    <RackUnit
      index="02"
      title="Input Stage"
      eyebrow="96 kHz native · 32-bit float · dual-speed AGC"
      accent={PATH_COLORS.fm}
      right={
        <div className="flex items-center gap-4">
          <Led on={i.dcBlock} label="DC lock" color="#35C8D8" />
          <Led on={i.speechDetect} label="Voice" color="#F5A524" />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            96 000 Hz
          </span>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-[#1E232A] p-4">
            <div className="flex items-center justify-between">
              <Legend>Wideband AGC</Legend>
              <Readout value="dual-speed" unit="" tone="accent" />
            </div>
            <Fader
              label="Slow · attack"
              value={i.slowAgcMs}
              min={150}
              max={500}
              step={5}
              digits={0}
              unit="ms"
              onChange={(v) => set("input", { slowAgcMs: v })}
            />
            <Fader
              label="Slow · release"
              value={i.slowReleaseMs}
              min={400}
              max={2000}
              step={10}
              digits={0}
              unit="ms"
              onChange={(v) => set("input", { slowReleaseMs: v })}
            />
            <Fader
              label="Slow · make-up"
              value={i.slowGain}
              min={0}
              max={14}
              step={0.1}
              unit="dB"
              onChange={(v) => set("input", { slowGain: v })}
            />
            <Fader
              label="Fast · attack"
              value={i.fastAgcMs}
              min={5}
              max={30}
              step={1}
              digits={0}
              unit="ms"
              onChange={(v) => set("input", { fastAgcMs: v })}
            />
            <Fader
              label="Fast · hold"
              value={i.fastHoldMs}
              min={20}
              max={100}
              step={1}
              digits={0}
              unit="ms"
              onChange={(v) => set("input", { fastHoldMs: v })}
            />
            <Fader
              label="Fast · release"
              value={i.fastReleaseMs}
              min={50}
              max={200}
              step={1}
              digits={0}
              unit="ms"
              onChange={(v) => set("input", { fastReleaseMs: v })}
            />
            <Fader
              label="Fast · make-up"
              value={i.fastGain}
              min={0}
              max={10}
              step={0.1}
              unit="dB"
              onChange={(v) => set("input", { fastGain: v })}
            />
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-[#1E232A] p-4">
            <div className="flex items-center justify-between">
              <Legend>Input repair</Legend>
              <Readout value="pre-AGC" />
            </div>
            <Fader
              label="Declipper"
              value={i.declip}
              min={0}
              max={100}
              step={1}
              digits={0}
              unit="%"
              onChange={(v) => set("input", { declip: v })}
              accent="#35C8D8"
            />
            <Fader
              label="Dequantiser"
              value={i.dequant}
              min={0}
              max={100}
              step={1}
              digits={0}
              unit="%"
              onChange={(v) => set("input", { dequant: v })}
              accent="#35C8D8"
            />
            <Fader
              label="Hum reduction"
              value={i.humReduction}
              min={0}
              max={100}
              step={1}
              digits={0}
              unit="%"
              onChange={(v) => set("input", { humReduction: v })}
              accent="#35C8D8"
            />
            <Fader
              label="Broadband noise"
              value={i.noiseReduction}
              min={0}
              max={18}
              step={0.5}
              unit="dB"
              onChange={(v) => set("input", { noiseReduction: v })}
              accent="#35C8D8"
            />
            <Fader
              label="Downstream gate"
              value={i.gate}
              min={-80}
              max={-30}
              step={1}
              digits={0}
              unit="dBFS"
              onChange={(v) => set("input", { gate: v })}
            />
          </div>

          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <Toggle
              label="DC offset removal"
              note="1-pole @ 5 Hz"
              checked={i.dcBlock}
              onChange={(v) => set("input", { dcBlock: v })}
            />
            <Toggle
              label="Voice / speech detect"
              note="auto-slows timing"
              checked={i.speechDetect}
              onChange={(v) => set("input", { speechDetect: v })}
            />
            <Toggle
              label="Dual-speed coupling"
              note="fast rides slow"
              checked={i.dcBlock && i.speechDetect}
              onChange={(v) => set("input", { dcBlock: v, speechDetect: v })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Legend>Input spectrum</Legend>
            <Readout value={fixed(i.slowGain + i.fastGain, 1)} unit="dB gain" />
          </div>
          <SpectrumAnalyzer running={running} gainDb={i.slowGain * 0.4} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>FFT 8192 · Hann · 75 % overlap</span>
            <span className="font-mono tabular-nums">±0.02 dB ripple</span>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}

/* ================================================================== *
 * 02 — SENSUS MULTIBAND DYNAMICS
 * ================================================================== */

export function SensusSection() {
  const { cfg, set, setBand, running } = useConsole();
  const { engineer, tel } = useMaster();
  const s = cfg.sensus;

  return (
    <RackUnit
      index="03"
      title="TMAUDIO Sensus — Multiband Dynamics"
      eyebrow="6-band linear-phase crossover · density-adaptive timing"
      accent={PATH_COLORS.fm}
      right={
        <div className="flex items-center gap-4">
          <Led on={s.mode === "auto"} label="adaptive" color="#F5A524" />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            centroid {s.centroidSmoothMs} ms
          </span>
        </div>
      }
    >
      {/* ---------------- MB3 overview ---------------- */}
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border/60 bg-[#1E232A] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legend>MB3 overview — three-way summary of the six Sensus bands</Legend>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            current / peak gain reduction
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["LOW", tel.mb3.low, "#D97706", "bands 1–2 · below 300 Hz"],
            ["MID", tel.mb3.mid, "#F5A524", "bands 3–4 · 300 Hz – 3.5 kHz"],
            ["HIGH", tel.mb3.high, "#FDE68A", "bands 5–6 · above 3.5 kHz"],
          ] as const).map(([label, stat, color, note]) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-[#12161B] p-3"
            >
              <div className="flex items-baseline justify-between">
                <span
                  className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                  style={{ color }}
                >
                  {label}
                </span>
                <span
                  className="font-mono text-[13px] tabular-nums"
                  style={{
                    color: stat.now > 0.05 ? color : "rgba(255,255,255,0.55)",
                  }}
                >
                  {stat.now > 0.005 ? `−${fixed(stat.now, 1)}` : "0.0"}
                  <span className="ml-0.5 text-[9px] text-muted-foreground">dB</span>
                </span>
              </div>
              <GrBar value={stat.now} peak={stat.peak} max={14} color={color} />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{note}</span>
                <span className="font-mono tabular-nums">
                  peak −{fixed(stat.peak, 1)} dB
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-5 border-t border-border/50 pt-3">
          <Legend>MB3 activity</Legend>
          {([
            ["LOW", tel.mb3.low, "#D97706"],
            ["MID", tel.mb3.mid, "#F5A524"],
            ["HIGH", tel.mb3.high, "#FDE68A"],
          ] as const).map(([label, stat, color]) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full transition-all"
                style={{
                  background: running && stat.now > 0.05 ? color : "#6B7280",
                  boxShadow:
                    running && stat.now > 0.05 ? `0 0 8px ${color}99` : "none",
                }}
              />
              <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                {label}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-foreground/80">
                {stat.now > 0.005 ? `−${fixed(stat.now, 1)}` : "0.0"} dB
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {engineer && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Legend>Timing source</Legend>
              <Segmented<"auto" | "transient" | "music" | "speech">
                value={s.mode}
                onChange={(v) => set("sensus", { mode: v })}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "transient", label: "Drums" },
                  { value: "music", label: "Music" },
                  { value: "speech", label: "Speech" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Legend>Analysis block</Legend>
              <Segmented<32 | 64>
                value={s.blockSize}
                onChange={(v) => set("sensus", { blockSize: v })}
                options={[
                  { value: 32, label: "32 smp" },
                  { value: 64, label: "64 smp" },
                ]}
                accent="#35C8D8"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Legend>AGC window</Legend>
              <Fader
                label=""
                value={s.agcWindowMs}
                min={40}
                max={600}
                step={10}
                digits={0}
                unit="ms"
                onChange={(v) => set("sensus", { agcWindowMs: v })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Legend>Transient density</Legend>
              <Fader
                label=""
                value={s.centroidSmoothMs}
                min={4}
                max={160}
                step={2}
                digits={0}
                unit="ms"
                onChange={(v) => set("sensus", { centroidSmoothMs: v })}
              />
            </div>
          </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {BANDS.map((band, idx) => {
              const b = s.bands[idx];
              return (
                <div
                  key={band.index}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-[#1E232A] p-3 transition-colors hover:border-border"
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span
                      className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                      style={{ color: band.color }}
                    >
                      {band.name}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {b.gain >= 0 ? "+" : ""}
                      {fixed(b.gain, 1)}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground/80">
                    {band.range}
                  </span>
                  <div
                    className={`grid gap-x-1 gap-y-2 justify-items-center ${engineer ? "grid-cols-3" : "grid-cols-1"}`}
                  >
                    <Knob
                      label="Thr"
                      value={b.threshold}
                      min={-48}
                      max={0}
                      step={0.5}
                      digits={0}
                      unit="dB"
                      size={44}
                      accent={band.color}
                      onChange={(v) => setBand(idx, { threshold: v })}
                    />
                    {engineer && (
                      <>
                    <Knob
                      label="Ratio"
                      value={b.ratio}
                      min={1}
                      max={20}
                      step={0.1}
                      digits={1}
                      unit=":1"
                      size={44}
                      accent={band.color}
                      onChange={(v) => setBand(idx, { ratio: v })}
                    />
                    <Knob
                      label="Atk"
                      value={b.attack}
                      min={0.5}
                      max={60}
                      step={0.5}
                      digits={1}
                      unit="ms"
                      size={44}
                      accent={band.color}
                      onChange={(v) => setBand(idx, { attack: v })}
                    />
                    <Knob
                      label="Hld"
                      value={b.hold}
                      min={0}
                      max={300}
                      step={5}
                      digits={0}
                      unit="ms"
                      size={44}
                      accent={band.color}
                      onChange={(v) => setBand(idx, { hold: v })}
                    />
                    <Knob
                      label="Rel"
                      value={b.release}
                      min={20}
                      max={600}
                      step={5}
                      digits={0}
                      unit="ms"
                      size={44}
                      accent={band.color}
                      onChange={(v) => setBand(idx, { release: v })}
                    />
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Fader
                      label="Gain"
                      value={b.gain}
                      min={-12}
                      max={12}
                      step={0.1}
                      unit="dB"
                      accent={band.color}
                      onChange={(v) => setBand(idx, { gain: v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Spectral centroid and transient density are measured every{" "}
            <span className="font-mono text-foreground/80">{s.blockSize}</span>{" "}
            samples; attack and release are interpolated from that analysis on
            every block — there are no fixed timings anywhere in the chain.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Legend>Band activity</Legend>
            <Readout value={s.mode} tone="accent" />
          </div>
          <BandActivity
            running={running}
            mode={s.mode}
            thresholds={s.bands.map((b) => b.threshold)}
          />
          <div className="rounded-lg border border-border/50 bg-[#1E232A] p-3">
            <Legend className="mb-2">Timing law</Legend>
            <ul className="space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <li className="flex justify-between gap-2">
                <span>Drums / transients</span>
                <span className="font-mono text-[#4ADE80]">fast · fast</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Music / sustained</span>
                <span className="font-mono text-[#F5A524]">slow · adaptive</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Speech</span>
                <span className="font-mono text-[#35C8D8]">gentle · wide</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}

/* ================================================================== *
 * 03 — IMAGING & MID-SIDE
 * ================================================================== */

export function ImagingSection() {
  const { cfg, set, setBand, running } = useConsole();
  const im = cfg.imaging;
  const s = cfg.sensus;

  return (
    <RackUnit
      index="04"
      title="Imaging & Mid-Side"
      eyebrow="per-band width · Haas decorrelation · mono-compatible"
      accent={PATH_COLORS.dab}
      right={
        <div className="flex items-center gap-4">
          <Led on={im.monoSafe} label="mono safe" color="#4ADE80" />
          <Readout value={fixed(im.coherence, 0)} unit="% coherence" tone="green" />
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          <CorrelationScope running={running} coherence={im.coherence} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Lissajous L/R</span>
            <span className="font-mono tabular-nums">
              fold-down {fixed(im.coherence / 100, 2)}
            </span>
          </div>
          <div className="grid gap-3">
            <Toggle
              label="Haas decorrelation"
              note={`${fixed(im.haasMs, 1)} ms side delay`}
              checked={im.haas}
              onChange={(v) => set("imaging", { haas: v })}
            />
            <Toggle
              label="Mono-compatible fallback"
              note="side energy folded on sum"
              checked={im.monoSafe}
              onChange={(v) => set("imaging", { monoSafe: v })}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Fader
              label="Haas delay"
              value={im.haasMs}
              min={0}
              max={30}
              step={0.5}
              unit="ms"
              onChange={(v) => set("imaging", { haasMs: v })}
              accent={PATH_COLORS.dab}
              disabled={!im.haas}
            />
            <Fader
              label="Side chain high-pass"
              value={im.sideChainHp}
              min={0}
              max={400}
              step={5}
              digits={0}
              unit="Hz"
              onChange={(v) => set("imaging", { sideChainHp: v })}
              accent={PATH_COLORS.dab}
            />
            <Fader
              label="Coherence target"
              value={im.coherence}
              min={70}
              max={100}
              step={1}
              digits={0}
              unit="%"
              onChange={(v) => set("imaging", { coherence: v })}
              accent="#4ADE80"
            />
          </div>

          <div>
            <Legend className="mb-3">Per-band stereo width</Legend>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {BANDS.map((band, idx) => (
                <Fader
                  key={band.index}
                  label={`${band.index + 1} · ${band.range}`}
                  value={s.bands[idx].width}
                  min={0}
                  max={200}
                  step={1}
                  digits={0}
                  unit="%"
                  accent={band.color}
                  onChange={(v) => setBand(idx, { width: v })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}
