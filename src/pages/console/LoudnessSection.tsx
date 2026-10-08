import { Fader, Legend, RackUnit, Readout } from "@/components/tm/ui";
import { LevelMeter } from "@/components/tm/analyzers";
import { chainTargets } from "@/lib/tm/telemetry";
import { fixed } from "@/lib/tm/dsp";
import { useConsole } from "./context";
import { useMaster } from "./master";

const TONE = {
  default: "rgba(255,255,255,0.92)",
  green: "#4ADE80",
  amber: "#F5A524",
  red: "#FF4D4D",
  cyan: "#35C8D8",
} as const;

function Stat({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-[#1E232A] px-3 py-3">
      <span className="text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className="font-mono text-[26px] leading-none font-semibold tabular-nums tracking-tight"
        style={{ color: TONE[tone] }}
      >
        {value}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}

/** Unit 08 — professional loudness console: BS.1770 momentary / short-term /
 *  integrated, LRA, true peak with a SAFE-WARNING-ERROR state, and a
 *  configurable target with live offset. */
export function LoudnessSection() {
  const { cfg, presetKey, running } = useConsole();
  const { tel, target, setTarget } = useMaster();
  const { target: chainTarget, ceiling } = chainTargets(cfg, presetKey);

  const offset = tel.integrated - target;
  const offsetTone =
    Math.abs(offset) <= 0.5 ? "green" : Math.abs(offset) <= 1.5 ? "amber" : "red";
  const lraTone = tel.lra > 15 ? "red" : tel.lra > 10 ? "amber" : "green";
  const statusTone =
    tel.tpStatus === "SAFE" ? "green" : tel.tpStatus === "WARNING" ? "amber" : "red";

  return (
    <RackUnit
      index="08"
      title="Loudness & True Peak"
      eyebrow="ITU-R BS.1770 · EBU R128 gated measurement"
      accent="#4ADE80"
      right={
        <div className="flex items-center gap-4">
          <Readout value={fixed(tel.integrated, 1)} unit="LUFS-I" tone="green" />
          <Readout
            value={fixed(tel.truePeakDb, 1)}
            unit="dBTP"
            tone={statusTone === "amber" ? "accent" : statusTone}
          />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Momentary LUFS" value={fixed(tel.momentary, 1)} unit="LUFS" tone="cyan" />
            <Stat label="Short-term LUFS" value={fixed(tel.shortTerm, 1)} unit="LUFS" tone="cyan" />
            <Stat label="Integrated LUFS" value={fixed(tel.integrated, 1)} unit="LUFS" tone="green" />
            <Stat label="LRA" value={fixed(tel.lra, 1)} unit="LU" tone={lraTone} />
            <Stat
              label="True peak"
              value={fixed(tel.truePeakDb, 1)}
              unit="dBTP"
              tone={statusTone}
            />
            <Stat label="Gain reduction" value={`−${fixed(tel.grDb, 1)}`} unit="dB" tone="amber" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LevelMeter label="Momentary" value={tel.momentary} min={-40} max={-5} unit="LUFS" accent="#35C8D8" />
            <LevelMeter label="Short-term" value={tel.shortTerm} min={-40} max={-5} unit="LUFS" accent="#35C8D8" />
            <LevelMeter label="Integrated" value={tel.integrated} min={-40} max={-5} unit="LUFS" accent="#4ADE80" />
            <LevelMeter
              label="True peak"
              value={tel.truePeakDb}
              min={-12}
              max={2}
              ceiling={ceiling}
              unit="dBTP"
              accent="#F5A524"
            />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Momentary, short-term and integrated are measured from the shared program
            model with an EBU relative gate; LRA is the 10–95 % spread of the same
            window. Chain compliance target for this output is{" "}
            <span className="font-mono text-foreground/85">{fixed(chainTarget, 1)} LUFS</span>{" "}
            at a <span className="font-mono text-foreground/85">{fixed(ceiling, 1)} dBTP</span>{" "}
            ceiling — the operator target below is independent and configurable.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* true peak verdict */}
          <div className="rounded-lg border border-border/60 bg-[#1E232A] p-4">
            <div className="flex items-center justify-between">
              <Legend>True peak</Legend>
              <span
                className="rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase"
                style={{
                  color:
                    tel.tpStatus === "SAFE"
                      ? "#4ADE80"
                      : tel.tpStatus === "WARNING"
                        ? "#F5A524"
                        : "#FF4D4D",
                  borderColor:
                    tel.tpStatus === "SAFE"
                      ? "rgba(74,222,128,0.5)"
                      : tel.tpStatus === "WARNING"
                        ? "rgba(245,165,36,0.5)"
                        : "rgba(255,77,77,0.5)",
                  background:
                    tel.tpStatus === "SAFE"
                      ? "rgba(74,222,128,0.10)"
                      : tel.tpStatus === "WARNING"
                        ? "rgba(245,165,36,0.10)"
                        : "rgba(255,77,77,0.10)",
                }}
              >
                {tel.tpStatus}
              </span>
            </div>
            <div
              className="mt-3 font-mono text-[46px] leading-none font-semibold tabular-nums tracking-tight"
              style={{ color: statusTone === "green" ? "#4ADE80" : statusTone === "amber" ? "#F5A524" : "#FF4D4D" }}
            >
              {fixed(tel.truePeakDb, 2)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="tracking-[0.16em] uppercase">dBTP</span>
              <span className="font-mono tabular-nums">
                ceiling {fixed(ceiling, 1)} dBTP · {running ? "measured" : "engine idle"}
              </span>
            </div>
          </div>

          {/* target / current / offset */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-[#1E232A] p-4">
            <Legend>Loudness target</Legend>
            <Fader
              label="Target"
              value={target}
              min={-30}
              max={-5}
              step={0.5}
              unit="LUFS"
              accent="#4ADE80"
              onChange={setTarget}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border/60 bg-[#12161B] px-3 py-2">
                <span className="block text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                  Current
                </span>
                <span className="font-mono text-[17px] font-semibold tabular-nums text-[#4ADE80]">
                  {fixed(tel.integrated, 1)}
                  <span className="ml-1 text-[9px] text-muted-foreground">LUFS</span>
                </span>
              </div>
              <div className="rounded-md border border-border/60 bg-[#12161B] px-3 py-2">
                <span className="block text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                  Offset
                </span>
                <span
                  className="font-mono text-[17px] font-semibold tabular-nums"
                  style={{
                    color: offsetTone === "green" ? "#4ADE80" : offsetTone === "amber" ? "#F5A524" : "#FF4D4D",
                  }}
                >
                  {offset >= 0 ? "+" : "−"}
                  {fixed(Math.abs(offset), 1)}
                  <span className="ml-1 text-[9px] text-muted-foreground">LU</span>
                </span>
              </div>
            </div>
            <span className="text-[10px] leading-relaxed text-muted-foreground">
              Target is the operator set-point (default −9 LUFS); offset is measured
              integrated minus target.
            </span>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}
