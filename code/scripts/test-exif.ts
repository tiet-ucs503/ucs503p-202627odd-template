// Smoke test for lib/exif.ts. Run with: npx tsx scripts/test-exif.ts
// (kept around for future EXIF debugging — most webp samples lack EXIF
// so EMPTY_EXIF here is the expected, non-throwing path.)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readExif } from "../lib/exif";

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const samplePath = path.resolve(here, "../public/samples/sample-04.webp");
  const buf = await readFile(samplePath);
  const exif = await readExif(buf);
  console.log("sample-04.webp exif:");
  console.log(JSON.stringify(exif, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
