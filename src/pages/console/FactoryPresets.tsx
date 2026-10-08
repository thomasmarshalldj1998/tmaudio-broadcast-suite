import { PATH_COLORS, fixed } from "@/lib/tm/dsp";
import { serializeConfig } from "@/lib/tm/presets";
import {
  FACTORY_CATEGORIES,
  FACTORY_PRESETS,
  type FactoryCategory,
  type FactoryPreset,
} from "@/lib/tm/factoryPresets";
import { Legend, RackUnit } from "@/components/tm/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Copy, Check, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useConsole } from "./context";

function metrics(p: FactoryPreset): [string, string][] {
  const c = p.config;
  switch (p.chain) {
    case "fm":
      return [
        ["pre-emph", `${c.fm.emphasis} µs`],
        ["clip drive", `${fixed(c.fm.mainClip, 1)} dB`],
        ["pilot", `${fixed(c.fm.pilot, 1)} %`],
      ];
    case "dab":
      return [
        ["bandwidth", `${fixed(c.dab.bandwidthKhz, 1)} kHz`],
        ["loudness", `${fixed(c.dab.loudness, 1)} LUFS`],
        ["true peak", `${fixed(c.dab.truePeak, 1)} dBTP`],
      ];
    case "web":
      return [
        ["codec", `${c.web.format} ${c.web.bitrate}k`],
        ["loudness", `${fixed(c.web.loudness, 1)} LUFS`],
        ["bandwidth", `${fixed(c.web.bandwidthKhz, 1)} kHz`],
      ];
    case "hd":
      return [
        ["hybrid", `${fixed(c.hd.hybridGain, 1)} dB`],
        ["bandwidth", `${fixed(c.hd.bandwidthKhz, 1)} kHz`],
        ["NRSC-5", c.hd.nrsc ? "on" : "off"],
      ];
    default:
      return [
        ["AGC window", `${c.sensus.agcWindowMs} ms`],
        ["clip drive", `${fixed(c.fm.mainClip, 1)} dB`],
        ["RDS", c.rds.enabled ? "on" : "off"],
      ];
  }
}

const CHAIN_COLOR: Record<string, string> = {
  fm: PATH_COLORS.fm,
  dab: PATH_COLORS.dab,
  web: PATH_COLORS.web,
  hd: PATH_COLORS.hd,
};

export function FactoryPresetsSection() {
  const { loadConfig } = useConsole();
  const [category, setCategory] = useState<FactoryCategory>("fm50");
  const [selectedId, setSelectedId] = useState(FACTORY_PRESETS[0].id);
  const [copied, setCopied] = useState(false);

  const list = useMemo(
    () => FACTORY_PRESETS.filter((p) => p.category === category),
    [category],
  );
  const selected =
    FACTORY_PRESETS.find((p) => p.id === selectedId) ?? list[0] ?? FACTORY_PRESETS[0];
  const text = useMemo(
    () => serializeConfig(selected.config, selected.name),
    [selected],
  );

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.id}.tm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <RackUnit
      index="15"
      title="Factory Preset Library"
      eyebrow="31 broadcast voicings · plain-text decimal · no obfuscation"
      accent={PATH_COLORS.hd}
      right={
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {FACTORY_PRESETS.length} presets · {FACTORY_CATEGORIES.length} families
        </span>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        {/* ---------------- families + cards ---------------- */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {FACTORY_CATEGORIES.map((cat) => {
              const active = cat.key === category;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setCategory(cat.key);
                    const first = FACTORY_PRESETS.find(
                      (p) => p.category === cat.key,
                    );
                    if (first) setSelectedId(first.id);
                  }}
                  className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-all ${
                    active
                      ? "border-[#4ADE80]/50 bg-[#4ADE80]/10"
                      : "border-border/60 bg-[#1E232A] hover:border-border"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold ${active ? "text-[#4ADE80]" : "text-foreground/85"}`}
                  >
                    {cat.label}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {FACTORY_PRESETS.filter((p) => p.category === cat.key).length}{" "}
                    presets
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {FACTORY_CATEGORIES.find((c) => c.key === category)?.blurb} — every
            preset carries complete values for input repair, the dual-loop AGC,
            all six Sensus bands, imaging, the path limiter/clipper, loudness
            targets and output levels.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => {
              const active = p.id === selected.id;
              const color = CHAIN_COLOR[p.chain] ?? PATH_COLORS.fm;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
                    active
                      ? "border-[#4ADE80]/50 bg-[#1F2A24] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                      : "border-border/60 bg-[#1E232A] hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] leading-tight font-semibold text-foreground/90">
                      {p.name}
                    </span>
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: active ? "#4ADE80" : color }}
                    />
                  </div>
                  <span className="text-[10px] leading-relaxed text-muted-foreground">
                    {p.note}
                  </span>
                  <span className="mt-1 grid grid-cols-3 gap-2 border-t border-border/50 pt-2">
                    {metrics(p).map(([label, value]) => (
                      <span key={label} className="flex flex-col gap-0.5">
                        <span className="text-[8px] tracking-[0.12em] text-muted-foreground uppercase">
                          {label}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-foreground/85">
                          {value}
                        </span>
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- preview + actions ---------------- */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Legend>{selected.name}</Legend>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {text.split("\n").length} keys · .tm
            </span>
          </div>
          <Textarea
            value={text}
            readOnly
            aria-label={`Configuration for ${selected.name}`}
            className="h-[420px] resize-none font-mono text-[11px] leading-[1.5] tabular-nums"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() =>
                loadConfig(
                  selected.config,
                  selected.name,
                  selected.note,
                  selected.chain,
                )
              }
            >
              <Upload className="size-3.5" />
              Load into console
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={copy}>
              {copied ? (
                <Check className="size-3.5 text-[#4ADE80]" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={download}>
              <Download className="size-3.5" />
              .tm file
            </Button>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Presets are stored beside the executable by default — the same
            dotted key/value text shown here, so a preset is a diff you can read
            in review, paste into a ticket, or hand to a consultant.
          </p>
        </div>
      </div>
    </RackUnit>
  );
}
