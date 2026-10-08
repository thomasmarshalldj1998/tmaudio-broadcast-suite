import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  GROUP_ORDER,
  NAV_UNITS,
  searchSettings,
  type SettingEntry,
} from "./settingsIndex";

/** Smooth-scroll to a rack unit (RackUnit renders id={`unit-<index>`}). */
export function scrollToUnit(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Which rack unit is currently in view — drives the rail highlight. */
function useActiveUnit() {
  const [active, setActive] = useState(NAV_UNITS[0]?.id ?? "unit-01");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = NAV_UNITS.map((u) => document.getElementById(u.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: [0, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return [active, setActive] as const;
}

function RailItem({
  entry,
  active,
  onClick,
}: {
  entry: SettingEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
        active
          ? "bg-[#F5A524]/12 font-medium text-[#F5A524]"
          : "text-muted-foreground hover:bg-[#2A313A] hover:text-foreground",
      )}
    >
      <span className="font-mono text-[9px] tabular-nums opacity-70">{entry.unit}</span>
      <span className="truncate">{entry.short}</span>
    </button>
  );
}

/** Desktop rail — sticky, grouped, scroll-spy. Hidden below xl. */
export function ConsoleNav() {
  const [active, setActive] = useActiveUnit();

  return (
    <nav
      aria-label="Console sections"
      className="sticky top-[76px] hidden max-h-[calc(100vh-96px)] w-[232px] shrink-0 overflow-y-auto pr-1 xl:block"
    >
      <div className="mb-3 rounded-lg border border-border/60 bg-[#1E232A] px-3 py-2">
        <div className="text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
          Navigate
        </div>
        <div className="mt-1 text-[11px] leading-relaxed text-foreground/80">
          Every setting, one click away — or press{" "}
          <kbd className="rounded border border-border/70 bg-[#12161B] px-1 py-0.5 font-mono text-[9px]">
            ⌘K
          </kbd>{" "}
          to search.
        </div>
      </div>

      {GROUP_ORDER.map((group) => {
        const items = NAV_UNITS.filter((u) => u.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="mb-4">
            <div className="mb-1.5 px-2 text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
              {group}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((u) => (
                <RailItem
                  key={u.id}
                  entry={u}
                  active={active === u.id}
                  onClick={() => {
                    setActive(u.id);
                    scrollToUnit(u.id);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Small-screen jump bar — a horizontally scrollable strip above the units. */
export function MobileJumpBar() {
  const [active, setActive] = useActiveUnit();

  return (
    <nav
      aria-label="Console sections"
      className="flex gap-2 overflow-x-auto pb-1 xl:hidden"
    >
      {NAV_UNITS.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => {
            setActive(u.id);
            scrollToUnit(u.id);
          }}
          className={cn(
            "shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase transition-colors",
            active === u.id
              ? "border-[#F5A524]/50 bg-[#F5A524]/12 text-[#F5A524]"
              : "border-border/60 bg-[#1E232A] text-muted-foreground",
          )}
        >
          <span className="font-mono opacity-70">{u.unit}</span> {u.short}
        </button>
      ))}
    </nav>
  );
}

/** ⌘K / Ctrl-K settings search. Jumps to the rack unit that owns the setting. */
export function SettingsPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => searchSettings(q), [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const choose = (entry: SettingEntry) => {
    onClose();
    window.setTimeout(() => scrollToUnit(entry.id), 40);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border/70 bg-[#242A32] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Find settings"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Find
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && results[sel]) {
                e.preventDefault();
                choose(results[sel]);
              }
            }}
            placeholder="stream, TX, encoder, pilot, loudness, preset…"
            aria-label="Search settings"
            className="w-full bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              No setting matches “{q}”. Try “stream”, “TX”, “encoder”, “RDS” or
              “loudness”.
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {results.map((e, i) => (
                <li key={`${e.id}-${i}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(e)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                      i === sel ? "bg-[#F5A524]/12" : "hover:bg-[#2A313A]",
                    )}
                  >
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {e.unit}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-foreground/90">
                        {e.title}
                      </span>
                      <span className="block text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                        {e.group}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-[10px]",
                        i === sel ? "text-[#F5A524]" : "text-muted-foreground/70",
                      )}
                    >
                      ↵
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
          <span>↑ ↓ to move · ↵ to jump · esc to close</span>
          <span className="font-mono">{results.length} settings</span>
        </div>
      </div>
    </div>
  );
}
