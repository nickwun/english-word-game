#!/usr/bin/env node
/**
 * Update src/data/vocabulary.json audio fields using downloaded files.
 *
 * Usage:
 *   node scripts/update-vocabulary-audio.mjs
 *
 * It reads reports/audio-download-report.json and only updates words with downloaded files.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const VOCAB_PATH = path.join(ROOT, "src/data/vocabulary.json");
const REPORT_PATH = path.join(ROOT, "reports/audio-download-report.json");

function walkWords(vocab, callback) {
  for (const unit of getAllUnits(vocab)) {
    for (const level of unit.levels || []) {
      for (const word of level.words || []) {
        callback(word, level, unit);
      }
    }
  }
}

function getAllUnits(vocab) {
  return (vocab.books ?? []).flatMap((book) => book.units ?? []);
}

async function main() {
  const vocab = JSON.parse(await fs.readFile(VOCAB_PATH, "utf-8"));
  const report = JSON.parse(await fs.readFile(REPORT_PATH, "utf-8"));

  const downloadedById = new Map(
    (report.downloaded || []).map((item) => [item.id, item])
  );

  let updated = 0;

  walkWords(vocab, (word) => {
    const item = downloadedById.get(word.id);
    if (item) {
      word.audio = item.audioFieldValue;
      word.audioSource = {
        provider: "Wikimedia Commons",
        sourceUrl: item.sourceUrl,
        fileName: item.fileName,
        licenseShortName: item.licenseShortName || "",
        licenseUrl: item.licenseUrl || "",
        artist: item.artist || "",
      };
      updated += 1;
    }
  });

  await fs.writeFile(VOCAB_PATH, JSON.stringify(vocab, null, 2), "utf-8");

  console.log(`Updated audio fields: ${updated}`);
  console.log(`Vocabulary file: ${VOCAB_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
