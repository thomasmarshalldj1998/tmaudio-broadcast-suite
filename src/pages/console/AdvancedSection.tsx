import { PATH_COLORS, clamp, fixed } from "@/lib/tm/dsp";
import {
  LoudnessHistory,
  loudness,
  programLevel,
  truePeak,
  useTick,
} from "@/components/tm/analyzers";
import { Fader, Legend, RackUnit, Readout, Segmented } from "@/components/tm/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Download, Printer } from "lucide-react";
import { useConsole } from "./context";

const PATCH_POINTS = [
  "Input",
  "Post-AGC",
  "Sensus",
  "Imaging",
  "FM chain",
  "Output",
] as const;

const FEATURES: {
  key:
    | "silenceDetect"
    | "fallbackInput"
    | "aes67"
    | "djBypass"
    | "watermark"
    | "webRemote"
    | "complianceLog";
  label: string;
  note: string;
}[] = [
  { key: "silenceDetect", label: "Silence detect", note: "auto-switch on dead air" },
  { key: "fallbackInput", label: "Input fallback", note: "backup source armed" },
  { key: "aes67", label: "AES67 / Ravenna", note: "network audio I/O" },
  { key: "djBypass", label: "DJ low-latency bypass", note: "zero-latency direct feed" },
  { key: "watermark", label: "Watermark patch point", note: "side-chain ID insert" },
  { key: "webRemote", label: "Web remote control", note: "browser metering server" },
  { key: "complianceLog", label: "24 h compliance log", note: "loudness + modulation" },
];

/** Deterministic 24 h compliance log: 144 rows at 10-minute intervals. */
export function complianceRows(target: number, ceiling: number) {
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rows: string[][] = [];
  const now = new Date();
  now.setSeconds(0, 0);
  for (let i = 143; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 10 * 60 * 1000);
    const integrated = target + (rnd() - 0.5) * 2.2;
    const shortTerm = integrated + 2 + rnd() * 3.5;
    const truePeak = ceiling - rnd() * 0.7;
    const modulation = 84 + rnd() * 15.5;
    const pilot = 9 + (rnd() - 0.5) * 0.08;
    rows.push([
      t.toISOString().slice(0, 16).replace("T", " "),
      integrated.toFixed(2),
      shortTerm.toFixed(2),
      truePeak.toFixed(2),
      modulation.toFixed(1),
      pilot.toFixed(2),
      modulation <= 100 && truePeak <= ceiling + 0.01 ? "OK" : "OVER",
    ]);
  }
  return rows;
}

export const COMPLIANCE_HEADER = [
  "timestamp_local",
  "integrated_lufs",
  "shortterm_max_lufs",
  "true_peak_dbtp",
  "modulation_pct",
  "pilot_pct",
  "status",
];

export function complianceCsv(target: number, ceiling: number): string {
  return [COMPLIANCE_HEADER.join(","), ...complianceRows(target, ceiling).map((r) => r.join(","))].join("\n");
}

function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-[#0E1014] px-3 py-2.5 transition-colors hover:border-border">
      <span className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-foreground/90">{label}</span>
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
          {note}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function AdvancedSection({
  target,
  ceiling,
}: {
  target: number;
  ceiling: number;
}) {
  const { cfg, set, running } = useConsole();
  const x = cfg.extras;
  useTick(120);
  const t = performance.now() / 1000;

  const level = programLevel(t);
  const modulation = clamp(Math.pow(10, level / 20) * 100, 0, 100);
  const rows = complianceRows(target, ceiling);
  const recent = rows.slice(-6).reverse();

  const exportCsv = () => {
    const blob = new Blob([complianceCsv(target, ceiling)], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tmaudio-compliance-24h.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <RackUnit
      index="08"
      title="Station Features, Monitoring & Compliance"
      eyebrow="fallback · patch bay · loudness history · 24 h log"
      accent="#4ADE80"
      right={
        <div className="flex items-center gap-4">
          <Readout value={fixed(modulation, 1)} unit="% mod" tone="accent" />
          <Readout
            value={fixed(loudness(t, target), 1)}
            unit="LUFS-I"
            tone="green"
          />
          <Readout value={fixed(truePeak(t, ceiling), 1)} unit="dBTP" />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Toggle
                key={f.key}
                label={f.label}
                note={f.note}
                checked={x[f.key] as boolean}
                onChange={(v) =>
                  set("extras", { [f.key]: v } as Partial<
                    typeof cfg.extras
                  >)
                }
              />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Fader
              label="Transient detail enhancer"
              value={x.transientEnhancer}
              min={0}
              max={8}
              step={0.1}
              unit="dB"
              accent="#4ADE80"
              onChange={(v) => set("extras", { transientEnhancer: v })}
            />
            <Fader
              label="Dynamic EQ"
              value={x.dynamicEq}
              min={0}
              max={100}
              step={1}
              digits={0}
              unit="%"
              accent="#4ADE80"
              onChange={(v) => set("extras", { dynamicEq: v })}
            />
            <Fader
              label="Phat Bass < 80 Hz"
              value={x.phatBass}
              min={0}
              max={100}
              step={1}
              digits={0}
              unit="%"
              accent="#F5A524"
              onChange={(v) => set("extras", { phatBass: v })}
            />
            <Fader
              label="Preset cross-fade"
              value={x.presetCrossfadeMs}
              min={0}
              max={4000}
              step={50}
              digits={0}
              unit="ms"
              onChange={(v) => set("extras", { presetCrossfadeMs: v })}
            />
            <Fader
              label="Silence timeout"
              value={x.silenceTimeoutS}
              min={2}
              max={120}
              step={1}
              digits={0}
              unit="s"
              onChange={(v) => set("extras", { silenceTimeoutS: v })}
            />
            <div className="flex flex-col justify-end gap-2">
              <Legend>Patch bay — monitor tap</Legend>
              <Segmented<string>
                value={x.patchPoint}
                onChange={(v) => set("extras", { patchPoint: v })}
                accent={PATH_COLORS.dab}
                size="sm"
                options={PATCH_POINTS.map((p) => ({ value: p, label: p }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Legend>Loudness history · integrated / short-term / momentary</Legend>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                target {fixed(target, 1)} LUFS · ceiling {fixed(ceiling, 1)} dBTP
              </span>
            </div>
            <LoudnessHistory target={target} running={running} />
          </div>
        </div>

        {/* ---------------- compliance log ---------------- */}
        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-[#0E1014] p-4">
          <div className="flex items-center justify-between">
            <Legend>24 h compliance log</Legend>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {rows.length} rows
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-border/50">
            <div className="grid grid-cols-[86px_54px_54px_54px] gap-1 border-b border-border/50 bg-[#14171C] px-2 py-1.5 text-[8px] tracking-[0.1em] text-muted-foreground uppercase">
              <span>Time</span>
              <span className="text-right">LUFS</span>
              <span className="text-right">dBTP</span>
              <span className="text-right">Mod %</span>
            </div>
            <div className="divide-y divide-border/40">
              {recent.map((r, i) => (
                <div
                  key={`${r[0]}-${i}`}
                  className="grid grid-cols-[86px_54px_54px_54px] gap-1 px-2 py-1.5 font-mono text-[10px] tabular-nums"
                >
                  <span className="text-muted-foreground">{r[0].slice(11)}</span>
                  <span className="text-right text-foreground/85">{r[1]}</span>
                  <span className="text-right text-foreground/85">{r[3]}</span>
                  <span className="text-right text-[#4ADE80]">{r[4]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Print / PDF
            </Button>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Ten-minute intervals for the last 24 hours: integrated loudness,
            short-term maximum, true peak, modulation depth, pilot stability and
            pass/fail status — the record a regulator asks for.
          </p>

          <div className="mt-1 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
            <div className="flex flex-col gap-1">
              <Legend>Silence timeout</Legend>
              <Readout value={`${x.silenceTimeoutS}`} unit="s" />
            </div>
            <div className="flex flex-col gap-1">
              <Legend>Monitor tap</Legend>
              <Readout value={x.patchPoint} tone="accent" />
            </div>
            <div className="flex flex-col gap-1">
              <Legend>Pilot</Legend>
              <Readout value={fixed(cfg.fm.pilot, 2)} unit="%" />
            </div>
            <div className="flex flex-col gap-1">
              <Legend>RDS level</Legend>
              <Readout value={fixed(cfg.rds.injection, 1)} unit="%" tone="green" />
            </div>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}
