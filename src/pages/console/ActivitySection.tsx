import { GrBar, RackUnit, Readout } from "@/components/tm/ui";
import { fixed } from "@/lib/tm/dsp";
import { useConsole } from "./context";
import { useMaster } from "./master";

type Row = {
  label: string;
  now: number;
  peak?: number;
  max: number;
  color: string;
  note: string;
};

/** Unit 05 — live gain reduction of every stage, straight from the
 *  telemetry model that drives the drawn meters. Nothing is simulated
 *  separately, so these numbers always match the analyser. */
export function ActivitySection() {
  const { running } = useConsole();
  const { tel } = useMaster();

  const rows: Row[] = [
    {
      label: "AGC",
      now: tel.agcGr,
      max: 12,
      color: "#F5A524",
      note: "dual-loop level control",
    },
    {
      label: "MB3 LOW",
      now: tel.mb3.low.now,
      peak: tel.mb3.low.peak,
      max: 14,
      color: "#D97706",
      note: "bands 1–2 · bass to low-mid",
    },
    {
      label: "MB3 MID",
      now: tel.mb3.mid.now,
      peak: tel.mb3.mid.peak,
      max: 14,
      color: "#F5A524",
      note: "bands 3–4 · mid to presence",
    },
    {
      label: "MB3 HIGH",
      now: tel.mb3.high.now,
      peak: tel.mb3.high.peak,
      max: 14,
      color: "#FDE68A",
      note: "bands 5–6 · high-mid to detail",
    },
    {
      label: "CLIPPER",
      now: tel.clipGr,
      max: 14,
      color: "#F5A524",
      note: "two-stage LoIMD clip drive",
    },
    {
      label: "LIMITER",
      now: tel.limitGr,
      max: 6,
      color: "#4ADE80",
      note: "true-peak lookahead stage",
    },
  ];

  return (
    <RackUnit
      index="05"
      title="Processing Activity"
      eyebrow="live gain reduction — AGC · MB3 · clipper · limiter"
      accent="#F5A524"
      right={
        <div className="flex items-center gap-4">
          <Readout value={tel.grDb > 0.05 ? `−${fixed(tel.grDb, 1)}` : "0.0"} unit="dB total" tone="accent" />
          <span
            className={
              running
                ? "font-mono text-[10px] tracking-[0.16em] text-[#4ADE80] uppercase"
                : "font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase"
            }
          >
            {running ? "engine running" : "engine idle"}
          </span>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-[#1E232A] p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold tracking-[0.16em] text-foreground/90 uppercase">
                {r.label}
              </span>
              <span
                className="font-mono text-[13px] tabular-nums"
                style={{ color: r.now > 0.05 ? r.color : "rgba(255,255,255,0.55)" }}
              >
                {r.now > 0.005 ? `−${fixed(r.now, 1)}` : "0.0"}
                <span className="ml-0.5 text-[9px] text-muted-foreground">dB</span>
              </span>
            </div>
            <GrBar value={r.now} peak={r.peak ?? r.now} max={r.max} color={r.color} />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{r.note}</span>
              {r.peak !== undefined && (
                <span className="font-mono tabular-nums">
                  peak −{fixed(r.peak, 1)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Every value is the instantaneous reduction computed from the shared program
        model and the live thresholds — the same function that draws the band-activity
        canvas. When the engine is idle every row reads zero.
      </p>
    </RackUnit>
  );
}
