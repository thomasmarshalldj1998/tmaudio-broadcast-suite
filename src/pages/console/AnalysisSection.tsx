import { Legend, RackUnit, Readout } from "@/components/tm/ui";
import { SpectrumAnalyzer } from "@/components/tm/analyzers";
import { fixed } from "@/lib/tm/dsp";
import { useConsole } from "./context";
import { useMaster } from "./master";

/** Unit 09 — the same analyser drawn twice: once on the raw program and
 *  once after the live band gains and chain gain are applied. Both traces
 *  come from the same program model, so nothing here is invented. */
export function AnalysisSection() {
  const { cfg, running } = useConsole();
  const { tel } = useMaster();

  const bandGains = cfg.sensus.bands.map((b) => b.gain);
  const chainGain = tel.outputDb - tel.inputDb;

  return (
    <RackUnit
      index="09"
      title="Analysis — Input & Output Spectrum"
      eyebrow="pre-DSP vs post-DSP · one program model, two tap points"
      accent="#35C8D8"
      right={
        <div className="flex items-center gap-4">
          <Readout value={fixed(chainGain, 1)} unit="dB chain" tone="accent" />
          <Readout value={fixed(tel.mb3Gr, 1)} unit="dB MB3" tone="green" />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Legend>Input spectrum</Legend>
            <span className="font-mono text-[10px] tracking-[0.16em] text-[#35C8D8] uppercase">
              Pre-DSP
            </span>
          </div>
          <SpectrumAnalyzer running={running} accent="#35C8D8" gainDb={0} />
          <span className="text-[10px] text-muted-foreground">
            Raw program at the input tap — before AGC, multiband or clip stage.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Legend>Output spectrum</Legend>
            <span className="font-mono text-[10px] tracking-[0.16em] text-[#35C8D8] uppercase">
              Post-DSP
            </span>
          </div>
          <SpectrumAnalyzer
            running={running}
            accent="#35C8D8"
            gainDb={chainGain}
            bandGains={bandGains}
          />
          <span className="text-[10px] text-muted-foreground">
            Same program with the live Sensus band gains and the measured chain gain
            applied — move a band gain and this trace moves with it.
          </span>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Both analysers share one envelope generator; the post-DSP trace adds the six
        band gains read straight from the multiband cards and the current chain gain
        from the telemetry model. The per-chain analysers inside the output chains stay
        as they were.
      </p>
    </RackUnit>
  );
}
