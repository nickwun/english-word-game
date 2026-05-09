#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_FOCUS_WORDS = ["hi", "duck"];
const DEFAULT_MIN_MP3_BYTES = 10_000;

export async function checkAudioIntegrity({
  root = process.cwd(),
  baseUrl = "",
  fetchImpl = globalThis.fetch,
  focusWords = DEFAULT_FOCUS_WORDS,
  minMp3Bytes = DEFAULT_MIN_MP3_BYTES,
} = {}) {
  const vocab = JSON.parse(await fs.readFile(path.join(root, "src/data/vocabulary.json"), "utf8"));
  const words = getAllWords(vocab);
  const wordById = new Map(words.map((word) => [word.id, word]));
  const problemWords = [];
  const duplicateAudioPaths = findDuplicateAudioPaths(words);
  const spellingWordsWithoutAudio = [];
  const focusWordDetails = {};
  let wordsWithAudio = 0;
  let wordsMissingAudioField = 0;
  let wordsAudioFileMissing = 0;

  for (const word of words) {
    if (!word.audio) {
      wordsMissingAudioField += 1;
      problemWords.push(toProblem(word, "missing-audio-field"));
      continue;
    }

    wordsWithAudio += 1;

    if (/^assets\/audio\/unit-\d+\//.test(word.audio)) {
      problemWords.push(toProblem(word, "legacy-audio-path"));
    }

    const localPath = path.join(root, "src", word.audio);
    const file = await statIfExists(localPath);

    if (!file) {
      wordsAudioFileMissing += 1;
      problemWords.push(toProblem(word, "audio-file-missing"));
      continue;
    }

    if (word.audio.endsWith(".mp3") && file.size < minMp3Bytes) {
      problemWords.push(toProblem(word, "audio-file-too-small", { bytes: file.size }));
    }
  }

  for (const unit of getAllUnits(vocab)) {
    for (const spellingLevel of unit.spellingChallenge?.levels ?? []) {
      for (const wordId of spellingLevel.wordIds ?? []) {
        const word = wordById.get(wordId);

        if (!word || !word.audio) {
          spellingWordsWithoutAudio.push({
            unitId: unit.id,
            challengeId: spellingLevel.id,
            wordId,
            word: word?.word ?? "",
          });
        }
      }
    }
  }

  for (const focusWord of focusWords) {
    const word = words.find((item) => item.word === focusWord);
    focusWordDetails[focusWord] = word
      ? await buildWordAudioDetail({ root, baseUrl, fetchImpl, word })
      : null;
  }

  const report = {
    checkedAt: new Date().toISOString(),
    totalWords: words.length,
    wordsWithAudio,
    wordsMissingAudioField,
    wordsAudioFileMissing,
    duplicateAudioPaths,
    spellingWordsWithoutAudio,
    focusWords: focusWordDetails,
    problemWords,
  };

  await fs.mkdir(path.join(root, "reports"), { recursive: true });
  await fs.writeFile(
    path.join(root, "reports/audio-integrity-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  return report;
}

function getAllUnits(vocab) {
  return (vocab.books ?? []).flatMap((book) => book.units ?? []);
}

function getAllWords(vocab) {
  return getAllUnits(vocab).flatMap((unit) => [
    ...(unit.levels ?? []).flatMap((level) =>
      (level.words ?? []).map((word) => ({
        ...word,
        unitId: word.unitId ?? unit.id,
      })),
    ),
    ...(unit.words ?? []).map((word) => ({
      ...word,
      unitId: word.unitId ?? unit.id,
    })),
  ]);
}

function findDuplicateAudioPaths(words) {
  const byAudio = new Map();

  for (const word of words) {
    if (!word.audio) {
      continue;
    }

    const entries = byAudio.get(word.audio) ?? [];
    entries.push({
      word: word.word,
      wordId: word.id,
      unitId: word.unitId,
    });
    byAudio.set(word.audio, entries);
  }

  return [...byAudio.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([audio, entries]) => ({ audio, entries }));
}

async function buildWordAudioDetail({ root, baseUrl, fetchImpl, word }) {
  const localPath = word.audio ? path.join(root, "src", word.audio) : "";
  const file = localPath ? await statIfExists(localPath) : null;
  const browserUrl = word.audio && baseUrl ? `${baseUrl.replace(/\/$/, "")}/src/${word.audio}` : "";
  const browserUrlAccessible = browserUrl ? await isUrlAccessible(browserUrl, fetchImpl) : null;
  const willFallbackToTts = !word.audio || !file || browserUrlAccessible === false;

  return {
    wordId: word.id,
    bookId: word.bookId,
    unitId: word.unitId,
    audio: word.audio ?? "",
    localPath,
    fileExists: Boolean(file),
    bytes: file?.size ?? 0,
    browserUrl,
    browserUrlAccessible,
    willFallbackToTts,
  };
}

async function isUrlAccessible(url, fetchImpl) {
  if (!fetchImpl) {
    return null;
  }

  try {
    const response = await fetchImpl(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function statIfExists(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function toProblem(word, reason, extra = {}) {
  return {
    word: word.word,
    wordId: word.id,
    unitId: word.unitId,
    audio: word.audio ?? "",
    reason,
    ...extra,
  };
}

function parseArgs(argv) {
  const args = {
    baseUrl: "",
    minMp3Bytes: DEFAULT_MIN_MP3_BYTES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--base-url") {
      args.baseUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--min-mp3-bytes") {
      args.minMp3Bytes = Number(argv[index + 1] ?? DEFAULT_MIN_MP3_BYTES);
      index += 1;
    }
  }

  return args;
}

async function main() {
  const report = await checkAudioIntegrity(parseArgs(process.argv.slice(2)));

  console.log(`Total words: ${report.totalWords}`);
  console.log(`Words with audio: ${report.wordsWithAudio}`);
  console.log(`Missing audio field: ${report.wordsMissingAudioField}`);
  console.log(`Audio file missing: ${report.wordsAudioFileMissing}`);
  console.log(`Problem words: ${report.problemWords.length}`);
  console.log("Report: reports/audio-integrity-report.json");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
