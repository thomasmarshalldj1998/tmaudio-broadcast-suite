/* Temporary verification harness (not part of the app).
 * Run: bun standby.check.tsx — asserts standby zeroing, -inf readouts,
 * TX ring drop-on-full semantics, and rack-unit numbering. */
import { renderToString } from "react-dom/server";

let failed = 0;
let passed = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) {
    passed++;
    console.log(`  ok   ${msg}`);
  } else {
    failed++;
    console.error(`FAIL   ${msg}`);
  }
};

const cfg = (await import("@/lib/tm/presets")).getPreset("fm").config;
const { useTelemetry } = await import("@/lib/tm/telemetry");
const { ConsoleContext } = await import("@/pages/console/context");
const { MasterProvider } = await import("@/pages/console/master");

/* ---------------- A/B: telemetry probe ---------------- */
let tel: import("@/lib/tm/telemetry").Telemetry | null = null;
function Grab({ running }: { running: boolean }) {
  tel = useTelemetry({
    cfg,
    running,
    presetKey: "fm",
    target: -14,
    ceiling: -1,
    window: "60s",
    dry: 0,
    trimDb: 0,
  });
  return null;
}

renderToString(<Grab running={false} />);
{
  const t = tel!;
  const inf = (v: number) => v === Number.NEGATIVE_INFINITY;
  check(inf(t.inputDb) && inf(t.processedDb) && inf(t.outputDb), "standby levels are -inf dBFS");
  check(inf(t.momentary) && inf(t.shortTerm) && inf(t.integrated), "standby loudness is -inf LUFS");
  check(inf(t.truePeakDb), "standby true peak is -inf dBTP");
  check(t.tpStatus === "SAFE", "standby true-peak status SAFE");
  check(
    t.grDb === 0 && t.agcGr === 0 && t.mb3Gr === 0 && t.clipGr === 0 && t.limitGr === 0,
    "standby gain reduction is 0.0",
  );
  check(t.bandGr.every((v) => v === 0), "standby per-band GR is 0");
  check(
    t.mb3.low.now === 0 && t.mb3.low.peak === 0 && t.mb3.high.peak === 0,
    "standby mb3 stats are 0",
  );
  check(t.lra === 0 && t.modPct === 0 && t.loopMs === 0, "standby LRA / modulation / loop are 0");
  check(
    t.counters.clip === 0 && t.counters.limiter === 0 && t.counters.dropout === 0 && t.counters.underrun === 0,
    "standby counters are 0",
  );
  check(t.bufferSmp === cfg.sensus.blockSize && t.sampleRate === 96000, "engine spec readouts intact");
}

renderToString(<Grab running={true} />);
{
  const t = tel!;
  const finite = (v: number) => Number.isFinite(v);
  check(finite(t.inputDb) && t.inputDb > -60, "running input level is finite");
  check(finite(t.integrated) && finite(t.momentary), "running loudness is finite");
  check(finite(t.truePeakDb), "running true peak is finite");
}

/* ---------------- C: full console sections, standby ---------------- */
const { getPreset } = await import("@/lib/tm/presets");
const sections = await import("@/pages/console/ProcessingSections");
const { ActivitySection } = await import("@/pages/console/ActivitySection");
const { OutputChainsSection } = await import("@/pages/console/OutputChains");
const { StreamTxSection } = await import("@/pages/console/StreamTx");
const { RdsSection } = await import("@/pages/console/RdsSection");
const { LoudnessSection } = await import("@/pages/console/LoudnessSection");
const { AnalysisSection } = await import("@/pages/console/AnalysisSection");
const { MonitoringSection } = await import("@/pages/console/MonitoringSection");
const { AudioPathSection, SafetySection, EventLogSection } = await import(
  "@/pages/console/DiagnosticsSection"
);
const { AdvancedSection } = await import("@/pages/console/AdvancedSection");
const { MasterSection } = await import("@/pages/console/MasterSection");

const p = getPreset("fm");
function ctxValue(running: boolean): import("@/pages/console/context").ConsoleCtx {
  return {
    cfg: p.config,
    running,
    presetKey: "fm",
    presetLabel: p.name,
    presetNote: p.note,
    setRunning: () => {},
    set: () => {},
    setBand: () => {},
    loadPreset: () => {},
    loadConfig: () => {},
    markDirty: () => {},
  };
}

function renderConsole(running: boolean): string {
  return renderToString(
    <ConsoleContext.Provider value={ctxValue(running)}>
      <MasterProvider>
        <sections.InputSection />
        <sections.SensusSection />
        <sections.ImagingSection />
        <ActivitySection />
        <OutputChainsSection />
        <StreamTxSection />
        <RdsSection />
        <LoudnessSection />
        <AnalysisSection />
        <MonitoringSection />
        <AudioPathSection />
        <SafetySection />
        <EventLogSection />
        <AdvancedSection target={-14} ceiling={-1} />
        <MasterSection />
      </MasterProvider>
    </ConsoleContext.Provider>,
  );
}

const standbyHtml = renderConsole(false);
check(!standbyHtml.includes("NaN"), "standby console renders no NaN");
check(!standbyHtml.includes("-Infinity"), "standby console never prints -Infinity");
check(!standbyHtml.includes("−0.0"), "standby console prints 0.0, never −0.0");
check(standbyHtml.includes("-inf"), "standby readouts show -inf");
check(standbyHtml.includes("Engine standby"), "Stream TX banner shows engine standby");
check(standbyHtml.includes("0/8"), "Stream TX shows 0/8 live");
check(
  standbyHtml.includes("0.0") && standbyHtml.includes("kbps"),
  "throughput readouts present at 0.0 kbps",
);

const runHtml = renderConsole(true);
check(!runHtml.includes("NaN"), "running console renders no NaN");
check(!runHtml.includes("-Infinity"), "running console never prints -Infinity");
check(!runHtml.includes("-inf dBFS"), "running input readout is finite");

/* ---------------- D: Overview standby / running ---------------- */
const { Overview } = await import("@/pages/Dashboard");
function renderOverview(running: boolean): string {
  return renderToString(
    <ConsoleContext.Provider value={ctxValue(running)}>
      <MasterProvider>
        <Overview dirty={false} />
      </MasterProvider>
    </ConsoleContext.Provider>,
  );
}
const overStandby = renderOverview(false);
check(overStandby.includes("Standby — engine stopped"), "power strip shows STANDBY state");
check(overStandby.includes("press run to start"), "power strip prompts RUN");
check(overStandby.includes("-inf dBFS"), "Overview input stage reads -inf dBFS");
check(!overStandby.includes("NaN"), "Overview standby renders no NaN");
check(!overStandby.includes("−0.0"), "Overview gain reduction reads 0.0, not −0.0");

const overRun = renderOverview(true);
check(overRun.includes("Running — engine live"), "power strip shows RUNNING state");
check(!overRun.includes("-inf dBFS"), "running Overview input stage is finite");

/* ---------------- E: TX ring drop-on-full ---------------- */
const tx = await import("@/lib/tm/txring");
{
  const r = new tx.TxRing();
  let accepted = 0;
  let refused = 0;
  for (let i = 0; i < 40; i++) {
    if (r.push(tx.TX_PACKET_BYTES)) accepted++;
    else refused++;
  }
  check(accepted === tx.TX_RING_PACKETS, `ring accepts exactly ${tx.TX_RING_PACKETS} packets`);
  check(refused === 40 - tx.TX_RING_PACKETS, "overflow packets dropped immediately");
  check(r.queuedBytes === tx.TX_RING_BYTES, "ring never exceeds fixed byte capacity");
  check(r.fill === 1, "ring reads full under congestion");
  const took = r.drain(tx.TX_RING_BYTES);
  check(took === tx.TX_RING_BYTES && r.queuedBytes === 0, "drain (socket write) empties the ring");
  r.reset();
  check(r.droppedPkts === 0 && r.queuedBytes === 0, "reset clears ring and counters");
}
{
  const r = new tx.TxRing();
  r.encode(tx.TX_PACKET_BYTES * 10);
  check(
    r.queuedBytes === tx.TX_RING_BYTES && r.droppedPkts === 2,
    "encode() packetises: 8 queued, 2 dropped",
  );
}
{
  const ring = new tx.TxRing();
  const slot = tx.defaultTxSlots()[0];
  const off = tx.stepSlot(ring, { ...slot, on: false }, 0.25, 1, 1);
  check(off.state === "off" && off.kbps === 0, "disarmed slot reports off / 0 kbps");
  const armed = { ...slot, on: true };
  const s1 = tx.stepSlot(ring, armed, 0.25, 1, 1);
  check(s1.state === "live" && s1.kbps > 0, "armed slot streams when stepped");
}
check(tx.TX_SLOT_COUNT === 8, "matrix has exactly 8 slots");
check(tx.TX_PROTOCOLS.length === 4 && tx.TX_CODECS.length === 3, "4 protocols / 3 codecs");

/* ---------------- F: rack numbering + nav index ---------------- */
const idx = await import("@/pages/console/settingsIndex");
{
  const ids = idx.SETTINGS.map((e) => e.id);
  check(ids.filter((v, i, a) => a.indexOf(v) === i).length === 18, "18 unique rack units");
  const stx = idx.SETTINGS.find((e) => e.unit === "07");
  check(stx?.id === "unit-07" && stx.group === "Processing", "Stream TX is unit 07 / Processing");
  check(idx.NAV_UNITS.length === 18, "side rail lists 18 units");
  const hits = idx.searchSettings("stream tx encoder");
  check(hits.length > 0 && hits[0].id === "unit-07", "palette finds Stream TX first");
}

/* ---------------- G: no HTTP transport in the TX path ---------------- */
{
  const files = ["src/lib/tm/txring.ts", "src/pages/console/StreamTx.tsx"];
  const fs = await import("node:fs");
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    check(
      !/fetch\s*\(|XMLHttpRequest|new WebSocket|EventSource/.test(body),
      `${f} has no HTTP/HTTPS transport calls`,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
