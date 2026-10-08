import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTick } from "@/components/tm/analyzers";
import { GrBar, Led, Legend, RackUnit, Readout, Segmented } from "@/components/tm/ui";
import { clamp, fixed } from "@/lib/tm/dsp";
import { pushLog } from "@/lib/tm/log";
import {
  TX_CODECS,
  TX_PACKET_BYTES,
  TX_PROTOCOLS,
  TX_RING_BYTES,
  TX_RING_PACKETS,
  TX_SLOT_COUNT,
  codecRates,
  defaultTxSlots,
  idleTxStats,
  stepSlot,
  TxRing,
  type TxCodec,
  type TxProtocol,
  type TxSlot,
  type TxStats,
} from "@/lib/tm/txring";
import { useConsole } from "./context";

const ACCENT = "#8B7CF6";

/* ------------------------------------------------------------------ *
 * One encoder slot: toggle, protocol, endpoint, codec and the live
 * ring metrics. Metrics only ever move when the slot switch AND the
 * master engine are both on — everything else reads a hard zero.
 * ------------------------------------------------------------------ */
function SlotCard({
  index,
  slot,
  stats,
  onPatch,
  onToggle,
}: {
  index: number;
  slot: TxSlot;
  stats: TxStats;
  onPatch: (patch: Partial<TxSlot>) => void;
  onToggle: () => void;
}) {
  const proto = TX_PROTOCOLS.find((p) => p.value === slot.protocol)!;
  const rates = codecRates(slot.codec);

  const live = stats.state === "live";
  const stateLabel = live
    ? stats.congested
      ? "DROPPING"
      : "LIVE"
    : stats.state === "standby"
      ? "STANDBY"
      : "OFF";
  const stateColor = live
    ? stats.congested
      ? "#FF4D4D"
      : "#4ADE80"
    : stats.state === "standby"
      ? "#F5A524"
      : "#6B7280";

  const setPort = (raw: string) => {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    onPatch({ port: Number.isFinite(n) ? clamp(n, 1, 65535) : 1 });
  };

  const setCodec = (codec: TxCodec) => {
    const next = codecRates(codec);
    const bitrate = next.includes(slot.bitrate)
      ? slot.bitrate
      : next.reduce((best, r) =>
          Math.abs(r - slot.bitrate) < Math.abs(best - slot.bitrate) ? r : best,
        );
    onPatch({ codec, bitrate });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-[#1E232A] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Led on={stats.state !== "off"} color={stateColor} />
          <span className="text-[11px] font-semibold tracking-[0.16em] text-foreground/90 uppercase">
            Slot {index + 1}
          </span>
          <span
            className="truncate font-mono text-[9px] tracking-[0.14em] uppercase"
            style={{ color: stateColor }}
          >
            {stateLabel}
          </span>
        </span>
        <Switch checked={slot.on} onCheckedChange={onToggle} aria-label={`Slot ${index + 1} power`} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Legend>Protocol</Legend>
        <Segmented<TxProtocol>
          size="sm"
          value={slot.protocol}
          onChange={(v) => onPatch({ protocol: v, port: TX_PROTOCOLS.find((p) => p.value === v)!.port })}
          options={TX_PROTOCOLS.map((p) => ({ value: p.value, label: p.label }))}
          accent={ACCENT}
        />
      </div>

      <div className="grid grid-cols-[1fr_74px] gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Legend>Server</Legend>
          <Input
            value={slot.server}
            onChange={(e) => onPatch({ server: e.target.value })}
            spellCheck={false}
            aria-label={`Slot ${index + 1} server host`}
            className="h-8 px-2 text-[12px] font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Legend>Port</Legend>
          <Input
            value={slot.port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
            aria-label={`Slot ${index + 1} port`}
            className="h-8 px-2 text-[12px] font-mono tabular-nums"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Legend>Codec</Legend>
        <Segmented<TxCodec>
          size="sm"
          value={slot.codec}
          onChange={setCodec}
          options={TX_CODECS.map((c) => ({ value: c.value, label: c.label }))}
          accent={ACCENT}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Legend>Bitrate</Legend>
        <Segmented<number>
          size="sm"
          value={slot.bitrate}
          onChange={(v) => onPatch({ bitrate: v })}
          options={rates.map((r) => ({ value: r, label: `${r}k` }))}
          accent={ACCENT}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/50 pt-2.5">
        <div className="flex items-center justify-between">
          <Readout
            value={fixed(stats.kbps, 1)}
            unit="kbps"
            tone={live ? "green" : "default"}
          />
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            drops{" "}
            <span style={{ color: stats.droppedPkts > 0 ? "#FF4D4D" : undefined }}>
              {stats.droppedPkts}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
            Ring
          </span>
          <GrBar
            value={stats.fill}
            max={1}
            color={stats.fill > 0.98 ? "#FF4D4D" : ACCENT}
          />
          <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round(stats.fill * 100)}%
          </span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
          {proto.transport} · fixed {TX_RING_PACKETS}×{TX_PACKET_BYTES} B ring
        </span>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Unit 07 — Stream TX encoder matrix
 * ================================================================== */
export function StreamTxSection() {
  const { running } = useConsole();
  const [slots, setSlots] = useState<TxSlot[]>(defaultTxSlots);
  const [stats, setStats] = useState<TxStats[]>(() =>
    defaultTxSlots().map((s) => idleTxStats(s.on ? "standby" : "off")),
  );

  const rings = useRef<TxRing[] | null>(null);
  if (!rings.current) {
    rings.current = Array.from({ length: TX_SLOT_COUNT }, () => new TxRing());
  }
  const smooth = useRef<number[]>(Array(TX_SLOT_COUNT).fill(0));
  const lastT = useRef(0);

  // The TX pipeline only ticks while the master engine runs — standby
  // schedules no work at all (useTick(0) disables the interval).
  const tick = useTick(running ? 250 : 0);

  useEffect(() => {
    const ringsNow = rings.current!;
    if (!running) {
      lastT.current = 0;
      ringsNow.forEach((r) => r.reset());
      smooth.current.fill(0);
      setStats(slots.map((s) => idleTxStats(s.on ? "standby" : "off")));
      return;
    }
    const now = performance.now() / 1000;
    const dt = lastT.current ? Math.min(now - lastT.current, 1) : 0;
    lastT.current = now;
    const next = slots.map((slot, i) => {
      const s = stepSlot(ringsNow[i], slot, dt, now, i * 4.7 + 1.3);
      smooth.current[i] =
        s.state === "live"
          ? (smooth.current[i] ?? 0) * 0.55 + s.kbps * 0.45
          : 0;
      return { ...s, kbps: smooth.current[i] };
    });
    setStats(next);
  }, [tick, running, slots]);

  const patch = (i: number, p: Partial<TxSlot>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));

  const toggle = (i: number) => {
    const s = slots[i];
    setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));
    pushLog(
      "ROUTING",
      s.on
        ? `Stream TX slot ${i + 1} disengaged — ${s.server}:${s.port}`
        : `Stream TX slot ${i + 1} engaged — ${s.protocol} ${s.server}:${s.port} · ${s.codec.toUpperCase()} ${s.bitrate}k`,
    );
  };

  const liveCount = stats.filter((s) => s.state === "live").length;
  const armedCount = slots.filter((s) => s.on).length;
  const totalKbps = stats.reduce((sum, s) => sum + s.kbps, 0);
  const totalDrops = stats.reduce((sum, s) => sum + s.droppedPkts, 0);

  return (
    <RackUnit
      index="07"
      title="Stream TX Encoder Matrix"
      eyebrow="8 simultaneous slots · raw socket transport · drop-on-full ring"
      accent={ACCENT}
      right={
        <div className="flex items-center gap-4">
          <Readout value={`${liveCount}/8`} unit="live" tone={liveCount ? "green" : "default"} />
          <Readout value={fixed(totalKbps, 1)} unit="kbps" tone="accent" />
          <Readout
            value={String(totalDrops)}
            unit="dropped"
            tone={totalDrops > 0 ? "red" : "default"}
          />
        </div>
      }
    >
      {!running && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#F5A524]/40 bg-[#F5A524]/10 px-4 py-3">
          <Led on={false} color="#F5A524" />
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#F5A524] uppercase">
            Engine standby
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {armedCount} slot{armedCount === 1 ? "" : "s"} armed · 0.0 kbps · ring idle
          </span>
          <span className="text-[11px] text-muted-foreground">
            Encoders initialise and transmit only after the master RUN button is pressed.
          </span>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border/50 bg-[#1E232A] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Transport is <span className="text-foreground/85">socket-native</span>: each slot
        pushes encoded packets into a fixed{" "}
        <span className="font-mono text-foreground/85">
          {TX_RING_PACKETS}×{TX_PACKET_BYTES} B ({TX_RING_BYTES.toLocaleString("en-US")} B)
        </span>{" "}
        ring and writes straight to a TCP (ICY / Shoutcast / Icecast) or UDP/SRT endpoint —{" "}
        <span className="text-foreground/85">no fetch, no XHR, no WebSocket, no chunked HTTP</span>.
        When the link cannot take the bytes, the ring is full and the packet is{" "}
        <span className="text-[#FF4D4D]">dropped immediately</span> instead of queued, so delay
        stays bounded by ring size and never accumulates into buffer bloat.
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {slots.map((slot, i) => (
          <SlotCard
            key={i}
            index={i}
            slot={slot}
            stats={stats[i] ?? idleTxStats("off")}
            onPatch={(p) => patch(i, p)}
            onToggle={() => toggle(i)}
          />
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Every metric above is produced by the same ring the encoder writes to: throughput is the
        bytes the socket actually took, the ring bar is live occupancy of the fixed buffer and the
        drop counter counts packets the ring refused. Nothing is estimated and nothing moves while
        the engine is in standby or the slot switch is off.
      </p>
    </RackUnit>
  );
}
