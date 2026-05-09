#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "marin";

export async function generateMissingAudio({
  root = process.cwd(),
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = globalThis.fetch,
  force = false,
  model = process.env.OPENAI_TTS_MODEL || DEFAULT_MODEL,
  voice = process.env.OPENAI_TTS_VOICE || DEFAULT_VOICE,
} = {}) {
  const missingPath = path.join(root, "reports/missing-audio-words.json");
  const reportPath = path.join(root, "reports/audio-generation-report.json");
  const missingWords = JSON.parse(await fs.readFile(missingPath, "utf8"));
  const report = {
    generatedAt: new Date().toISOString(),
    model,
    voice,
    generated: [],
    skipped: [],
    failed: [],
  };

  if (!apiKey) {
    report.failed = missingWords.map((item) => ({
      id: item.id,
      word: item.word,
      targetMp3: item.targetMp3,
      error: "OPENAI_API_KEY is required",
    }));
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
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
      const response = await fetchImpl(SPEECH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice,
          input: item.word,
          response_format: "mp3",
          instructions: "Pronounce this single English word clearly for a young English learner. Do not add extra words.",
        }),
      });

      if (!response.ok) {
        const detail = typeof response.text === "function" ? await response.text() : "";
        throw new Error(`OpenAI TTS failed: ${response.status} ${response.statusText ?? ""} ${detail}`.trim());
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(targetPath, audioBuffer);
      report.generated.push({
        id: item.id,
        word: item.word,
        targetMp3: item.targetMp3,
        audioFieldValue: item.audioFieldValue,
        bytes: audioBuffer.length,
      });
    } catch (error) {
      report.failed.push({
        id: item.id,
        word: item.word,
        targetMp3: item.targetMp3,
        error: String(error?.message || error),
      });
    }
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseForceArg(argv) {
  return argv.includes("--force") || argv.includes("force");
}

async function main() {
  const report = await generateMissingAudio({
    force: parseForceArg(process.argv.slice(2)),
  });

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
