import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ *
 * Event log — a module-level store so every control in the console can
 * record what actually happened (no fake activity: entries are only
 * written by real handlers and real telemetry state transitions).
 * ------------------------------------------------------------------ */

export type LogCategory =
  | "INFO"
  | "AUDIO"
  | "DSP"
  | "ROUTING"
  | "WARNING"
  | "ERROR";

export type LogEntry = {
  id: number;
  at: Date;
  cat: LogCategory;
  msg: string;
};

const MAX = 300;
let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

let quiet = 0;

/** Suppress logging while a bulk operation (morph, slot recall) writes many
 *  parameters at once — the operation logs one entry of its own. */
export function withQuiet(fn: () => void) {
  quiet += 1;
  try {
    fn();
  } finally {
    quiet -= 1;
  }
}

export function pushLog(cat: LogCategory, msg: string) {
  if (quiet) return;
  entries = [{ id: nextId++, at: new Date(), cat, msg }, ...entries].slice(0, MAX);
  emit();
}

export function clearLog() {
  entries = [];
  emit();
}

export function getLog(): LogEntry[] {
  return entries;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useLog(): LogEntry[] {
  return useSyncExternalStore(subscribe, getLog, getLog);
}

export const CATEGORY_COLOR: Record<LogCategory, string> = {
  INFO: "#9AA3AF",
  AUDIO: "#4ADE80",
  DSP: "#F5A524",
  ROUTING: "#35C8D8",
  WARNING: "#FBBF24",
  ERROR: "#FF4D4D",
};

/** Deduplicate repeated telemetry warnings: only log on state change. */
export function transition(
  key: string,
  next: boolean,
  fire: () => void,
  store: Map<string, boolean>,
) {
  const prev = store.get(key) ?? false;
  if (prev !== next) {
    store.set(key, next);
    if (next) fire();
  }
}
