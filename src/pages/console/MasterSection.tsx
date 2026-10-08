import type { ReactNode } from "react";
import { Legend, RackUnit, Readout, Segmented, GrBar } from "@/components/tm/ui";
import { MASTER_LEVELS } from "@/lib/tm/master";
import { getPreset } from "@/lib/tm/presets";
import { cn } from "@/lib/utils";
import { fixed } from "@/lib/tm/dsp";
import { useConsole } from "./context";
import { useMaster } from "./master";

export function ChipButton({
  active,
  onClick,
  onDown,
  onUp,
  children,
  tone = "amber",
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  onDown?: () => void;
  onUp?: () => void;
  children: ReactNode;
  tone?: "amber" | "red" | "green";
  title?: string;
}) {
  const tones = {
    amber: "border-[#F5A524]/55 bg-[#F5A524]/12 text-[#F5A524]",
    red: "border-[#FF4D4D]/55 bg-[#FF4D4D]/12 text-[#FF4D4D]",
    green: "border-[#4ADE80]/55 bg-[#4ADE80]/12 text-[#4ADE80]",
  } as const;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDown?.();
        }
      }}
      onKeyUp={() => onUp?.()}
      onBlur={() => onUp?.()}
      className={cn(
        "rounded-lg border px-3 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all",
        active
          ? tones[tone]
          : "border-border/70 bg-[#2A313A] text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Unit 01 — the operator's top-level surface: character, preset slots,
 *  morph, bypass and engineer mode. No engineering detail lives here. */
export function MasterSection() {
  const { presetKey, presetLabel, presetNote } = useConsole();
  const m = useMaster();
  const preset = getPreset(presetKey);
  const level = MASTER_LEVELS.find((l) => l.key === m.master)!;
  const otherSlot = m.activeSlot === "A" ? "B" : "A";

  return (
    <RackUnit
      index="01"
      title="TMAUDIO Master"
      eyebrow="character · preset slots · morph · bypass"
      accent="#F5A524"
      right={
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase",
              m.engineer
                ? "border-[#35C8D8]/50 bg-[#35C8D8]/10 text-[#35C8D8]"
                : "border-border/70 bg-[#2A313A] text-muted-foreground",
            )}
          >
            Operator view
          </span>
          <button
            type="button"
            onClick={() => m.setEngineer(!m.engineer)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase transition-all",
              m.engineer
                ? "border-[#35C8D8]/60 bg-[#35C8D8]/15 text-[#35C8D8]"
                : "border-border/70 bg-[#2A313A] text-muted-foreground hover:text-foreground",
            )}
          >
            Engineer mode
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ---------------- master character ---------------- */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-2.5">
            <Legend>Master character — coordinates the existing chain only</Legend>
            <Segmented<string>
              value={m.master}
              onChange={(v) => m.setMaster(v as typeof m.master)}
              options={MASTER_LEVELS.map((l) => ({ value: l.key, label: l.label.toUpperCase() }))}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/90">{level.label}</span> — {level.blurb}.
              Writes the existing AGC range, Sensus thresholds / ratios / gains, imaging
              coherence, clip drive and station extras. No extra dynamics are inserted.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-[#1E232A] p-4">
            <Legend>Preset</Legend>
            <div className="mt-2 font-mono text-[19px] leading-tight font-semibold tracking-tight text-[#F5A524]">
              {presetLabel.toUpperCase()}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {preset.target}
            </div>
            <div className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/80">
              {presetNote}
            </div>
          </div>
        </div>

        {/* ---------------- slots + morph ---------------- */}
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2.5">
            <Legend>Recall</Legend>
            <div className="flex flex-wrap items-center gap-2">
              <ChipButton active={m.activeSlot === "A"} onClick={() => m.selectSlot("A")}>
                A
              </ChipButton>
              <ChipButton active={m.activeSlot === "B"} onClick={() => m.selectSlot("B")}>
                B
              </ChipButton>
              <ChipButton
                active={m.compare}
                onDown={() => m.setCompare(true)}
                onUp={() => m.compare && m.setCompare(false)}
                title="Hold to hear the other slot"
              >
                Compare
              </ChipButton>
              <ChipButton
                active={m.dspBypass}
                onClick={m.toggleDspBypass}
                tone="red"
                title="Bypass every DSP stage"
              >
                Bypass
              </ChipButton>
              <ChipButton
                active={m.presetMatch}
                onClick={() => m.setPresetMatch(!m.presetMatch)}
                tone="green"
                title="Trim slot switches to the same program gain"
              >
                Level match
              </ChipButton>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>
                slot {m.activeSlot} active · {m.compare ? `previewing ${otherSlot}` : "committed"}
              </span>
              <span className={m.presetMatch ? "text-[#4ADE80]" : ""}>
                {m.presetMatch ? `trim ${m.matchTrimDb >= 0 ? "+" : "−"}${fixed(Math.abs(m.matchTrimDb), 1)} dB` : "trim off"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Legend>Preset morph</Legend>
              <Readout value={String(m.morph)} unit="%" tone="accent" />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">A</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={m.morph}
                onChange={(e) => m.setMorph(Number(e.target.value))}
                onPointerUp={m.commitMorph}
                onKeyUp={m.commitMorph}
                aria-label="Preset morph between slot A and slot B"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#12161B] accent-[#F5A524] ring-1 ring-black/60"
              />
              <span className="font-mono text-[11px] text-muted-foreground">B</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>A ←────●────→ B</span>
              <span>
                {fixed(100 - m.morph, 0)} / {fixed(m.morph, 0)} — numeric parameters only,
                enums snap
              </span>
            </div>
          </div>
        </div>

        {/* ---------------- bypass ---------------- */}
        <div className="grid gap-4 border-t border-border/50 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2.5">
            <Legend>DSP bypass — processing off, engines still in circuit</Legend>
            <div className="flex flex-wrap items-center gap-2">
              <ChipButton
                active={m.dspBypass}
                onClick={m.toggleDspBypass}
                tone="red"
                title="Bypass every DSP stage"
              >
                DSP Bypass
              </ChipButton>
              <span className="font-mono text-[10px] text-muted-foreground">
                slew {fixed(m.dry * 100, 0)} % dry
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <Legend>Audio bypass — input patched to output, no DSP</Legend>
            <div className="flex flex-wrap items-center gap-2">
              <ChipButton
                active={m.audioBypass}
                onClick={m.toggleAudioBypass}
                tone="red"
                title="Direct input to output"
              >
                Audio Bypass
              </ChipButton>
              <span className="font-mono text-[10px] text-muted-foreground">
                INPUT → OUTPUT, 150 ms ramp
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/50 bg-[#1E232A] px-3 py-2.5">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Live
          </span>
          <GrBar value={m.tel.grDb} peak={m.tel.grDb} max={18} width="w-40" />
          <Readout value={`−${fixed(m.tel.grDb, 1)}`} unit="dB GR" tone="accent" />
          <Readout value={fixed(m.tel.outputDb, 1)} unit="dBFS out" />
          <Readout
            value={fixed(m.tel.truePeakDb, 1)}
            unit="dBTP"
            tone={m.tel.tpStatus === "SAFE" ? "green" : m.tel.tpStatus === "WARNING" ? "accent" : "red"}
          />
          <Readout value={`${m.master.toUpperCase()}`} tone="accent" />
        </div>
      </div>
    </RackUnit>
  );
}
