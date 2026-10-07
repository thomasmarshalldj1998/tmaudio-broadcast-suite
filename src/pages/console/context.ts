import type { BandCfg, PresetKey, ProcessorConfig } from "@/lib/tm/presets";
import { createContext, useContext } from "react";

export type ConsoleCtx = {
  cfg: ProcessorConfig;
  running: boolean;
  presetKey: PresetKey;
  cpu: number;
  setRunning: (v: boolean) => void;
  set: <K extends keyof ProcessorConfig>(
    key: K,
    patch: Partial<ProcessorConfig[K]>,
  ) => void;
  setBand: (index: number, patch: Partial<BandCfg>) => void;
  loadPreset: (key: PresetKey) => void;
  markDirty: () => void;
};

export const ConsoleContext = createContext<ConsoleCtx | null>(null);

export function useConsole(): ConsoleCtx {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside ConsoleContext");
  return ctx;
}
