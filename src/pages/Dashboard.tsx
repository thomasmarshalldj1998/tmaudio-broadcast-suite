import { PATH_COLORS, fixed } from "@/lib/tm/dsp";
import { getPreset, type PresetKey, type ProcessorConfig } from "@/lib/tm/presets";
import { LevelMeter, loudness, truePeak, useTick } from "@/components/tm/analyzers";
import { Led, Legend, Readout, Segmented } from "@/components/tm/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { LogOut, Pause, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ConsoleContext, type ConsoleCtx } from "./console/context";
import {
  ImagingSection,
  InputSection,
  SensusSection,
} from "./console/ProcessingSections";
import { AdvancedSection } from "./console/AdvancedSection";
import { FactoryPresetsSection } from "./console/FactoryPresets";
import { OutputChainsSection } from "./console/OutputChains";
import { ReferenceSection } from "./console/Reference";
import { RdsSection } from "./console/RdsSection";
import { StandaloneSection } from "./console/StandaloneSection";
import logo from "@/assets/logo.svg";

const PRESET_TABS: { value: PresetKey; label: string }[] = [
  { value: "fm", label: "FM Optimised" },
  { value: "dab", label: "DAB+ Standard" },
  { value: "web", label: "Web 128 kbps" },
  { value: "hd", label: "HD Hybrid" },
];

function chainTargets(cfg: ProcessorConfig, key: PresetKey) {
  if (key === "dab") return { target: cfg.dab.loudness, ceiling: cfg.dab.truePeak };
  if (key === "web") return { target: cfg.web.loudness, ceiling: cfg.web.truePeak };
  if (key === "hd") return { target: -16, ceiling: -2 };
  return { target: -14, ceiling: -1 };
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [cfg, setCfg] = useState<ProcessorConfig>(
    () => getPreset("fm").config,
  );
  const [presetKey, setPresetKey] = useState<PresetKey>("fm");
  const [presetLabel, setPresetLabel] = useState<string>(getPreset("fm").name);
  const [presetNote, setPresetNote] = useState<string>(getPreset("fm").note);
  const [running, setRunning] = useState(true);
  const [dirty, setDirty] = useState(false);

  useTick(90);
  const t = performance.now() / 1000;
  const { target, ceiling } = chainTargets(cfg, presetKey);
  const preset = getPreset(presetKey);

  const cpu = 6.4 + (running ? 3.1 : 0.4) + (Math.sin(t * 0.8) + 1) * 1.3;

  const ctx = useMemo<ConsoleCtx>(
    () => ({
      cfg,
      running,
      presetKey,
      presetLabel,
      presetNote,
      cpu,
      setRunning,
      set: (key, patch) => {
        setCfg((prev) => {
          const section = prev[key] as Record<string, unknown>;
          const merged = { ...section, ...(patch as Record<string, unknown>) };
          return { ...prev, [key]: merged } as unknown as ProcessorConfig;
        });
        setDirty(true);
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
      },
      loadPreset: (key) => {
        const preset = getPreset(key);
        setCfg(preset.config);
        setPresetKey(key);
        setPresetLabel(preset.name);
        setPresetNote(preset.note);
        setDirty(false);
      },
      loadConfig: (config, label, note, chain) => {
        setCfg(config);
        setPresetKey(chain);
        setPresetLabel(label);
        setPresetNote(note);
        setDirty(false);
      },
      markDirty: () => setDirty(true),
    }),
    [cfg, running, presetKey, presetLabel, presetNote, cpu],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <ConsoleContext.Provider value={ctx}>
      <div className="min-h-screen bg-[#181C22] text-foreground">
        {/* ---------------- rack header ---------------- */}
        <header className="sticky top-0 z-40 border-b border-border/70 bg-[#181C22]/95 backdrop-blur supports-[backdrop-filter]:bg-[#181C22]/85">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
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
                  TMAUDIO
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
                {running ? "Running" : "Paused"}
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  const p = getPreset(presetKey);
                  setCfg(p.config);
                  setPresetLabel(p.name);
                  setPresetNote(p.note);
                  setDirty(false);
                }}
                title="Reset this preset to factory values"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>

            <div className="hidden min-w-0 flex-1 xl:block">
              <Segmented<PresetKey>
                value={presetKey}
                onChange={(v) => {
                  const p = getPreset(v);
                  setCfg(p.config);
                  setPresetKey(v);
                  setPresetLabel(p.name);
                  setPresetNote(p.note);
                  setDirty(false);
                }}
                options={PRESET_TABS}
                size="sm"
              />
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex flex-col gap-1.5">
                <LevelMeter
                  label="Loudness"
                  value={loudness(t, target)}
                  min={-40}
                  max={-4}
                  unit="LUFS"
                  width="w-40"
                  accent={PATH_COLORS.fm}
                />
                <LevelMeter
                  label="True peak"
                  value={truePeak(t, ceiling)}
                  min={-12}
                  max={2}
                  ceiling={ceiling}
                  unit="dBTP"
                  width="w-40"
                  accent={PATH_COLORS.fm}
                />
              </div>

              <div className="flex flex-col gap-1.5 border-l border-border/60 pl-5">
                <div className="flex items-center gap-3">
                  <Legend>Engine</Legend>
                  <Readout value="96k / 32f" />
                </div>
                <div className="flex items-center gap-3">
                  <Legend>CPU</Legend>
                  <Readout value={fixed(cpu, 1)} unit="%" tone={cpu > 18 ? "red" : "green"} />
                </div>
                <div className="flex items-center gap-3">
                  <Legend>Blocks</Legend>
                  <Readout value={cfg.sensus.blockSize === 32 ? "32" : "64"} unit="smp" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-l border-border/60 pl-5">
                <div className="flex items-center gap-3">
                  <Led on={running} label="signal" color="#4ADE80" />
                  <Led on={cfg.rds.enabled} label="rds" color="#35C8D8" />
                </div>
                <div className="flex items-center gap-3">
                  <Led on={running} label="mpx" color="#F5A524" />
                  <Led on={dirty} label="edited" color="#FF4D4D" />
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-border/60 pl-5">
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

          <div className="border-t border-border/50 bg-[#1E232A]">
            <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="font-mono text-[10px] tracking-wider text-[#F5A524]">
                  {presetLabel.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {preset.target}
                </span>
                <span className="hidden text-[10px] text-muted-foreground/80 md:inline">
                  {presetNote}
                </span>
              </div>
              <div className="flex items-center gap-x-5 gap-y-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                <span>MPX 192 kHz</span>
                <span>
                  pre-emphasis <span className="text-foreground/80">{cfg.fm.emphasis} µs</span>
                </span>
                <span>
                  pilot <span className="text-foreground/80">{fixed(cfg.fm.pilot, 1)} %</span>
                </span>
                <span className="hidden sm:inline">
                  RDS <span className="text-foreground/80">0x{cfg.rds.pi.toString(16).toUpperCase().padStart(4, "0")}</span>
                </span>
                <span>
                  mode <span className="text-foreground/80">{cfg.sensus.mode}</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ---------------- rack units ---------------- */}
        <main className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
          <InputSection />
          <SensusSection />
          <ImagingSection />
          <OutputChainsSection />
          <RdsSection />
          <FactoryPresetsSection />
          <AdvancedSection target={target} ceiling={ceiling} />
          <StandaloneSection />
          <ReferenceSection />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5 pb-2 text-[10px] text-muted-foreground">
            <span>
              TMAUDIO Digital Broadcast Processing Suite — Standalone Edition
              v1.0 · C++20 · JUCE · AVX2 / NEON
            </span>
            <span className="font-mono tabular-nums">
              FM · DAB+ · WEB · HD — four independent chains, one clock
            </span>
          </footer>
        </main>
      </div>
    </ConsoleContext.Provider>
  );
}
