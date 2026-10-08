/* ------------------------------------------------------------------ *
 * Stream TX packet ring — the transport contract every encoder slot
 * obeys. Three rules, no exceptions:
 *
 *   1. The ring is a FIXED size (8 packets). It never grows, so the
 *      queueing delay it can introduce is bounded by construction.
 *   2. push() takes a complete packet or refuses it. A refused packet
 *      is counted as dropped *immediately* — nothing is parked in a
 *      retry list, nothing is buffered behind the socket.
 *   3. drain() is the socket write. Whatever the link cannot take this
 *      tick stays in the ring until it is full, then rule 2 applies.
 *
 * Because a full ring drops instead of queueing, network congestion
 * can never accumulate into buffer bloat: worst-case glass-to-glass
 * delay is the time to drain one ring, regardless of how long the
 * link stalls.
 *
 * The whole path is socket-native: no fetch(), no XHR, no WebSocket,
 * no chunked HTTP anywhere in this file or its consumer.
 * ------------------------------------------------------------------ */

import { clamp, wobble } from "./dsp";

/* ----------------------------- protocol ---------------------------- */

export type TxProtocol = "raw-icy" | "shoutcast" | "icecast" | "srt-udp";
export type TxCodec = "opus" | "aac" | "mp3";

export const TX_PROTOCOLS: {
  value: TxProtocol;
  label: string;
  transport: string;
  port: number;
}[] = [
  { value: "raw-icy", label: "Raw ICY", transport: "TCP socket", port: 8000 },
  { value: "shoutcast", label: "Shoutcast", transport: "TCP socket", port: 8001 },
  { value: "icecast", label: "Icecast TCP", transport: "TCP socket", port: 8000 },
  { value: "srt-udp", label: "UDP / SRT", transport: "UDP datagram", port: 9000 },
];

export const TX_CODECS: { value: TxCodec; label: string; rates: number[] }[] = [
  { value: "opus", label: "Opus", rates: [64, 96, 128, 192, 256] },
  { value: "aac", label: "AAC", rates: [64, 96, 128, 192, 256] },
  { value: "mp3", label: "MP3", rates: [128, 192, 256, 320] },
];

export function codecRates(codec: TxCodec): number[] {
  return TX_CODECS.find((c) => c.value === codec)?.rates ?? TX_CODECS[0].rates;
}

/* ----------------------------- geometry ---------------------------- */

/** MTU-safe payload per packet — the unit the ring accepts or refuses. */
export const TX_PACKET_BYTES = 1440;
/** Fixed ring depth, in packets. Never changes, at any bitrate. */
export const TX_RING_PACKETS = 8;
/** Fixed ring depth in bytes (11 520 B ≈ 0.72 s at 128 kbps). */
export const TX_RING_BYTES = TX_PACKET_BYTES * TX_RING_PACKETS;

export const TX_SLOT_COUNT = 8;

/* ------------------------------ slot cfg --------------------------- */

export type TxSlot = {
  on: boolean;
  protocol: TxProtocol;
  /** Host (or host:mount) — a socket endpoint, never an http(s) URL. */
  server: string;
  port: number;
  codec: TxCodec;
  /** Encoder target, kbps. */
  bitrate: number;
};

const DEFAULT_SERVERS = [
  "tx01.dal.tmaudio.net",
  "tx02.dal.tmaudio.net",
  "chi01.edge.tmaudio.net",
  "chi02.edge.tmaudio.net",
  "fra01.edge.tmaudio.net",
  "lon01.edge.tmaudio.net",
  "ams01.edge.tmaudio.net",
  "syd01.edge.tmaudio.net",
];

const DEFAULT_CODECS: TxCodec[] = ["opus", "aac", "mp3", "aac", "opus", "aac", "mp3", "opus"];
const DEFAULT_RATES = [128, 128, 192, 128, 96, 192, 128, 256];

/** Eight configured-but-dormant slots: nothing transmits until the slot
 *  switch AND the master RUN button are both on. */
export function defaultTxSlots(): TxSlot[] {
  return Array.from({ length: TX_SLOT_COUNT }, (_, i) => ({
    on: false,
    protocol: (i % 3 === 2 ? "srt-udp" : i % 3 === 1 ? "shoutcast" : "icecast") as TxProtocol,
    server: DEFAULT_SERVERS[i],
    port: i % 3 === 2 ? 9000 : i % 3 === 1 ? 8001 : 8000,
    codec: DEFAULT_CODECS[i],
    bitrate: DEFAULT_RATES[i],
  }));
}

/* ------------------------------- ring ------------------------------ */

/** Fixed-capacity packet ring. push() is all-or-nothing: a packet that
 *  does not fit is dropped on the spot and counted, never queued. */
export class TxRing {
  private queued = 0;
  private carry = 0;

  droppedPkts = 0;
  sentBytes = 0;

  /** Encoder hands over one packet; true = accepted, false = dropped. */
  push(bytes: number): boolean {
    if (this.queued + bytes > TX_RING_BYTES) {
      this.droppedPkts += 1;
      return false;
    }
    this.queued += bytes;
    return true;
  }

  /** Socket write for this tick; returns the bytes actually taken. */
  drain(bytes: number): number {
    const n = Math.min(bytes, this.queued);
    this.queued -= n;
    this.sentBytes += n;
    return n;
  }

  /** Encoder output, packetised: whole packets go through push(), the
   *  remainder is carried to the next tick (no partial packets). */
  encode(byteCount: number): void {
    this.carry += byteCount;
    while (this.carry >= TX_PACKET_BYTES) {
      this.push(TX_PACKET_BYTES);
      this.carry -= TX_PACKET_BYTES;
    }
  }

  get queuedBytes(): number {
    return this.queued;
  }

  /** 0..1 occupancy of the fixed ring. */
  get fill(): number {
    return clamp(this.queued / TX_RING_BYTES, 0, 1);
  }

  reset(): void {
    this.queued = 0;
    this.carry = 0;
    this.droppedPkts = 0;
    this.sentBytes = 0;
  }
}

/* ------------------------------ metrics ---------------------------- */

export type TxState = "off" | "standby" | "live";

export type TxStats = {
  state: TxState;
  /** Measured socket throughput over the last window, kbps. */
  kbps: number;
  /** Ring occupancy 0..1. */
  fill: number;
  /** Packets refused because the ring was full (since the slot started). */
  droppedPkts: number;
  /** True while the ring is overflowing right now (congestion window). */
  congested: boolean;
};

export const IDLE_TX_STATS: TxStats = {
  state: "off",
  kbps: 0,
  fill: 0,
  droppedPkts: 0,
  congested: false,
};

export function idleTxStats(state: TxState): TxStats {
  return state === "off" ? IDLE_TX_STATS : { ...IDLE_TX_STATS, state };
}

/**
 * Advance one slot by `dt` seconds of engine time.
 *
 * Production is exactly the configured bitrate; the link drains at the
 * same nominal rate modulated by a deterministic per-slot wobble that
 * periodically sags below production. The ring absorbs the sag until
 * it is full — from then on every packet is dropped immediately, which
 * is exactly the contract: bounded delay, visible drops, no bloat.
 */
export function stepSlot(
  ring: TxRing,
  slot: TxSlot,
  dt: number,
  t: number,
  seed: number,
): TxStats {
  if (!slot.on) {
    ring.reset();
    return IDLE_TX_STATS;
  }
  if (dt <= 0) {
    return {
      state: "live",
      kbps: 0,
      fill: ring.fill,
      droppedPkts: ring.droppedPkts,
      congested: false,
    };
  }

  const bytesPerSec = (slot.bitrate * 1000) / 8;

  // Encoder: constant bitrate, packetised into MTU-safe chunks.
  ring.encode(bytesPerSec * dt);

  // Link: nominal rate sagging to ~15 % during congestion windows.
  const link = clamp(1 + 0.7 * wobble(t, seed), 0.15, 1.6);
  const sent = ring.drain(bytesPerSec * link * dt);

  const droppedPkts = ring.droppedPkts;
  const kbps = (sent * 8) / dt / 1000;

  return {
    state: "live",
    kbps,
    fill: ring.fill,
    droppedPkts,
    // Overflowing right now, or emptied into a saturated-but-draining ring.
    congested: ring.fill > 0.98,
  };
}
