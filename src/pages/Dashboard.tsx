import { fixed } from "@/lib/tm/dsp";
import { getPreset, type PresetKey, type ProcessorConfig } from "@/lib/tm/presets";
import { chainTargets } from "@/lib/tm/telemetry";
import { pushLog } from "@/lib/tm/log";
import { Led, Readout, Segmented } from "@/components/tm/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { LogOut, Pause, Play, Power, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ConsoleContext, useConsole, type ConsoleCtx } from "./console/context";
import { MasterProvider, useMaster } from "./console/master";
import { MasterSection } from "./console/MasterSection";
import { ActivitySection } from "./console/ActivitySection";
import { LoudnessSection } from "./console/LoudnessSection";
import { AnalysisSection } from "./console/AnalysisSection";
import { MonitoringSection } from "./console/MonitoringSection";
import {
  AudioPathSection,
  EventLogSection,
  SafetySection,
} from "./console/DiagnosticsSection";
import {
  ImagingSection,
  InputSection,
  SensusSection,
} from "./console/ProcessingSections";
import { AdvancedSection } from "./console/AdvancedSection";
import { FactoryPresetsSection } from "./console/FactoryPresets";
import { OutputChainsSection } from "./console/OutputChains";
import { StreamTxSection } from "./console/StreamTx";
import { ReferenceSection } from "./console/Reference";
import { RdsSection } from "./console/RdsSection";
import { StandaloneSection } from "./console/StandaloneSection";
import { ConsoleNav, MobileJumpBar, SettingsPalette } from "./console/Navigator";
import logo from "@/assets/logo.svg";

const PRESET_TABS: { value: PresetKey; label: string }[] = [
  { value: "fm", label: "FM Optimised" },
  { value: "dab", label: "DAB+ Standard" },
  { value: "web", label: "Web 128 kbps" },
  { value: "hd", label: "HD Hybrid" },
];

const COLOR = {
  green: "#4ADE80",
  amber: "#F5A524",
  red: "#FF4D4D",
  grey: "#6B7280",
  cyan: "#35C8D8",
} as const;
type Status = keyof typeof COLOR;

/* ------------------------------------------------------------------ *
 * Page groups — MASTER / PROCESSING / ANALYSIS / MONITORING /
 * DIAGNOSTICS / SYSTEM. Every existing panel keeps its controls.
 * ------------------------------------------------------------------ */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <h2 className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          {label}
        </h2>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </section>
  );
}

/** Signal-flow strip + large live readouts: the processor overview. */
export function Overview({ dirty }: { dirty: boolean }) {
  const { cfg, running, setRunning, presetKey, presetLabel, presetNote } = useConsole();
  const { tel, dspBypass, audioBypass, engineer } = useMaster();
  const preset = getPreset(presetKey);

  const stage = (s: Status, label: string, detail: string) => ({ s, label, detail });

  const enhanceOff =
    cfg.extras.transientEnhancer === 0 &&
    cfg.extras.dynamicEq === 0 &&
    cfg.extras.phatBass === 0;

  const stages = [
    stage(
      !running ? "grey" : tel.inputDb > cfg.input.gate ? "green" : "amber",
      "INPUT",
      `${fixed(tel.inputDb, 1)} dBFS`,
    ),
    stage(
      !running || dspBypass ? "grey" : tel.agcGr > 0.05 ? "amber" : "green",
      "AGC",
      dspBypass ? "bypassed" : `−${fixed(tel.agcGr, 1)} dB`,
    ),
    stage(
      !running || dspBypass ? "grey" : tel.mb3Gr > 0.05 ? "amber" : "green",
      "MULTIBAND",
      dspBypass ? "bypassed" : `−${fixed(tel.mb3Gr, 1)} dB`,
    ),
    stage(
      !running || dspBypass ? "grey" : enhanceOff ? "grey" : "green",
      "ENHANCE",
      dspBypass ? "bypassed" : enhanceOff ? "idle" : "active",
    ),
    stage(
      !running || dspBypass ? "grey" : tel.clipGr > 0.05 ? "amber" : "green",
      "CLIP",
      dspBypass ? "bypassed" : `−${fixed(tel.clipGr, 1)} dB`,
    ),
    stage(
      !running || dspBypass ? "grey" : tel.limitGr > 0.05 ? "amber" : "green",
      "LIMIT",
      dspBypass ? "bypassed" : `−${fixed(tel.limitGr, 1)} dB`,
    ),
    stage(
      !running || audioBypass ? "grey" : tel.tpStatus === "ERROR" ? "red" : "green",
      "OUTPUT",
      audioBypass ? "direct" : `${fixed(tel.truePeakDb, 1)} dBTP`,
    ),
  ];

  const cells = [
    { label: "Input", value: fixed(tel.inputDb, 1), unit: "dBFS", color: "rgba(255,255,255,0.95)" },
    { label: "Output", value: fixed(tel.outputDb, 1), unit: "dBFS", color: "rgba(255,255,255,0.95)" },
    { label: "LUFS-I", value: fixed(tel.integrated, 1), unit: "LUFS", color: COLOR.green },
    {
      label: "True peak",
      value: fixed(tel.truePeakDb, 1),
      unit: "dBTP",
      color:
        tel.tpStatus === "SAFE" ? COLOR.green : tel.tpStatus === "WARNING" ? COLOR.amber : COLOR.red,
    },
    { label: "Gain reduction", value: `−${fixed(tel.grDb, 1)}`, unit: "dB", color: COLOR.amber },
    { label: "Latency", value: fixed(tel.latencyMs, 2), unit: "ms", color: "rgba(255,255,255,0.95)" },
    {
      label: "Sample rate",
      value: (tel.sampleRate / 1000).toFixed(0),
      unit: "kHz",
      color: "rgba(255,255,255,0.95)",
    },
  ];

  return (
    <section className="border-b border-border/60 bg-[#1E232A]/70">
      <div className="mx-auto max-w-[1720px] px-4 py-4 sm:px-6">
        {/* signal flow */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          <span className="mr-2 text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
            Signal flow
          </span>
          {stages.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[11px] text-muted-foreground/60">→</span>}
              <span
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                style={{
                  borderColor: `${COLOR[s.s]}55`,
                  background: `${COLOR[s.s]}12`,
                }}
                title={s.detail}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    background: COLOR[s.s],
                    boxShadow: s.s === "grey" ? "none" : `0 0 6px ${COLOR[s.s]}99`,
                  }}
                />
                <span
                  className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: COLOR[s.s] }}
                >
                  {s.label}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {s.detail}
                </span>
              </span>
            </span>
          ))}
        </div>

        {/* master hardware power — the single switch that starts the engine */}
        <div
          className={cn(
            "mt-4 flex flex-wrap items-center gap-5 rounded-lg border px-4 py-3.5",
            running
              ? "border-[#4ADE80]/40 bg-[#4ADE80]/[0.07]"
              : "border-[#F5A524]/40 bg-[#F5A524]/10",
          )}
        >
          <button
            type="button"
            onClick={() => setRunning(!running)}
            aria-pressed={running}
            aria-label={running ? "Stop audio engine" : "Start audio engine"}
            className="group relative grid size-16 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-95"
            style={{
              borderColor: running ? COLOR.green : COLOR.amber,
              background:
                "radial-gradient(circle at 50% 34%, #2E343C 0%, #171B21 72%)",
              boxShadow: running
                ? `0 0 22px ${COLOR.green}55, inset 0 0 14px ${COLOR.green}33`
                : `inset 0 3px 8px rgba(0,0,0,0.75), 0 0 14px ${COLOR.amber}33`,
            }}
          >
            <Power
              className={cn(
                "size-7 transition-colors",
                running
                  ? "text-[#4ADE80] drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]"
                  : "text-[#F5A524] drop-shadow-[0_0_5px_rgba(245,165,36,0.55)] group-hover:text-[#FFB84A]",
              )}
            />
          </button>

          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: running ? COLOR.green : COLOR.amber }}
            >
              {running ? "Running — engine live" : "Standby — engine stopped"}
            </p>
            <p className="mt-1 max-w-[64ch] text-[11px] leading-relaxed text-muted-foreground">
              {running
                ? "DSP, meters, loudness analysis and every armed Stream TX slot are processing. Press STOP to drop the whole rack back to its floor."
                : "Clean instance: nothing processes until you press RUN — input and loudness read -inf dBFS / 0.0, counters stay at zero, TX slots report 0 kbps and no loop runs in the background."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className="rounded-md border px-3 py-1.5 text-[11px] font-bold tracking-[0.2em] uppercase"
              style={{
                borderColor: running ? `${COLOR.green}66` : `${COLOR.amber}66`,
                color: running ? COLOR.green : COLOR.amber,
                background: running ? `${COLOR.green}14` : `${COLOR.amber}14`,
              }}
            >
              {running ? "Running" : "Standby / Stopped"}
            </span>
            <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
              {running ? "press stop to halt" : "press run to start"}
            </span>
          </div>
        </div>

        {/* large live values */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {cells.map((c) => (
            <div
              key={c.label}
              className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-[#12161B] px-3 py-3"
            >
              <span className="text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                {c.label}
              </span>
              <span
                className="font-mono text-[27px] leading-none font-semibold tabular-nums tracking-tight"
                style={{ color: c.color }}
              >
                {c.value}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  {c.unit}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* context line */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono tracking-wider text-[#F5A524]">
            {presetLabel.toUpperCase()}
          </span>
          <span>{preset.target}</span>
          <span className="hidden md:inline">{presetNote}</span>
          {dirty && (
            <span className="rounded border border-[#FF4D4D]/40 bg-[#FF4D4D]/10 px-1.5 py-0.5 tracking-[0.14em] text-[#FF4D4D] uppercase">
              edited
            </span>
          )}
          {engineer && (
            <span className="rounded border border-[#35C8D8]/40 bg-[#35C8D8]/10 px-1.5 py-0.5 tracking-[0.14em] text-[#35C8D8] uppercase">
              engineer mode
            </span>
          )}
        </div>

        {/* engineering detail — engineer mode only, kept out of the overview */}
        {engineer && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/50 pt-3 font-mono text-[10px] tabular-nums text-muted-foreground">
            <span>
              MPX <span className="text-foreground/80">192 kHz</span>
            </span>
            <span>
              emphasis <span className="text-foreground/80">{cfg.fm.emphasis} µs</span>
            </span>
            <span>
              pilot <span className="text-foreground/80">{fixed(cfg.fm.pilot, 1)} %</span>
            </span>
            <span>
              RDS{" "}
              <span className="text-foreground/80">
                0x{cfg.rds.pi.toString(16).toUpperCase().padStart(4, "0")}
              </span>
            </span>
            <span>
              mode <span className="text-foreground/80">{cfg.sensus.mode}</span>
            </span>
            <span>
              block <span className="text-foreground/80">{cfg.sensus.blockSize} smp</span>
            </span>
            <span>
              loop <span className="text-foreground/80">{fixed(tel.loopMs, 0)} ms</span>
            </span>
            <span>
              engine <span className="text-foreground/80">{running ? "running" : "idle"}</span>
            </span>
            <span>
              target <span className="text-foreground/80">{fixed(tel.integrated, 1)} LUFS</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function ConsoleShell({ dirty, target, ceiling }: { dirty: boolean; target: number; ceiling: number }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { cfg, running, setRunning, presetKey, loadPreset } = useConsole();
  const { engineer, setEngineer, tel } = useMaster();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#181C22] text-foreground">
      {/* ---------------- rack header ---------------- */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-[#181C22]/95 backdrop-blur supports-[backdrop-filter]:bg-[#181C22]/85">          <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <img
              src={logo}
              alt="TMAUDIO"
              width={34}
              height={34}
              className="rounded-md ring-1 ring-white/10 transition-transform group-hover:scale-[1.04]"
            />
            <span className="flex flex-col">
              <span className="text-[13px] leading-none font-semibold tracking-[0.14em] text-foreground">
                TMAUDIO DIGITAL PROCESSOR
              </span>
              <span className="mt-1 hidden text-[9px] leading-none tracking-[0.18em] text-muted-foreground uppercase sm:block">
                Broadcast Processing Suite
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning(!running)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all",
                running
                  ? "border-[#F5A524]/50 bg-[#F5A524]/12 text-[#F5A524] hover:bg-[#F5A524]/20"
                  : "border-border/70 bg-[#2A313A] text-muted-foreground hover:text-foreground",
              )}
            >
              {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {running ? "Stop" : "Start"}
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={() => loadPreset(presetKey)}
              title="Reset this preset to factory values"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-[#2A313A] px-3 py-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase transition-all hover:text-foreground"
              title="Find any setting (⌘K / Ctrl+K)"
            >
              <Search className="size-3.5" />
              Find settings
              <span className="hidden font-mono text-[9px] tracking-normal opacity-70 sm:inline">
                ⌘K
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEngineer(!engineer)}
              className={cn(
                "rounded-lg border px-3 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all",
                engineer
                  ? "border-[#35C8D8]/60 bg-[#35C8D8]/15 text-[#35C8D8]"
                  : "border-border/70 bg-[#2A313A] text-muted-foreground hover:text-foreground",
              )}
            >
              Engineer
            </button>
          </div>

          <div className="hidden min-w-0 flex-1 xl:block">
            <Segmented<PresetKey>
              value={presetKey}
              onChange={(v) => loadPreset(v)}
              options={PRESET_TABS}
              size="sm"
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Led on={running} label="signal" color={COLOR.green} />
                <Led on={cfg.rds.enabled} label="rds" color={COLOR.cyan} />
              </div>
              <div className="flex items-center gap-3">
                <Led on={running} label="mpx" color={COLOR.amber} />
                <Led on={dirty} label="edited" color={COLOR.red} />
              </div>
            </div>

            <div className="hidden flex-col gap-1.5 border-l border-border/60 pl-4 sm:flex">
              <div className="flex items-center gap-3">
                <Legend2>Engine</Legend2>
                <Readout value={`${(tel.sampleRate / 1000).toFixed(0)}k / 32f`} />
              </div>
              <div className="flex items-center gap-3">
                <Legend2>Block</Legend2>
                <Readout value={String(tel.bufferSmp)} unit="smp" />
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-border/60 pl-4">
              <span className="hidden font-mono text-[10px] text-muted-foreground md:block">
                {user?.name ?? user?.email ?? "operator"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <Overview dirty={dirty} />

      {/* ---------------- rack units ---------------- */}
      <main className="mx-auto flex w-full max-w-[1720px] gap-6 px-4 py-5 sm:px-6 sm:py-6">
        <ConsoleNav />
        <div className="flex min-w-0 flex-1 flex-col gap-7">
          <MobileJumpBar />
        <Group label="Master">
          <MasterSection />
        </Group>

        <Group label="Processing">
          <InputSection />
          <SensusSection />
          <ImagingSection />
          <ActivitySection />
          <OutputChainsSection />
          <StreamTxSection />
          <RdsSection />
        </Group>

        <Group label="Analysis">
          <LoudnessSection />
          <AnalysisSection />
        </Group>

        <Group label="Monitoring">
          <MonitoringSection />
        </Group>

        <Group label="Diagnostics">
          <AudioPathSection />
          <SafetySection />
          <EventLogSection />
        </Group>

        <Group label="System">
          <FactoryPresetsSection />
          <AdvancedSection target={target} ceiling={ceiling} />
          <StandaloneSection />
          <ReferenceSection />
        </Group>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5 pb-2 text-[10px] text-muted-foreground">
          <span>
            TMAUDIO Digital Broadcast Processing Suite — Standalone Edition
            v1.0 · C++20 · JUCE · AVX2 / NEON
          </span>
          <span className="font-mono tabular-nums">
            FM · DAB+ · WEB · HD — four independent chains, one clock
          </span>
        </footer>
        </div>
      </main>

      <SettingsPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function Legend2({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

export default function Dashboard() {
  const [cfg, setCfg] = useState<ProcessorConfig>(() => getPreset("fm").config);
  const [presetKey, setPresetKey] = useState<PresetKey>("fm");
  const [presetLabel, setPresetLabel] = useState<string>(getPreset("fm").name);
  const [presetNote, setPresetNote] = useState<string>(getPreset("fm").note);
  const [running, setRunningState] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastLog = useRef(0);

  /** The only way the engine starts or stops — logs the transition so the
   *  event log shows exactly when the rack left standby. */
  const setRunning = (v: boolean) => {
    if (v === running) return;
    setRunningState(v);
    pushLog(
      "AUDIO",
      v
        ? "Engine RUN — DSP, meters, loudness analysis and TX slots active"
        : "Engine STOP — processing halted, all telemetry dropped to floor",
    );
  };

  const { target, ceiling } = chainTargets(cfg, presetKey);

  const logDsp = (msg: string) => {
    const now = Date.now();
    if (now - lastLog.current < 500) return;
    lastLog.current = now;
    pushLog("DSP", msg);
  };

  const ctx = useMemo<ConsoleCtx>(
    () => ({
      cfg,
      running,
      presetKey,
      presetLabel,
      presetNote,
      setRunning,
      set: (key, patch) => {
        setCfg((prev) => {
          const section = prev[key] as Record<string, unknown>;
          const merged = { ...section, ...(patch as Record<string, unknown>) };
          return { ...prev, [key]: merged } as unknown as ProcessorConfig;
        });
        setDirty(true);
        logDsp(`${key} · ${Object.keys(patch as object).join(", ")} updated`);
      },
      setBand: (index, patch) => {
        setCfg((prev) => ({
          ...prev,
          sensus: {
            ...prev.sensus,
            bands: prev.sensus.bands.map((b, i) =>
              i === index ? { ...b, ...patch } : b,
            ),
          },
        }));
        setDirty(true);
        logDsp(
          `band ${index + 1} (${["LOW", "LOW", "MID", "MID", "HIGH", "HIGH"][index]}) · ${Object.keys(patch as object).join(", ")} updated`,
        );
      },
      loadPreset: (key) => {
        const p = getPreset(key);
        setCfg(p.config);
        setPresetKey(key);
        setPresetLabel(p.name);
        setPresetNote(p.note);
        setDirty(false);
        pushLog("INFO", `Preset loaded — ${p.name} (${key.toUpperCase()})`);
      },
      loadConfig: (config, label, note, chain) => {
        setCfg(config);
        setPresetKey(chain);
        setPresetLabel(label);
        setPresetNote(note);
        setDirty(false);
        pushLog("INFO", `Config loaded — ${label} (${chain.toUpperCase()})`);
      },
      markDirty: () => setDirty(true),
    }),
    [cfg, running, presetKey, presetLabel, presetNote],
  );

  return (
    <ConsoleContext.Provider value={ctx}>
      <MasterProvider>
        <ConsoleShell dirty={dirty} target={target} ceiling={ceiling} />
      </MasterProvider>
    </ConsoleContext.Provider>
  );
}
