#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function updateVocabularyAudioFromLocal({ root = process.cwd() } = {}) {
  const vocabPath = path.join(root, "src/data/vocabulary.json");
  const reportPath = path.join(root, "reports/audio-local-update-report.json");
  const vocab = JSON.parse(await fs.readFile(vocabPath, "utf8"));
  const audioFilesByUnit = new Map();
  const report = {
    generatedAt: new Date().toISOString(),
    updated: [],
    missing: [],
  };

  for (const unit of getAllUnits(vocab)) {
    const audioDir = getUnitAudioDir(root, unit);
    audioFilesByUnit.set(unit.id, {
      audioDir,
      files: await listAudioFiles(audioDir),
      fieldPrefix: audioDir.startsWith(path.join(root, "src", "assets"))
        ? path.relative(path.join(root, "src"), audioDir).split(path.sep).join("/")
        : `assets/audio/${unit.id}`,
    });
  }

  walkWords(vocab, (word, _level, unit) => {
    const unitAudio = audioFilesByUnit.get(unit.id) ?? {
      files: new Set(),
      fieldPrefix: `assets/audio/${unit.id}`,
    };
    const audioFiles = unitAudio.files;
    const safeName = toSafeName(word.word);
    const mp3Path = `${safeName}.mp3`;
    const oggPath = `${safeName}.ogg`;
    const fileName = audioFiles.has(mp3Path) ? mp3Path : audioFiles.has(oggPath) ? oggPath : null;

    if (!fileName) {
      report.missing.push({
        id: word.id,
        unitId: unit.id,
        word: word.word,
        safeName,
      });
      return;
    }

    const audioFieldValue = `${unitAudio.fieldPrefix}/${fileName}`;
    word.audio = audioFieldValue;
    report.updated.push({
      id: word.id,
      unitId: unit.id,
      word: word.word,
      safeName,
      audioFieldValue,
      preferredFormat: fileName.endsWith(".mp3") ? "mp3" : "ogg",
    });
  });

  await fs.writeFile(vocabPath, JSON.stringify(vocab, null, 2), "utf8");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

async function listAudioFiles(audioDir) {
  try {
    return new Set(
      (await fs.readdir(audioDir)).filter((fileName) => fileName.endsWith(".mp3") || fileName.endsWith(".ogg")),
    );
  } catch {
    return new Set();
  }
}

function walkWords(vocab, callback) {
  for (const unit of getAllUnits(vocab)) {
    for (const level of unit.levels ?? []) {
      for (const word of level.words ?? []) {
        callback(word, level, unit);
      }
    }
    for (const word of unit.words ?? []) {
      callback(word, null, unit);
    }
  }
}

function getAllUnits(vocab) {
  return (vocab.books ?? []).flatMap((book) => book.units ?? []);
}

function getUnitAudioDir(root, unit) {
  const firstAudio = [
    ...(unit.levels ?? []).flatMap((level) => level.words ?? []),
    ...(unit.words ?? []),
  ]
    .map((word) => word.audio)
    .find(Boolean);

  if (firstAudio) {
    return path.dirname(path.join(root, "src", firstAudio));
  }

  return path.join(root, "src/assets/audio", unit.id);
}

function toSafeName(word) {
  return word
    .toLowerCase()
    .replace(/isn't/g, "isnt")
    .replace(/can't/g, "cant")
    .replace(/you're/g, "youre")
    .replace(/mr\./g, "mr")
    .replace(/o’clock/g, "oclock")
    .replace(/o'clock/g, "oclock")
    .replace(/a\.m\./g, "am")
    .replace(/p\.m\./g, "pm")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const report = await updateVocabularyAudioFromLocal();

  console.log(`Updated audio fields: ${report.updated.length}`);
  console.log(`Still missing: ${report.missing.length}`);
  console.log("Report: reports/audio-local-update-report.json");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
