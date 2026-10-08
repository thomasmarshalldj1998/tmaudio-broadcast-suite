import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProcessorConfig } from "@/lib/tm/presets";
import {
  masterBands,
  masterProfile,
  morphConfig,
  slotGain,
  type MasterKey,
} from "@/lib/tm/master";
import {
  chainTargets,
  useTelemetry,
  type Telemetry,
  type TimeWindow,
} from "@/lib/tm/telemetry";
import { pushLog, transition, withQuiet } from "@/lib/tm/log";
import { useConsole } from "./context";

/* ------------------------------------------------------------------ *
 * Master state — preset slots, morph, bypass slewing, monitoring,
 * engineer mode and the loudness target. Wraps the existing console,
 * never replaces it: all writes go through the existing context setters.
 * ------------------------------------------------------------------ */

export type MonitorSource = "input" | "processed" | "output";

export type MonitorState = {
  source: MonitorSource;
  slot: "A" | "B";
  mono: boolean;
  dim: boolean;
  mute: boolean;
  match: boolean;
};

type MasterCtx = {
  master: MasterKey;
  setMaster: (k: MasterKey) => void;
  engineer: boolean;
  setEngineer: (v: boolean) => void;
  slots: { A: ProcessorConfig; B: ProcessorConfig };
  activeSlot: "A" | "B";
  selectSlot: (s: "A" | "B") => void;
  compare: boolean;
  setCompare: (v: boolean) => void;
  morph: number;
  setMorph: (v: number) => void;
  commitMorph: () => void;
  dspBypass: boolean;
  audioBypass: boolean;
  toggleDspBypass: () => void;
  toggleAudioBypass: () => void;
  presetMatch: boolean;
  setPresetMatch: (v: boolean) => void;
  matchTrimDb: number;
  monitor: MonitorState;
  setMonitor: (patch: Partial<MonitorState>) => void;
  target: number;
  setTarget: (v: number) => void;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  dry: number;
  tel: Telemetry;
};

const MasterContext = createContext<MasterCtx | null>(null);

export function useMaster(): MasterCtx {
  const ctx = useContext(MasterContext);
  if (!ctx) throw new Error("useMaster must be used inside MasterProvider");
  return ctx;
}

const RAMP_S = 0.15; // display-domain smoothing for both bypass paths

export function MasterProvider({ children }: { children: ReactNode }) {
  const { cfg, running, presetKey, set, markDirty } = useConsole();

  const [master, setMasterState] = useState<MasterKey>("balanced");
  const [engineer, setEngineerState] = useState(false);
  const [slots, setSlots] = useState(() => ({ A: cfg, B: cfg }));
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [compare, setCompareState] = useState(false);
  const [morph, setMorphState] = useState(50);
  const [dspBypass, setDspBypass] = useState(false);
  const [audioBypass, setAudioBypass] = useState(false);
  const [presetMatch, setPresetMatch] = useState(false);
  const [trimDb, setTrimDb] = useState(0);
  const [monitor, setMonitorState] = useState<MonitorState>({
    source: "processed",
    slot: "A",
    mono: false,
    dim: false,
    mute: false,
    match: false,
  });
  const [target, setTarget] = useState(-9);
  const [window, setWindow] = useState<TimeWindow>("60s");

  const bypassAt = useRef(0);
  const selfWrite = useRef(0);
  const transitions = useRef(new Map<string, boolean>());

  const write = (next: ProcessorConfig, preserveSlots: boolean) => {
    if (preserveSlots) selfWrite.current += 1;
    withQuiet(() => {
      set("input", next.input);
      set("sensus", next.sensus);
      set("imaging", next.imaging);
      set("fm", next.fm);
      set("dab", next.dab);
      set("web", next.web);
      set("hd", next.hd);
      set("rds", next.rds);
      set("extras", next.extras);
      markDirty();
    });
  };

  /* Keep the active A/B slot in step with edits made anywhere in the
     console; provider-driven morph / slot recalls are flagged so the
     morph baseline is never overwritten. */
  useEffect(() => {
    if (selfWrite.current > 0) {
      selfWrite.current -= 1;
      return;
    }
    // While a morph sits between the two slots the console holds an
    // interpolated config — never store that as a slot baseline.
    if (morph > 0 && morph < 100) return;
    setSlots((prev) => ({ ...prev, [activeSlot]: cfg }));
  }, [cfg, activeSlot, morph]);

  const { ceiling } = chainTargets(cfg, presetKey);

  /* ---- bypass smoothing (analytic ramp, no audio thread involved) --- */
  const now = performance.now() / 1000;
  const bypassed = dspBypass || audioBypass;
  const ramp = Math.min(1, Math.max(0, (now - bypassAt.current) / RAMP_S));
  const dry = bypassed ? ramp : 1 - ramp;

  const tel = useTelemetry({
    cfg,
    running,
    presetKey,
    target,
    ceiling,
    window,
    dry,
    trimDb: presetMatch ? trimDb : 0,
  });

  /* ---- real state transitions → event log --------------------------- */
  useEffect(() => {
    transition(
      "tp-warn",
      running && tel.tpStatus === "WARNING",
      () =>
        pushLog(
          "WARNING",
          `True peak ${tel.truePeakDb.toFixed(1)} dBTP approaching ${ceiling.toFixed(1)} dBTP ceiling`,
        ),
      transitions.current,
    );
    transition(
      "tp-err",
      running && tel.tpStatus === "ERROR",
      () =>
        pushLog(
          "ERROR",
          `True peak ${tel.truePeakDb.toFixed(1)} dBTP over ${ceiling.toFixed(1)} dBTP ceiling — limiter at limit`,
        ),
      transitions.current,
    );
    transition(
      "loudness",
      running && Math.abs(tel.integrated - target) > 1,
      () =>
        pushLog(
          "WARNING",
          `Integrated ${tel.integrated.toFixed(1)} LUFS is ${Math.abs(tel.integrated - target).toFixed(1)} LU from target ${target.toFixed(1)} LUFS`,
        ),
      transitions.current,
    );
  }, [tel.tpStatus, tel.truePeakDb, tel.integrated, target, running, ceiling]);

  /* ---- handlers ----------------------------------------------------- */
  const setMaster = (k: MasterKey) => {
    if (k === master) return;
    const p = masterProfile(k);
    const next: ProcessorConfig = {
      ...cfg,
      input: { ...cfg.input, slowGain: p.slowGain, fastGain: p.fastGain },
      sensus: { ...cfg.sensus, bands: masterBands(k, cfg.sensus.bands) },
      imaging: { ...cfg.imaging, coherence: p.coherence },
      extras: {
        ...cfg.extras,
        transientEnhancer: p.transient,
        dynamicEq: p.dynEq,
        phatBass: p.phatBass,
      },
      fm: { ...cfg.fm, mainClip: p.clip },
    };
    write(next, false);
    setMasterState(k);
    pushLog(
      "DSP",
      `Master character → ${k.toUpperCase()} (AGC ${p.slowGain}+${p.fastGain} dB, clip drive ${p.clip} dB, coherence ${p.coherence} %)`,
    );
  };

  const selectSlot = (s: "A" | "B") => {
    if (s === activeSlot && !compare) return;
    const other = slots[s === "A" ? "B" : "A"];
    const next = slots[s];
    const trim = presetMatch ? slotGain(other) - slotGain(next) : 0;
    write(next, true);
    setActiveSlot(s);
    setTrimDb(trim);
    setMorphState(s === "A" ? 0 : 100);
    pushLog(
      "ROUTING",
      `Preset slot ${s} recalled${presetMatch ? ` · level match ${trim >= 0 ? "+" : "−"}${Math.abs(trim).toFixed(1)} dB` : ""}`,
    );
  };

  const setCompare = (v: boolean) => {
    if (v === compare) return;
    // Holding previews the other slot; releasing restores the committed one.
    const preview = v ? slots[activeSlot === "A" ? "B" : "A"] : slots[activeSlot];
    write(preview, true);
    setCompareState(v);
    pushLog(
      "DSP",
      v
        ? `Comparing slot ${activeSlot === "A" ? "B" : "A"}`
        : `Compare released — slot ${activeSlot} restored`,
    );
  };

  const setMorph = (v: number) => {
    setMorphState(v);
    write(morphConfig(slots.A, slots.B, v / 100), true);
  };

  const commitMorph = () => {
    pushLog("DSP", `Preset morph set to ${morph} % (A ${100 - morph} / B ${morph})`);
  };

  const toggleDspBypass = () => {
    bypassAt.current = performance.now() / 1000;
    const next = !dspBypass;
    setDspBypass(next);
    pushLog("DSP", next ? "DSP BYPASS engaged — processing bypassed" : "DSP BYPASS released — processing active");
  };

  const toggleAudioBypass = () => {
    bypassAt.current = performance.now() / 1000;
    const next = !audioBypass;
    setAudioBypass(next);
    pushLog(
      "ROUTING",
      next ? "AUDIO BYPASS — input patched straight to output" : "Audio bypass released — path through engines restored",
    );
  };

  const setMonitor = (patch: Partial<MonitorState>) => {
    setMonitorState((prev) => ({ ...prev, ...patch }));
    const labels: Record<string, string> = {
      source: "monitor source",
      slot: "monitor slot",
      mono: "MONO",
      dim: "DIM",
      mute: "MUTE",
      match: "LEVEL MATCH",
    };
    for (const [k, v] of Object.entries(patch)) {
      pushLog(
        k === "mute" || k === "dim" || k === "match" ? "AUDIO" : "ROUTING",
        `${labels[k] ?? k} → ${typeof v === "boolean" ? (v ? "on" : "off") : String(v)} (monitor path only)`,
      );
    }
  };

  const setEngineer = (v: boolean) => {
    setEngineerState(v);
    pushLog("INFO", v ? "ENGINEER MODE on — diagnostics visible" : "Engineer mode off — operator view");
  };

  const selectCompareSlot = compare ? (activeSlot === "A" ? "B" : "A") : activeSlot;

  const value: MasterCtx = {
    master,
    setMaster,
    engineer,
    setEngineer,
    slots,
    activeSlot: selectCompareSlot,
    selectSlot,
    compare,
    setCompare,
    morph,
    setMorph,
    commitMorph,
    dspBypass,
    audioBypass,
    toggleDspBypass,
    toggleAudioBypass,
    presetMatch,
    setPresetMatch: (v) => {
      setPresetMatch(v);
      pushLog("AUDIO", `Level match ${v ? "armed" : "off"}`);
    },
    matchTrimDb: presetMatch ? trimDb : 0,
    monitor,
    setMonitor,
    target,
    setTarget: (v) => {
      setTarget(v);
      pushLog("AUDIO", `Loudness target → ${v.toFixed(1)} LUFS`);
    },
    window,
    setWindow: (w) => setWindow(w),
    dry,
    tel,
  };

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>;
}

/** Chain compliance target (used by the existing compliance panel). */
export function useChainTarget() {
  const { cfg, presetKey } = useConsole();
  return chainTargets(cfg, presetKey);
}
