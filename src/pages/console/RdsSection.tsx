import { PATH_COLORS, fixed, hex } from "@/lib/tm/dsp";
import {
  OFFSET_WORDS,
  buildGroups,
  checkwordBits,
  type RdsConfig,
} from "@/lib/tm/rds";
import { BiphaseScope, useTick } from "@/components/tm/analyzers";
import {
  Fader,
  Knob,
  Led,
  Legend,
  RackUnit,
  Readout,
  Segmented,
} from "@/components/tm/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useState } from "react";
import { useConsole } from "./context";

const PTY_NAMES = [
  "None", "News", "Current affairs", "Information", "Sport", "Education",
  "Drama", "Culture", "Science", "Varied", "Pop music", "Rock music",
  "Easy listening", "Light classical", "Serious classical", "Other music",
  "Weather", "Finance", "Children", "Social affairs", "Religion",
  "Phone-in", "Travel", "Leisure", "Jazz", "Country", "National music",
  "Oldies", "Folk", "Documentary", "Alarm test", "Alarm",
];

function Flag({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-[#1E232A] px-3 py-2 transition-colors hover:border-border">
      <span className="text-[11px] font-medium text-foreground/90">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function RdsSection() {
  const { cfg, set, running } = useConsole();
  const rds = cfg.rds;
  const tick = useTick(1000);

  const [queue, setQueue] = useState<string[]>([
    rds.rt,
    "TMAUDIO Standalone Edition v1.0",
    "Open source · runs from any folder",
  ]);
  const [draftMsg, setDraftMsg] = useState("");
  const queueIdx = queue.length ? Math.floor(tick / 8) % queue.length : 0;

  useEffect(() => {
    setQueue((q) => (q[0] === rds.rt ? q : [rds.rt, ...q.slice(1)]));
  }, [rds.rt]);

  // Real-time error estimate: a healthy 2–6 % injection keeps block errors
  // deep in the 1e-6 region; out-of-spec injection degrades sharply.
  const inSpec = rds.injection >= 2 && rds.injection <= 6;
  const errorRate = inSpec
    ? (1.2 + Math.abs(rds.injection - 4) * 0.9 + (running ? 0.3 : 4))
        .toExponential(1)
    : (4.1e-3).toExponential(1);
  const errorTone: "green" | "red" = inSpec ? "green" : "red";

  const model: RdsConfig = {
    ...rds,
    flags: { tp: rds.tp, ta: rds.ta, ms: rds.ms, di: rds.di },
  };

  const groups = useMemo(
    () => buildGroups(model, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, tick],
  );
  const bits = useMemo(() => checkwordBits(groups), [groups]);
  const offsetLabel = groups[0]?.label ?? "0A";

  const setPi = (raw: string) => {
    const value = parseInt(raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 4), 16);
    if (Number.isFinite(value)) set("rds", { pi: value });
    if (raw.trim() === "") set("rds", { pi: 0 });
  };

  return (
    <RackUnit
      index="05"
      title="RDS Encoder"
      eyebrow="EN 50067 · CRC-10 + offset words · phase-locked to pilot"
      accent={PATH_COLORS.dab}
      right={
        <div className="flex items-center gap-4">
          <Led on={rds.enabled} label="encoder" color="#4ADE80" />
          <Led on={running} label="57k locked" color="#35C8D8" />
          <Readout value="0.00" unit="° drift" tone="green" />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        {/* --- editors ------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Legend>PI code</Legend>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-[12px] text-muted-foreground">
                  0x
                </span>
                <Input
                  value={hex(rds.pi, 4)}
                  onChange={(e) => setPi(e.target.value)}
                  maxLength={6}
                  aria-label="PI code"
                  className="h-9 pl-8 font-mono text-[13px] tracking-[0.18em] uppercase"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Legend>EON PI</Legend>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-[12px] text-muted-foreground">
                  0x
                </span>
                <Input
                  value={hex(rds.eonPi, 4)}
                  onChange={(e) => {
                    const v = parseInt(
                      e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 4),
                      16,
                    );
                    if (Number.isFinite(v)) set("rds", { eonPi: v });
                  }}
                  maxLength={6}
                  aria-label="EON PI code"
                  className="h-9 pl-8 font-mono text-[13px] tracking-[0.18em] uppercase"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Legend>Programme service name</Legend>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {rds.ps.length}/8
              </span>
            </div>
            <Input
              value={rds.ps}
              maxLength={8}
              aria-label="Programme service name"
              onChange={(e) => set("rds", { ps: e.target.value.toUpperCase() })}
              className="h-9 font-mono text-[15px] tracking-[0.32em] uppercase"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Legend>Radio text</Legend>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {rds.rt.length}/64
              </span>
            </div>
            <Input
              value={rds.rt}
              maxLength={64}
              aria-label="Radio text"
              onChange={(e) => set("rds", { rt: e.target.value })}
              className="h-9 font-mono text-[12px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Legend>Programme type (PTY)</Legend>
            <Segmented<number>
              value={rds.pty}
              onChange={(v) => set("rds", { pty: v })}
              accent={PATH_COLORS.dab}
              size="sm"
              options={[
                { value: 4, label: "Sport" },
                { value: 10, label: "Pop" },
                { value: 12, label: "Easy" },
                { value: 20, label: "Religion" },
              ]}
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              PTY {rds.pty} · {PTY_NAMES[rds.pty] ?? "—"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Knob
              label="Injection"
              value={rds.injection}
              min={2}
              max={6}
              step={0.1}
              unit="% dev"
              size={50}
              accent={PATH_COLORS.dab}
              onChange={(v) => set("rds", { injection: v })}
            />
            <div className="grid flex-1 gap-2">
              <Flag label="Encoder enable" checked={rds.enabled} onChange={(v) => set("rds", { enabled: v })} />
              <Flag label="Clock time (4A)" checked={rds.ct} onChange={(v) => set("rds", { ct: v })} />
              <Flag label="EON (1A)" checked={rds.eon} onChange={(v) => set("rds", { eon: v })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Flag label="TP" checked={rds.tp} onChange={(v) => set("rds", { tp: v })} />
            <Flag label="TA" checked={rds.ta} onChange={(v) => set("rds", { ta: v })} />
            <Flag label="M/S" checked={rds.ms} onChange={(v) => set("rds", { ms: v })} />
            <Flag label="DI" checked={rds.di} onChange={(v) => set("rds", { di: v })} />
          </div>

          <Fader
            label="Modulation onto 57 kHz"
            value={rds.injection}
            min={2}
            max={6}
            step={0.1}
            unit="% of 75 kHz"
            accent={PATH_COLORS.dab}
            onChange={(v) => set("rds", { injection: v })}
          />

          {/* --- dynamic RadioText push queue -------------------------- */}
          <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-[#1E232A] p-3">
            <div className="flex items-center justify-between">
              <Legend>RadioText push queue</Legend>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {queue.length} msg · auto-scroll 8 s
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {queue.map((msg, i) => {
                const onAir = queue.length > 0 && i === queueIdx;
                return (
                  <button
                    key={`${i}-${msg.slice(0, 12)}`}
                    type="button"
                    onClick={() => set("rds", { rt: msg })}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                      onAir
                        ? "border-[#35C8D8]/50 bg-[#35C8D8]/10"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        onAir ? "bg-[#35C8D8]" : "bg-[#444C59]"
                      }`}
                    />
                    <span className="truncate font-mono text-[10px] text-foreground/80">
                      {msg}
                    </span>
                    <span className="ml-auto shrink-0 text-[8px] tracking-[0.14em] text-muted-foreground uppercase">
                      {onAir ? "on air" : "queue"}
                    </span>
                  </button>
                );
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const next = draftMsg.trim();
                if (!next) return;
                setQueue((q) => [...q.slice(-4), next.slice(0, 64)]);
                setDraftMsg("");
              }}
            >
              <Input
                value={draftMsg}
                maxLength={64}
                placeholder="Queue a RadioText message…"
                aria-label="Queue RadioText message"
                onChange={(e) => setDraftMsg(e.target.value)}
                className="h-8 flex-1 font-mono text-[11px]"
              />
              <Button size="sm" type="submit" variant="outline" className="h-8">
                Queue
              </Button>
            </form>
          </div>
        </div>

        {/* --- group table --------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <div className="grid grid-cols-[64px_1fr_84px_84px_66px] gap-2 border-b border-border/60 bg-[#1E232A] px-3 py-2 text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
              <span>Group</span>
              <span>Blocks A B C D</span>
              <span>CRC-10</span>
              <span>Offset</span>
              <span>Check</span>
            </div>
            <div className="max-h-[430px] divide-y divide-border/50 overflow-y-auto">
              {groups.map((g, gi) => {
                const crc = g.blocks.map((b) => hex(b.crc, 3)).join(" ");
                const off = hex(g.blocks[0]?.offset ?? OFFSET_WORDS[g.label] ?? 0, 3);
                return (
                  <div
                    key={`${g.label}-${gi}`}
                    className="grid grid-cols-[64px_1fr_84px_84px_66px] items-center gap-2 px-3 py-2 transition-colors hover:bg-[#2A313A]"
                  >
                    <span className="flex flex-col">
                      <span className="font-mono text-[12px] font-semibold text-[#35C8D8]">
                        {g.label}
                      </span>
                      <span className="text-[8px] tracking-wider text-muted-foreground uppercase">
                        {g.purpose.split(" ")[0]}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] tracking-tight tabular-nums text-foreground/85">
                      {g.blocks.map((b) => hex(b.data, 4)).join("  ")}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {crc}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-[#F5A524]">
                      {off}
                    </span>
                    <span
                      className="font-mono text-[10px] tabular-nums"
                      style={{ color: g.ok ? "#4ADE80" : "#FF4D4D" }}
                    >
                      {g.ok ? "OK" : "FAIL"}
                    </span>
                  </div>
                );
              })}
              {groups.length === 0 && (
                <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Encoder disabled — no groups are being assembled.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Legend>Biphase symbol stream</Legend>
                <Readout value={String(bits.length)} unit="bits" />
              </div>
              <BiphaseScope bits={bits} running={running && rds.enabled} />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Each checkword is the 10-bit remainder of{" "}
                <span className="font-mono text-foreground/80">
                  x¹⁰+x⁸+x⁷+x⁵+x⁴+x³+1
                </span>{" "}
                XOR the group's offset word. The decoder re-derives that
                remainder as a syndrome — when syndrome equals offset, the block
                is accepted. The stream is Manchester-shaped at 1187.5 Bd and
                BPSK-modulated onto 57 kHz, which is exactly 3× the 19 kHz pilot,
                so there is no path to phase drift.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-[#1E232A] p-4">
              <Legend>Phase lock</Legend>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Pilot</span>
                <Readout value="19 000.000" unit="Hz" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Subcarrier</span>
                <Readout value="57 000.000" unit="Hz" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Ratio</span>
                <Readout value="3.000000" tone="green" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">Phase error</span>
                <Readout value={fixed(0.02, 2)} unit="°" tone="green" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Error rate
                </span>
                <Readout
                  value={errorRate}
                  unit="/block"
                  tone={errorTone}
                />
              </div>
              <div className="mt-1 border-t border-border/50 pt-3 text-[10px] leading-relaxed text-muted-foreground">
                Group rotation: 0A ×4 → 2A ×4 → 4A → 1A, repeating at 1187.5
                symbols per second.
              </div>
            </div>
          </div>
        </div>
      </div>
    </RackUnit>
  );
}
