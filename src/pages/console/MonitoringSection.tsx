import { Led, Legend, RackUnit, Readout, Segmented } from "@/components/tm/ui";
import { LevelMeter, programLevel } from "@/components/tm/analyzers";
import { slotGain } from "@/lib/tm/master";
import { clamp, fixed } from "@/lib/tm/dsp";
import { ChipButton } from "./MasterSection";
import { useConsole } from "./context";
import { useMaster, type MonitorSource } from "./master";

/** Unit 11 — monitor path. Every control here writes only to monitor
 *  state; the broadcast chain (output engine → stream) never reads it. */
export function MonitoringSection() {
  const { tel, monitor, setMonitor, slots } = useMaster();
  const { running } = useConsole();

  const base =
    monitor.source === "input"
      ? tel.inputDb
      : monitor.source === "processed"
        ? tel.processedDb
        : tel.outputDb;

  const activeCfg = monitor.slot === "A" ? slots.A : slots.B;
  const otherCfg = monitor.slot === "A" ? slots.B : slots.A;
  const trim = monitor.match ? slotGain(otherCfg) - slotGain(activeCfg) : 0;

  // Mono sums both channels of the program model, then carries the chain delta.
  const stereo = running
    ? (programLevel(tel.t, 0) + programLevel(tel.t, 1)) / 2
    : -60;
  // In standby base and tel.inputDb are both -inf, so the delta would be
  // NaN — the mono path reports true silence instead.
  const monoLevel =
    running && Number.isFinite(base) ? stereo + (base - tel.inputDb) : Number.NEGATIVE_INFINITY;
  const source = monitor.mono ? monoLevel : base;

  const monitorDb = monitor.mute
    ? -60
    : Number.isFinite(source)
      ? clamp(source + (monitor.dim ? -20 : 0) + trim, -60, 0.5)
      : Number.NEGATIVE_INFINITY;

  return (
    <RackUnit
      index="11"
      title="Monitoring"
      eyebrow="monitor path only — broadcast output is never altered"
      accent="#35C8D8"
      right={
        <div className="flex items-center gap-4">
          <Led on={!monitor.mute} label="monitor" color="#4ADE80" />
          <Led on={monitor.source === "input"} label="in" color="#35C8D8" />
          <Led on={monitor.source === "processed"} label="dsp" color="#F5A524" />
          <Led on={monitor.source === "output"} label="out" color="#4ADE80" />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Legend>Monitor source</Legend>
              <Segmented<MonitorSource>
                value={monitor.source}
                onChange={(v) => setMonitor({ source: v })}
                options={[
                  { value: "input", label: "Input" },
                  { value: "processed", label: "Processed" },
                  { value: "output", label: "Output" },
                ]}
                accent="#35C8D8"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Legend>Monitor slot</Legend>
              <Segmented<"A" | "B">
                value={monitor.slot}
                onChange={(v) => setMonitor({ slot: v })}
                options={[
                  { value: "A", label: "A" },
                  { value: "B", label: "B" },
                ]}
                accent="#35C8D8"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Legend>Monitor controls</Legend>
            <div className="flex flex-wrap items-center gap-2">
              <ChipButton active={monitor.mono} onClick={() => setMonitor({ mono: !monitor.mono })} tone="amber">
                Mono
              </ChipButton>
              <ChipButton active={monitor.dim} onClick={() => setMonitor({ dim: !monitor.dim })} tone="amber">
                Dim
              </ChipButton>
              <ChipButton
                active={monitor.mute}
                onClick={() => setMonitor({ mute: !monitor.mute })}
                tone="red"
              >
                Mute
              </ChipButton>
              <ChipButton
                active={monitor.match}
                onClick={() => setMonitor({ match: !monitor.match })}
                tone="green"
                title="Trim A/B monitoring so switching does not jump level"
              >
                Level match
              </ChipButton>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-[#1E232A] px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Monitor controls affect the <span className="text-foreground/85">monitor path</span>{" "}
            only. The broadcast path — OUTPUT ENGINE → STREAM — reads none of these
            states, so a muted or dimmed monitor never changes what is on air.
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-[#1E232A] p-4">
          <div className="flex items-center justify-between">
            <Legend>Monitor level</Legend>
            <Readout
              value={monitor.mute ? "MUTE" : fixed(monitorDb, 1)}
              unit={monitor.mute ? "" : "dBFS"}
              tone={monitor.mute ? "red" : "green"}
            />
          </div>
          <LevelMeter
            label={`${monitor.source} · slot ${monitor.slot}`}
            value={monitorDb}
            min={-40}
            max={0}
            unit="dBFS"
            accent="#35C8D8"
          />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-border/60 bg-[#12161B] px-2 py-2">
              <span className="block text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                Source
              </span>
              <span className="font-mono text-[13px] tabular-nums text-foreground/90">
                {monitor.mono ? fixed(monoLevel, 1) : fixed(base, 1)}
              </span>
            </div>
            <div className="rounded-md border border-border/60 bg-[#12161B] px-2 py-2">
              <span className="block text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                Dim
              </span>
              <span className="font-mono text-[13px] tabular-nums text-foreground/90">
                {monitor.dim ? "−20.0" : "0.0"}
              </span>
            </div>
            <div className="rounded-md border border-border/60 bg-[#12161B] px-2 py-2">
              <span className="block text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                A/B trim
              </span>
              <span className="font-mono text-[13px] tabular-nums text-foreground/90">
                {monitor.match ? `${trim >= 0 ? "+" : "−"}${fixed(Math.abs(trim), 1)}` : "0.0"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}
