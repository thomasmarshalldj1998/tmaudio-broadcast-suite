import { useState } from "react";
import { Legend, RackUnit, Segmented } from "@/components/tm/ui";
import { clearLog, useLog, CATEGORY_COLOR, type LogCategory } from "@/lib/tm/log";
import { WINDOWS, type TimeWindow } from "@/lib/tm/telemetry";
import { fixed } from "@/lib/tm/dsp";
import { cn } from "@/lib/utils";
import { useConsole } from "./context";
import { useMaster } from "./master";

type Status = "green" | "amber" | "red" | "grey";
const COLOR: Record<Status, string> = {
  green: "#4ADE80",
  amber: "#F5A524",
  red: "#FF4D4D",
  grey: "#6B7280",
};
const STATUS_LABEL: Record<Status, string> = {
  green: "healthy",
  amber: "warning",
  red: "error",
  grey: "inactive",
};

/* ================================================================== *
 * Unit 11 — audio path
 * ================================================================== */

export function AudioPathSection() {
  const { cfg, running, presetKey } = useConsole();
  const { tel, dspBypass, audioBypass } = useMaster();

  const gate = cfg.input.gate;
  const signalOk = tel.inputDb > gate;

  const stages: { name: string; status: Status; detail: string }[] = [
    {
      name: "Input",
      status: !running ? "grey" : signalOk ? "green" : "amber",
      detail: running
        ? `${fixed(tel.inputDb, 1)} dBFS${signalOk ? "" : " · below gate"}`
        : "idle",
    },
    {
      name: "Input engine",
      status: !running || audioBypass ? "grey" : signalOk ? "green" : "amber",
      detail: audioBypass ? "patched around" : `repair · gate ${gate} dBFS`,
    },
    {
      name: "TMAUDIO DSP",
      status: !running
        ? "grey"
        : dspBypass
          ? "grey"
          : tel.grDb > 6
            ? "amber"
            : "green",
      detail: dspBypass
        ? "bypassed"
        : `${presetKey.toUpperCase()} · ${fixed(tel.grDb, 1)} dB GR`,
    },
    {
      name: "Output engine",
      status: !running || audioBypass
        ? "grey"
        : tel.tpStatus === "ERROR"
          ? "red"
          : tel.tpStatus === "WARNING"
            ? "amber"
            : "green",
      detail: audioBypass ? "patched around" : `ceiling held · ${fixed(tel.truePeakDb, 1)} dBTP`,
    },
    {
      name: "Stream",
      status: !running || audioBypass
        ? "grey"
        : tel.tpStatus === "ERROR"
          ? "red"
          : "green",
      detail: running
        ? `${(tel.sampleRate / 1000).toFixed(0)} kHz · ${tel.channels} ch · ${cfg.fm.rtpHost}:${cfg.fm.rtpPort}`
        : "no carrier",
    },
  ];

  const metrics = [
    { label: "Sample rate", value: (tel.sampleRate / 1000).toFixed(0), unit: "kHz" },
    { label: "Buffer", value: String(tel.bufferSmp), unit: "smp" },
    { label: "Channels", value: String(tel.channels), unit: "ch" },
    { label: "Latency", value: fixed(tel.latencyMs, 2), unit: "ms" },
    { label: "Dropouts", value: String(tel.counters.dropout), unit: "" },
    { label: "Underruns", value: String(tel.counters.underrun), unit: "" },
  ];

  return (
    <RackUnit
      index="11"
      title="Audio Path"
      eyebrow="live routing with stage health · input → stream"
      accent="#4ADE80"
      right={
        <div className="flex items-center gap-4">
          {(["green", "amber", "red", "grey"] as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: COLOR[s] }} />
              <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                {STATUS_LABEL[s]}
              </span>
            </span>
          ))}
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-1.5">
          {stages.map((s, i) => (
            <div key={s.name}>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-[#1E232A] px-3 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: COLOR[s.status],
                    boxShadow: s.status === "grey" ? "none" : `0 0 8px ${COLOR[s.status]}88`,
                  }}
                />
                <span className="text-[11px] font-semibold tracking-[0.16em] text-foreground/90 uppercase">
                  {s.name}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                  {s.detail}
                </span>
                <span
                  className="w-[64px] text-right text-[9px] tracking-[0.14em] uppercase"
                  style={{ color: COLOR[s.status] }}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div className="my-0.5 pl-4 text-[13px] leading-none text-muted-foreground/70">
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Legend>Path measurements</Legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border/60 bg-[#1E232A] px-3 py-2.5"
              >
                <span className="block text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                  {m.label}
                </span>
                <span className="font-mono text-[17px] font-semibold tabular-nums text-foreground/90">
                  {m.value}
                  {m.unit && (
                    <span className="ml-1 text-[9px] font-normal text-muted-foreground">
                      {m.unit}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Stage health is derived from the live switches and measurements: bypassed
            stages read grey, a healthy signal reads green, an approaching ceiling reads
            amber and a ceiling over-run reads red.
          </span>
        </div>
      </div>
    </RackUnit>
  );
}

/* ================================================================== *
 * Unit 12 — safety counters
 * ================================================================== */

export function SafetySection() {
  const { tel, window, setWindow } = useMaster();

  const cards = [
    {
      label: "Clip events",
      value: tel.counters.clip,
      fault: false,
      note: "program peak over clip drive threshold",
    },
    {
      label: "Limiter events",
      value: tel.counters.limiter,
      fault: false,
      note: "true-peak limiter engaged",
    },
    {
      label: "Dropouts",
      value: tel.counters.dropout,
      fault: true,
      note: "delivery loop gap ≥ 5 s",
    },
    {
      label: "Buffer underruns",
      value: tel.counters.underrun,
      fault: true,
      note: "delivery loop gap ≥ 350 ms",
    },
  ];

  return (
    <RackUnit
      index="12"
      title="Safety Counters"
      eyebrow="measured events in the selected window — never simulated"
      accent="#F5A524"
      right={
        <div className="w-[280px]">
          <Segmented<TimeWindow>
            value={window}
            onChange={setWindow}
            options={WINDOWS.map((w) => ({ value: w.value, label: w.label }))}
            size="sm"
            accent="#35C8D8"
          />
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-[#1E232A] px-3 py-3"
          >
            <span className="text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
              {c.label}
            </span>
            <span
              className="font-mono text-[30px] leading-none font-semibold tabular-nums"
              style={{
                color: c.value === 0 ? "#4ADE80" : c.fault ? "#FF4D4D" : "#F5A524",
              }}
            >
              {c.value}
            </span>
            <span className="text-[10px] leading-snug text-muted-foreground">{c.note}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Window:{" "}
        <span className="font-mono text-foreground/85">
          {WINDOWS.find((w) => w.value === window)?.label}
        </span>
        . Clip and limiter counts are rising-edge detections of the real thresholds in
        the program model; dropouts and underruns are measured gaps in the delivery
        loop, so they stay at zero while the engine keeps up.
      </p>
    </RackUnit>
  );
}

/* ================================================================== *
 * Unit 13 — event log
 * ================================================================== */

const CATS: ("ALL" | LogCategory)[] = [
  "ALL",
  "INFO",
  "AUDIO",
  "DSP",
  "ROUTING",
  "WARNING",
  "ERROR",
];

export function EventLogSection() {
  const entries = useLog();
  const [filter, setFilter] = useState<"ALL" | LogCategory>("ALL");
  const shown = entries.filter((e) => filter === "ALL" || e.cat === filter).slice(0, 60);

  return (
    <RackUnit
      index="13"
      title="Event Log"
      eyebrow="timestamped real events — operator actions and telemetry transitions"
      accent="#35C8D8"
      right={
        <div className="flex flex-wrap items-center gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-md border px-2 py-1 text-[9px] font-semibold tracking-[0.14em] uppercase transition-colors",
                filter === c
                  ? "border-border bg-[#2A313A] text-foreground"
                  : "border-border/60 bg-[#1E232A] text-muted-foreground hover:text-foreground",
              )}
              style={filter === c && c !== "ALL" ? { color: CATEGORY_COLOR[c], borderColor: `${CATEGORY_COLOR[c]}66` } : undefined}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            onClick={clearLog}
            className="rounded-md border border-border/60 px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>
      }
    >
      <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border/60 bg-[#12161B]">
        {shown.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">
            No {filter === "ALL" ? "" : `${filter.toLowerCase()} `}events recorded yet —
            entries appear when a control is used or telemetry crosses a threshold.
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {e.at.toLocaleTimeString([], { hour12: false })}
                </span>
                <span
                  className="w-[70px] shrink-0 text-[9px] font-semibold tracking-[0.12em] uppercase"
                  style={{ color: CATEGORY_COLOR[e.cat] }}
                >
                  {e.cat}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/85">
                  {e.msg}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{entries.length} entries in buffer · newest first</span>
        <span className="font-mono">INFO · AUDIO · DSP · ROUTING · WARNING · ERROR</span>
      </div>
    </RackUnit>
  );
}
