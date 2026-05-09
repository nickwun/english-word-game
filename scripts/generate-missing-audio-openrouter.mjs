#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
export const OPENROUTER_TTS_MODEL = "openai/gpt-4o-mini-tts-2025-12-15";
const VOICE = "nova";
const INSTRUCTIONS = "Speak clearly and slightly slowly for children learning English. Pronounce only the English word.";

export async function generateMissingAudioWithOpenRouter({
  root = process.cwd(),
  apiKey = process.env.OPENROUTER_API_KEY,
  fetchImpl = globalThis.fetch,
  force = false,
  includeExistingOgg = false,
  includeSmallMp3BelowBytes = 0,
} = {}) {
  await loadLocalEnv(root);

  if (!apiKey) {
    apiKey = process.env.OPENROUTER_API_KEY;
  }

  const missingWords = await buildMissingAudioWords(root, { includeExistingOgg, includeSmallMp3BelowBytes });
  const missingPath = path.join(root, "reports/missing-audio-words.json");
  const reportPath = path.join(root, "reports/audio-generation-report.json");
  const report = {
    generatedAt: new Date().toISOString(),
    provider: "OpenRouter",
    endpoint: SPEECH_URL,
    model: OPENROUTER_TTS_MODEL,
    voice: VOICE,
    missingCount: missingWords.length,
    generated: [],
    skipped: [],
    failed: [],
  };

  await fs.mkdir(path.dirname(missingPath), { recursive: true });
  await fs.writeFile(missingPath, `${JSON.stringify(missingWords, null, 2)}\n`, "utf8");

  if (!apiKey) {
    report.failed = missingWords.map((item) => ({
      id: item.id,
      word: item.word,
      targetMp3: item.targetMp3,
      error: "OPENROUTER_API_KEY is required",
    }));
    await writeReport(reportPath, report);
    return report;
  }

  if (!fetchImpl) {
    throw new Error("fetch is required in this Node.js runtime");
  }

  for (const item of missingWords) {
    const targetPath = path.join(root, item.targetMp3);

    if (!force && await fileExists(targetPath)) {
      report.skipped.push({
        id: item.id,
        word: item.word,
        targetMp3: item.targetMp3,
        reason: "mp3 already exists",
      });
      continue;
    }

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const response = await requestSpeech(fetchImpl, apiKey, item.word);

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(targetPath, audioBuffer);
      report.generated.push({
        id: item.id,
        word: item.word,
        safeName: item.safeName,
        targetMp3: item.targetMp3,
        audioFieldValue: item.audioFieldValue,
        model: OPENROUTER_TTS_MODEL,
        bytes: audioBuffer.length,
      });
    } catch (error) {
      report.failed.push({
        id: item.id,
        word: item.word,
        safeName: item.safeName,
        targetMp3: item.targetMp3,
        error: String(error?.message || error),
      });
    }
  }

  await writeReport(reportPath, report);
  return report;
}

async function requestSpeech(fetchImpl, apiKey, word) {
  const response = await fetchImpl(SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_TTS_MODEL,
      input: word,
      voice: VOICE,
      response_format: "mp3",
      speed: 0.85,
      provider: {
        options: {
          openai: {
            instructions: INSTRUCTIONS,
          },
        },
      },
    }),
  });
  const detail = response.ok || typeof response.text !== "function" ? "" : await response.text();

  if (!response.ok) {
    throw new Error(`OpenRouter TTS failed: ${response.status} ${response.statusText ?? ""} ${detail}`.trim());
  }

  return response;
}

async function buildMissingAudioWords(root, { includeExistingOgg = false, includeSmallMp3BelowBytes = 0 } = {}) {
  const vocab = JSON.parse(await fs.readFile(path.join(root, "src/data/vocabulary.json"), "utf8"));
  const downloadReport = await readJsonIfExists(path.join(root, "reports/audio-download-report.json"), {
    downloaded: [],
  });
  const downloadedIds = new Set((downloadReport.downloaded ?? []).map((item) => item.id));
  const missing = [];

  for (const unit of getAllUnits(vocab)) {
    for (const word of getAllWordsForUnit(unit)) {
      const safeName = toSafeName(word.word);
      const targetMp3 = `src/assets/audio/${unit.id}/${safeName}.mp3`;
      const targetOgg = `src/assets/audio/${unit.id}/${safeName}.ogg`;
      const vocabularyAudioPath = word.audio ? path.join(root, "src", word.audio) : "";
      const hasVocabularyAudio =
        Boolean(word.audio) &&
        await fileExists(vocabularyAudioPath) &&
        !(includeExistingOgg && String(word.audio).endsWith(".ogg")) &&
        !(await shouldRegenerateSmallMp3(vocabularyAudioPath, word.audio, includeSmallMp3BelowBytes));
      const hasExistingOgg = await fileExists(path.join(root, targetOgg));
      const reportSaysDownloaded =
        downloadedIds.has(word.id) &&
        Boolean(word.audio) &&
        await fileExists(vocabularyAudioPath) &&
        !(includeExistingOgg && String(word.audio).endsWith(".ogg")) &&
        !(await shouldRegenerateSmallMp3(vocabularyAudioPath, word.audio, includeSmallMp3BelowBytes));

      if (hasVocabularyAudio || (!includeExistingOgg && hasExistingOgg) || reportSaysDownloaded) {
        continue;
      }

      missing.push({
        id: word.id,
        word: word.word,
        meaning: word.meaning,
        safeName,
        targetMp3,
        audioFieldValue: `assets/audio/${unit.id}/${safeName}.mp3`,
      });
    }
  }

  return missing;
}

function getAllUnits(vocab) {
  return (vocab.books ?? []).flatMap((book) => book.units ?? []);
}

function getAllWordsForUnit(unit) {
  return [
    ...(unit.levels ?? []).flatMap((level) => level.words ?? []),
    ...(unit.words ?? []),
  ];
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadLocalEnv(root) {
  const envPath = path.join(root, ".env");

  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // .env is optional; OPENROUTER_API_KEY can come from the shell environment.
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function shouldRegenerateSmallMp3(filePath, audioPath, minBytes) {
  if (!minBytes || !String(audioPath).endsWith(".mp3")) {
    return false;
  }

  try {
    const stats = await fs.stat(filePath);
    return stats.size < minBytes;
  } catch {
    return false;
  }
}

async function writeReport(reportPath, report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
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

function parseForceArg(argv) {
  return argv.includes("--force") || argv.includes("force");
}

function parseSmallMp3Threshold(argv) {
  if (!argv.includes("--include-small-mp3")) {
    return 0;
  }

  const minBytesIndex = argv.indexOf("--min-mp3-bytes");
  return minBytesIndex >= 0 ? Number(argv[minBytesIndex + 1] ?? 10000) : 10000;
}

async function main() {
  const report = await generateMissingAudioWithOpenRouter({
    force: parseForceArg(process.argv.slice(2)),
    includeExistingOgg: process.argv.includes("--include-existing-ogg"),
    includeSmallMp3BelowBytes: parseSmallMp3Threshold(process.argv.slice(2)),
  });

  console.log(`Missing audio words: ${report.missingCount}`);
  console.log(`Generated: ${report.generated.length}`);
  console.log(`Skipped: ${report.skipped.length}`);
  console.log(`Failed: ${report.failed.length}`);
  console.log("Report: reports/audio-generation-report.json");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
