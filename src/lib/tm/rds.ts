/**
 * TMAUDIO — RDS encoder (EN 50067 / IEC 62106).
 *
 * Block assembler, CRC-10 checkword generation, offset-word insertion and
 * biphase symbol shaping. Every step is written out longhand so the bit
 * arithmetic can be audited against the standard.
 *
 * Block B layout (16 bits):
 *   [15:12] group type (4) | [11] version | [10] TP | [9:5] PTY | [4:0] group flags
 */

/** Generator polynomial G(x) = x^10 + x^8 + x^7 + x^5 + x^4 + x^3 + 1 */
export const RDS_POLY = 0x5b9;

/** Offset words per group label (group type + version). */
export const OFFSET_WORDS: Record<string, number> = {
  "0A": 0x0fc, "0B": 0x198, "1A": 0x168, "1B": 0x1b4,
  "2A": 0x350, "2B": 0x3b4, "3A": 0x3d4, "3B": 0x2d4,
  "4A": 0x20c, "4B": 0x270, "5A": 0x244, "5B": 0x2a4,
  "6A": 0x2e0, "6B": 0x294, "7A": 0x380, "7B": 0x300,
  "8A": 0x334, "8B": 0x318, "9A": 0x394, "9B": 0x3a4,
  "10A": 0x2c8, "10B": 0x2e4, "11A": 0x354, "11B": 0x364,
  "12A": 0x234, "12B": 0x218, "13A": 0x274, "13B": 0x2b0,
  "14A": 0x2c4, "14B": 0x384, "15A": 0x390, "15B": 0x3c4,
};

export type RdsFlags = {
  tp: boolean; // Traffic programme
  ta: boolean; // Traffic announcement
  ms: boolean; // Music / speech
  di: boolean; // Decoder identification bit for this PS segment
};

export type RdsConfig = {
  enabled: boolean;
  pi: number; // 16-bit programme identifier
  ps: string; // 8-character programme service name
  rt: string; // 64-character radio text
  pty: number; // 0-31 programme type
  ct: boolean; // clock-time (group 4A)
  eon: boolean; // extended other network (group 1A)
  eonPi: number;
  flags: RdsFlags;
  injection: number; // % of total deviation
};

/** Polynomial remainder of a 16-bit block shifted by 10 (the checkword seed). */
export function crc10(data: number): number {
  return remainder((data & 0xffff) << 10);
}

/** Polynomial remainder of any 26-bit block+checkword word. */
export function remainder(word: number): number {
  let reg = word >>> 0;
  for (let bit = 25; bit >= 10; bit--) {
    if ((reg >>> bit) & 1) reg ^= RDS_POLY << (bit - 10);
  }
  return reg & 0x3ff;
}

/** Checkword = CRC XOR the group's offset word (syndrome-forming encoder). */
export function checkword(block: number, groupLabel: string): number {
  return crc10(block) ^ offsetWord(groupLabel);
}

export function offsetWord(groupLabel: string): number {
  return OFFSET_WORDS[groupLabel] ?? 0x0fc;
}

/**
 * Decoder-side check: the remainder of the received 26-bit word must equal
 * the group's offset word. Returns the syndrome; compare with offsetWord().
 */
export function syndrome(data: number, check: number): number {
  return remainder(((data & 0xffff) << 10) | (check & 0x3ff));
}

/** Encode characters onto the RDS G0 charset (Latin-1 subset, blank padded). */
export function encodeText(text: string, length: number): number[] {
  const out: number[] = [];
  const padded = text.padEnd(length, " ").slice(0, length);
  for (let i = 0; i < length; i++) {
    const c = padded.charCodeAt(i);
    out.push(c > 255 || Number.isNaN(c) ? 0x20 : c);
  }
  return out;
}

export type RdsBlock = {
  label: string;
  data: number;
  check: number;
  offset: number;
  crc: number;
  syndrome: number;
};

export type RdsGroup = {
  label: string;
  purpose: string;
  blocks: RdsBlock[];
  hex: string;
  ok: boolean;
};

function makeBlock(label: string, data: number, groupLabel: string): RdsBlock {
  const d = data & 0xffff;
  const offset = offsetWord(groupLabel);
  const crc = crc10(d);
  const check = crc ^ offset;
  return { label, data: d, offset, crc, check, syndrome: syndrome(d, check) };
}

/**
 * Block B bit builder: type (4) | version (1) | TP (1) | PTY (5) | flags (5).
 */
function blockB(
  groupType: number,
  versionB: boolean,
  rds: RdsConfig,
  flags: number,
): number {
  return (
    ((groupType & 0xf) << 12) |
    ((versionB ? 1 : 0) << 11) |
    ((rds.flags.tp ? 1 : 0) << 10) |
    ((rds.pty & 0x1f) << 5) |
    (flags & 0x1f)
  );
}

/** Group 0A flag nibble: TA | M/S | DI | PS segment address (2 bits). */
function flag0A(rds: RdsConfig, segment: number): number {
  return (
    ((rds.flags.ta ? 1 : 0) << 4) |
    ((rds.flags.ms ? 1 : 0) << 3) |
    ((rds.flags.di ? 1 : 0) << 2) |
    (segment & 0x3)
  );
}

/**
 * Assemble the groups TMAUDIO transmits in the standard rotation:
 * 0A programme service name (x4), 2A radio text (x4), 4A clock time, 1A EON.
 */
export function buildGroups(rds: RdsConfig, now = new Date()): RdsGroup[] {
  const ps = encodeText(rds.ps, 8);
  const rt = encodeText(rds.rt, 64);
  const groups: RdsGroup[] = [];

  // --- Group 0A: programme service name, 4 segments of 2 characters ------
  for (let seg = 0; seg < 4; seg++) {
    const label = "0A";
    groups.push(
      finalise(label, "Programme service name", [
        makeBlock("A", rds.pi, label),
        makeBlock("B", blockB(0, false, rds, flag0A(rds, seg)), label),
        makeBlock("C", 0, label),
        makeBlock("D", (ps[seg * 2] << 8) | ps[seg * 2 + 1], label),
      ]),
    );
  }

  // --- Group 2A: radio text, 16 segments of 4 characters -----------------
  const rtChars = rds.rt.replace(/\s+$/, "").length;
  const rtSegments = Math.min(16, Math.max(1, Math.ceil(rtChars / 4)));
  for (let seg = 0; seg < rtSegments; seg++) {
    const label = "2A";
    const at = seg * 4;
    groups.push(
      finalise(label, "Radio text", [
        makeBlock("A", rds.pi, label),
        makeBlock("B", blockB(2, false, rds, seg & 0xf), label),
        makeBlock("C", (rt[at] << 8) | rt[at + 1], label),
        makeBlock("D", (rt[at + 2] << 8) | rt[at + 3], label),
      ]),
    );
  }

  // --- Group 4A: clock-time and date (modified Julian day) ---------------
  if (rds.ct) {
    const label = "4A";
    const mjd = toMjd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const offsetHalfHours = 0; // encoder runs on UTC
    const blockC = ((mjd >> 4) & 0xfff) | ((offsetHalfHours & 0x7) << 12);
    const blockD =
      ((mjd & 0xf) << 12) |
      ((now.getHours() & 0x1f) << 7) |
      ((now.getMinutes() & 0x3f) << 1) |
      (now.getSeconds() >= 30 ? 1 : 0);
    groups.push(
      finalise(label, "Clock time (UTC)", [
        makeBlock("A", rds.pi, label),
        makeBlock("B", blockB(4, false, rds, 0), label),
        makeBlock("C", blockC, label),
        makeBlock("D", blockD, label),
      ]),
    );
  }

  // --- Group 1A: EON, other-network PI + programme item number -----------
  if (rds.eon) {
    const label = "1A";
    groups.push(
      finalise(label, "EON other network", [
        makeBlock("A", rds.pi, label),
        makeBlock("B", blockB(1, false, rds, 0), label),
        makeBlock("C", rds.eonPi, label),
        makeBlock("D", now.getMinutes() * 60 + now.getSeconds(), label),
      ]),
    );
  }

  return groups;
}

function finalise(label: string, purpose: string, blocks: RdsBlock[]): RdsGroup {
  return {
    label,
    purpose,
    blocks,
    hex: blocks
      .map((b) => b.data.toString(16).toUpperCase().padStart(4, "0"))
      .join(" "),
    ok: blocks.every((b) => b.syndrome === b.offset),
  };
}

/** Modified Julian day for a civil date (RDS group 4A). */
export function toMjd(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  return jdn - 2400001;
}

/** Biphase (Manchester) symbols: each bit becomes two half-symbols. */
export function biphaseSymbols(bits: number[]): number[] {
  const out: number[] = [];
  for (const bit of bits) out.push(bit ? 1 : -1, bit ? -1 : 1);
  return out;
}

/** Flatten assembled groups into the 10-bit checkword stream that is
 *  biphase-modulated onto the 57 kHz subcarrier. */
export function checkwordBits(groups: RdsGroup[]): number[] {
  const bits: number[] = [];
  for (const group of groups) {
    for (const block of group.blocks) {
      for (let i = 9; i >= 0; i--) bits.push((block.check >> i) & 1);
    }
  }
  return bits;
}
