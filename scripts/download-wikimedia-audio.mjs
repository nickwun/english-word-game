#!/usr/bin/env node
/**
 * Download Unit 1 pronunciation audio from Wikimedia Commons when available.
 *
 * Usage:
 *   node scripts/download-wikimedia-audio.mjs
 *
 * Output:
 *   src/assets/audio/g3b-u1/*.ogg
 *   reports/audio-download-report.json
 *
 * Notes:
 * - This script uses Wikimedia Commons MediaWiki API.
 * - It only downloads files that the API can resolve as original media URLs.
 * - Missing words are reported; they should be manually recorded or generated later.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "src/data/audio-manifest.json");
const OUT_DIR = path.join(ROOT, "src/assets/audio/g3b-u1");
const REPORT_PATH = path.join(ROOT, "reports/audio-download-report.json");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function commonsApiUrl(fileName) {
  const title = `File:${fileName}`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

async function getFileInfo(fileName) {
  const res = await fetch(commonsApiUrl(fileName), {
    headers: {
      "User-Agent": "english-word-game-audio-downloader/1.0 (educational local project)",
    },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];

  if (!page || page.missing || !page.imageinfo?.[0]?.url) return null;

  return {
    fileName,
    url: page.imageinfo[0].url,
    mime: page.imageinfo[0].mime || "",
    metadata: page.imageinfo[0].extmetadata || {},
  };
}

async function downloadFile(url, outPath) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "english-word-game-audio-downloader/1.0 (educational local project)",
    },
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(outPath, Buffer.from(arrayBuffer));
}

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(path.dirname(REPORT_PATH));

  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf-8"));
  const report = {
    generatedAt: new Date().toISOString(),
    source: "Wikimedia Commons API",
    downloaded: [],
    missing: [],
    errors: [],
  };

  for (const item of manifest.words) {
    const outPath = path.join(ROOT, item.targetPath);

    try {
      let found = null;

      for (const candidate of item.candidateCommonsFiles) {
        found = await getFileInfo(candidate);
        if (found) break;
      }

      if (!found) {
        report.missing.push({
          id: item.id,
          word: item.word,
          targetPath: item.targetPath,
          tried: item.candidateCommonsFiles,
        });
        continue;
      }

      await ensureDir(path.dirname(outPath));
      await downloadFile(found.url, outPath);

      report.downloaded.push({
        id: item.id,
        word: item.word,
        fileName: found.fileName,
        sourceUrl: found.url,
        targetPath: item.targetPath,
        audioFieldValue: item.audioFieldValue,
        mime: found.mime,
        licenseShortName: found.metadata?.LicenseShortName?.value || "",
        licenseUrl: found.metadata?.LicenseUrl?.value || "",
        artist: found.metadata?.Artist?.value || "",
      });

      console.log(`Downloaded ${item.word}: ${found.fileName}`);
    } catch (error) {
      report.errors.push({
        id: item.id,
        word: item.word,
        error: String(error?.message || error),
      });
      console.error(`Error for ${item.word}:`, error);
    }
  }

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

  console.log("");
  console.log(`Downloaded: ${report.downloaded.length}`);
  console.log(`Missing: ${report.missing.length}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
