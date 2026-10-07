/**
 * Export the factory preset library to plain-text .tm files.
 *
 *   bun run scripts/export-presets.ts
 *
 * The files land in native/presets/ so the packaging scripts' glob
 * (presets/*.tm) resolves and a distribution folder really does contain the
 * whole library as editable text. Content is byte-identical to the preview
 * shown in the console's Factory Preset Library panel.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FACTORY_PRESETS } from "../src/lib/tm/factoryPresets";
import { serializeConfig } from "../src/lib/tm/presets";

const outDir = join(process.cwd(), "native", "presets");

await mkdir(outDir, { recursive: true });

for (const preset of FACTORY_PRESETS) {
  const text = serializeConfig(preset.config, preset.name);
  await writeFile(join(outDir, `${preset.id}.tm`), `${text}\n`, "utf8");
}

const files = (await readdir(outDir)).filter((f) => f.endsWith(".tm")).sort();
console.log(`wrote ${files.length} presets -> native/presets/`);
