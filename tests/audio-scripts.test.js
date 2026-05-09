import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateMissingAudio } from "../scripts/generate-missing-audio-openai.mjs";
import {
  generateMissingAudioWithOpenRouter,
  OPENROUTER_TTS_MODEL,
} from "../scripts/generate-missing-audio-openrouter.mjs";
import { checkAudioIntegrity } from "../scripts/check-audio-integrity.mjs";
import { updateVocabularyAudioFromLocal } from "../scripts/update-vocabulary-audio-from-local.mjs";

test("updateVocabularyAudioFromLocal prefers mp3 over ogg and writes a report", async () => {
  const root = await createTempRoot();
  await writeFixtureVocabulary(root, [
    { id: "g3b-u1-a-003", word: "horse", meaning: "马", audio: "" },
    { id: "g3b-u1-a-004", word: "bird", meaning: "鸟", audio: "" },
  ]);
  await mkdir(path.join(root, "src/assets/audio/g3b-u1"), { recursive: true });
  await writeFile(path.join(root, "src/assets/audio/g3b-u1/horse.ogg"), "ogg");
  await writeFile(path.join(root, "src/assets/audio/g3b-u1/horse.mp3"), "mp3");
  await writeFile(path.join(root, "src/assets/audio/g3b-u1/bird.ogg"), "ogg");

  const result = await updateVocabularyAudioFromLocal({ root });
  const vocab = JSON.parse(await readFile(path.join(root, "src/data/vocabulary.json"), "utf8"));
  const report = JSON.parse(await readFile(path.join(root, "reports/audio-local-update-report.json"), "utf8"));

  assert.equal(result.updated.length, 2);
  assert.equal(vocab.books[0].units[0].levels[0].words[0].audio, "assets/audio/g3b-u1/horse.mp3");
  assert.equal(vocab.books[0].units[0].levels[0].words[1].audio, "assets/audio/g3b-u1/bird.ogg");
  assert.equal(report.updated.length, 2);
});

test("generateMissingAudio creates mp3 files from the missing-word report and skips existing files", async () => {
  const root = await createTempRoot();
  const missingWords = [
    {
      id: "u1-a-003",
      word: "horse",
      meaning: "马",
      safeName: "horse",
      targetMp3: "src/assets/audio/unit-1/horse.mp3",
      audioFieldValue: "assets/audio/unit-1/horse.mp3",
    },
  ];
  await writeFile(path.join(root, "reports/missing-audio-words.json"), JSON.stringify(missingWords, null, 2));

  let fetchCount = 0;
  const result = await generateMissingAudio({
    root,
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      fetchCount += 1;
      const body = JSON.parse(options.body);
      assert.equal(url, "https://api.openai.com/v1/audio/speech");
      assert.equal(options.headers.Authorization, "Bearer test-key");
      assert.equal(body.input, "horse");
      assert.equal(body.response_format, "mp3");
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from("fake mp3"),
      };
    },
  });
  const report = JSON.parse(await readFile(path.join(root, "reports/audio-generation-report.json"), "utf8"));

  assert.equal(fetchCount, 1);
  assert.equal(result.generated.length, 1);
  assert.equal(report.generated[0].word, "horse");
  assert.equal(existsSync(path.join(root, "src/assets/audio/unit-1/horse.mp3")), true);

  const skipped = await generateMissingAudio({
    root,
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("fetch should not be called for existing mp3");
    },
  });

  assert.equal(skipped.skipped.length, 1);
});

test("generateMissingAudio writes failed entries when OPENAI_API_KEY is missing", async () => {
  const root = await createTempRoot();
  await writeFile(
    path.join(root, "reports/missing-audio-words.json"),
    JSON.stringify(
      [
        {
          id: "u1-a-003",
          word: "horse",
          meaning: "马",
          safeName: "horse",
          targetMp3: "src/assets/audio/unit-1/horse.mp3",
          audioFieldValue: "assets/audio/unit-1/horse.mp3",
        },
      ],
      null,
      2,
    ),
  );

  const result = await generateMissingAudio({ root, apiKey: "" });
  const report = JSON.parse(await readFile(path.join(root, "reports/audio-generation-report.json"), "utf8"));

  assert.equal(result.failed.length, 1);
  assert.match(report.failed[0].error, /OPENAI_API_KEY/);
});

test("generateMissingAudioWithOpenRouter builds missing words, creates mp3 files, and skips existing mp3", async () => {
  const root = await createTempRoot();
  await writeFixtureVocabulary(root, [
    { id: "g3b-u1-a-001", word: "animal", meaning: "动物", audio: "assets/audio/unit-1/animal.ogg" },
    { id: "g3b-u1-a-003", word: "horse", meaning: "马", audio: "" },
    { id: "g3b-u1-a-032", word: "isn't", meaning: "不是", audio: "" },
  ]);
  await writeFile(
    path.join(root, "reports/audio-download-report.json"),
    JSON.stringify({ downloaded: [{ id: "g3b-u1-a-001", word: "animal" }] }),
  );
  await writeFile(path.join(root, "src/assets/audio/unit-1/animal.ogg"), "ogg");

  let fetchCount = 0;
  const result = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    fetchImpl: async (url, options) => {
      fetchCount += 1;
      const body = JSON.parse(options.body);
      assert.equal(url, "https://openrouter.ai/api/v1/audio/speech");
      assert.equal(options.headers.Authorization, "Bearer openrouter-test-key");
      assert.equal(body.model, OPENROUTER_TTS_MODEL);
      assert.equal(body.input === "horse" || body.input === "isn't", true);
      assert.equal(body.response_format, "mp3");
      assert.match(body.provider.options.openai.instructions, /children/i);
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from(`mp3:${body.input}`),
      };
    },
  });
  const missing = JSON.parse(await readFile(path.join(root, "reports/missing-audio-words.json"), "utf8"));
  const report = JSON.parse(await readFile(path.join(root, "reports/audio-generation-report.json"), "utf8"));

  assert.equal(fetchCount, 2);
  assert.deepEqual(missing.map((item) => item.safeName), ["horse", "isnt"]);
  assert.equal(result.generated.length, 2);
  assert.equal(report.generated.length, 2);
  assert.equal(existsSync(path.join(root, "src/assets/audio/g3b-u1/horse.mp3")), true);
  assert.equal(existsSync(path.join(root, "src/assets/audio/g3b-u1/isnt.mp3")), true);

  const skipped = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    fetchImpl: async () => {
      throw new Error("fetch should not be called for existing mp3");
    },
  });

  assert.equal(skipped.skipped.length, 2);
});

test("generateMissingAudioWithOpenRouter writes failed entries when OPENROUTER_API_KEY is missing", async () => {
  const root = await createTempRoot();
  await writeFixtureVocabulary(root, [{ id: "g3b-u1-a-003", word: "horse", meaning: "马", audio: "" }]);
  await writeFile(
    path.join(root, "reports/audio-download-report.json"),
    JSON.stringify({ downloaded: [{ id: "g3b-u1-a-001", word: "animal" }] }),
  );

  const result = await generateMissingAudioWithOpenRouter({ root, apiKey: "" });
  const report = JSON.parse(await readFile(path.join(root, "reports/audio-generation-report.json"), "utf8"));

  assert.equal(result.failed.length, 1);
  assert.match(report.failed[0].error, /OPENROUTER_API_KEY/);
});

test("generateMissingAudioWithOpenRouter keeps the OpenRouter TTS model slug in one script constant", async () => {
  const root = await createTempRoot();
  await writeFixtureVocabulary(root, [{ id: "g3b-u1-a-003", word: "horse", meaning: "马", audio: "" }]);
  await writeFile(
    path.join(root, "reports/audio-download-report.json"),
    JSON.stringify({ downloaded: [{ id: "g3b-u1-a-001", word: "animal" }] }),
  );
  const requestedModels = [];

  const result = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requestedModels.push(body.model);

      return {
        ok: true,
        arrayBuffer: async () => Buffer.from("mp3"),
      };
    },
  });
  const scriptSource = await readFile(
    new URL("../scripts/generate-missing-audio-openrouter.mjs", import.meta.url),
    "utf8",
  );

  assert.deepEqual(requestedModels, [OPENROUTER_TTS_MODEL]);
  assert.equal([...scriptSource.matchAll(new RegExp(escapeRegExp(OPENROUTER_TTS_MODEL), "g"))].length, 1);
  assert.equal(result.generated.length, 1);
});

test("generateMissingAudioWithOpenRouter can include existing ogg words when generating mp3 replacements", async () => {
  const root = await createTempRoot();
  await writeFixtureVocabulary(root, [
    { id: "g3b-u1-a-001", word: "animal", meaning: "动物", audio: "assets/audio/unit-1/animal.ogg" },
  ]);
  await writeFile(
    path.join(root, "reports/audio-download-report.json"),
    JSON.stringify({ downloaded: [{ id: "g3b-u1-a-001", word: "animal" }] }),
  );
  await writeFile(path.join(root, "src/assets/audio/unit-1/animal.ogg"), "ogg");

  const result = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    includeExistingOgg: true,
    fetchImpl: async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.from("animal mp3"),
    }),
  });
  const missing = JSON.parse(await readFile(path.join(root, "reports/missing-audio-words.json"), "utf8"));

  assert.deepEqual(missing.map((item) => item.word), ["animal"]);
  assert.equal(result.generated.length, 1);
  assert.equal(existsSync(path.join(root, "src/assets/audio/g3b-u1/animal.mp3")), true);
});

test("generateMissingAudioWithOpenRouter scans all available units and writes unit-specific mp3 targets", async () => {
  const root = await createTempRoot();
  await writeFile(
    path.join(root, "src/data/vocabulary.json"),
    JSON.stringify(
      {
        books: [
          {
            id: "g3b",
            units: [
              {
                id: "g3b-u1",
                levels: [
                  {
                    id: "g3b-u1-main-1",
                    words: [
                      {
                        id: "g3b-u1-a-001",
                        word: "animal",
                        meaning: "动物",
                        audio: "assets/audio/unit-1/animal.mp3",
                      },
                    ],
                  },
                ],
              },
              {
                id: "g3b-u2",
                levels: [
                  {
                    id: "g3b-u2-main-1",
                    words: [
                      { id: "g3b-u2-a-001", word: "clothes", meaning: "衣服", audio: "" },
                      {
                        id: "g3b-u2-a-002",
                        word: "T-shirt",
                        meaning: "T恤衫",
                        audio: "assets/audio/unit-2/t-shirt.mp3",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(root, "reports/audio-download-report.json"),
    JSON.stringify({ downloaded: [{ id: "g3b-u1-a-001", word: "animal" }] }),
  );
  await writeFile(path.join(root, "src/assets/audio/unit-1/animal.mp3"), "mp3");

  const result = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    fetchImpl: async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.from("unit 2 mp3"),
    }),
  });
  const missing = JSON.parse(await readFile(path.join(root, "reports/missing-audio-words.json"), "utf8"));

  assert.deepEqual(missing.map((item) => item.targetMp3), [
    "src/assets/audio/g3b-u2/clothes.mp3",
    "src/assets/audio/g3b-u2/t-shirt.mp3",
  ]);
  assert.equal(result.generated.length, 2);
  assert.equal(existsSync(path.join(root, "src/assets/audio/g3b-u2/clothes.mp3")), true);
  assert.equal(existsSync(path.join(root, "src/assets/audio/g3b-u2/t-shirt.mp3")), true);
});

test("generateMissingAudioWithOpenRouter includes Unit-level dictation words", async () => {
  const root = await createTempRoot();
  await writeFile(
    path.join(root, "src/data/vocabulary.json"),
    JSON.stringify(
      {
        books: [
          {
            id: "g3b",
            units: [
              {
                id: "g3b-u2",
                words: [{ id: "g3b-u2-b-dictation-001", word: "sports shoes", meaning: "运动鞋", audio: "" }],
                levels: [],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    fetchImpl: async (_url, options) => ({
      ok: true,
      arrayBuffer: async () => Buffer.from(`mp3:${JSON.parse(options.body).input}`),
    }),
  });
  const missing = JSON.parse(await readFile(path.join(root, "reports/missing-audio-words.json"), "utf8"));

  assert.deepEqual(missing.map((item) => item.targetMp3), ["src/assets/audio/g3b-u2/sports-shoes.mp3"]);
  assert.equal(result.generated.length, 1);
  assert.equal(existsSync(path.join(root, "src/assets/audio/g3b-u2/sports-shoes.mp3")), true);
});

test("generateMissingAudioWithOpenRouter can regenerate suspiciously small mp3 files", async () => {
  const root = await createTempRoot();
  await writeFixtureVocabulary(root, [
    { id: "g3a-u1-a-008", word: "hi", meaning: "你好", audio: "assets/audio/g3a-u1/hi.mp3" },
  ]);
  await mkdir(path.join(root, "src/assets/audio/g3a-u1"), { recursive: true });
  await writeFile(path.join(root, "src/assets/audio/g3a-u1/hi.mp3"), "tiny");

  const result = await generateMissingAudioWithOpenRouter({
    root,
    apiKey: "openrouter-test-key",
    force: true,
    includeSmallMp3BelowBytes: 10,
    fetchImpl: async (_url, options) => ({
      ok: true,
      arrayBuffer: async () => Buffer.from(`better:${JSON.parse(options.body).input}`),
    }),
  });
  const missing = JSON.parse(await readFile(path.join(root, "reports/missing-audio-words.json"), "utf8"));

  assert.deepEqual(missing.map((item) => item.word), ["hi"]);
  assert.equal(result.generated.length, 1);
});

test("updateVocabularyAudioFromLocal scans audio folders per unit", async () => {
  const root = await createTempRoot();
  await writeFile(
    path.join(root, "src/data/vocabulary.json"),
    JSON.stringify(
      {
        books: [
          {
            id: "g3b",
            units: [
              {
                id: "g3b-u2",
                levels: [
                  {
                    id: "g3b-u2-main-1",
                    words: [{ id: "g3b-u2-a-001", word: "clothes", meaning: "衣服", audio: "" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  await mkdir(path.join(root, "src/assets/audio/g3b-u2"), { recursive: true });
  await writeFile(path.join(root, "src/assets/audio/g3b-u2/clothes.mp3"), "mp3");

  const result = await updateVocabularyAudioFromLocal({ root });
  const vocab = JSON.parse(await readFile(path.join(root, "src/data/vocabulary.json"), "utf8"));

  assert.equal(result.updated.length, 1);
  assert.equal(vocab.books[0].units[0].levels[0].words[0].audio, "assets/audio/g3b-u2/clothes.mp3");
});

test("updateVocabularyAudioFromLocal updates Unit-level dictation word audio", async () => {
  const root = await createTempRoot();
  await writeFile(
    path.join(root, "src/data/vocabulary.json"),
    JSON.stringify(
      {
        books: [
          {
            id: "g3b",
            units: [
              {
                id: "g3b-u3",
                words: [{ id: "g3b-u3-b-dictation-001", word: "good night", meaning: "晚安", audio: "" }],
                levels: [],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  await mkdir(path.join(root, "src/assets/audio/g3b-u3"), { recursive: true });
  await writeFile(path.join(root, "src/assets/audio/g3b-u3/good-night.mp3"), "mp3");

  const result = await updateVocabularyAudioFromLocal({ root });
  const vocab = JSON.parse(await readFile(path.join(root, "src/data/vocabulary.json"), "utf8"));

  assert.equal(result.updated.length, 1);
  assert.equal(vocab.books[0].units[0].words[0].audio, "assets/audio/g3b-u3/good-night.mp3");
});

test("checkAudioIntegrity reports missing fields, missing files, duplicate paths, and focus words", async () => {
  const root = await createTempRoot();
  await writeFile(
    path.join(root, "src/data/vocabulary.json"),
    JSON.stringify(
      {
        books: [
          {
            id: "g3a",
            units: [
              {
                id: "g3a-u1",
                levels: [
                  {
                    id: "g3a-u1-main-1",
                    words: [
                      {
                        id: "g3a-u1-a-008",
                        bookId: "g3a",
                        unitId: "g3a-u1",
                        word: "hi",
                        meaning: "你好",
                        audio: "assets/audio/g3a-u1/hi.mp3",
                      },
                      {
                        id: "g3a-u1-a-009",
                        bookId: "g3a",
                        unitId: "g3a-u1",
                        word: "what",
                        meaning: "什么",
                        audio: "assets/audio/unit-1/what.mp3",
                      },
                    ],
                  },
                ],
                spellingChallenge: {
                  enabled: true,
                  levels: [{ id: "g3a-u1-spelling-1", wordIds: ["g3a-u1-a-008", "g3a-u1-a-010"] }],
                },
              },
              {
                id: "g3a-u2",
                levels: [
                  {
                    id: "g3a-u2-main-1",
                    words: [
                      {
                        id: "g3a-u2-a-012",
                        bookId: "g3a",
                        unitId: "g3a-u2",
                        word: "duck",
                        meaning: "鸭子",
                        audio: "",
                      },
                      {
                        id: "g3a-u2-a-013",
                        bookId: "g3a",
                        unitId: "g3a-u2",
                        word: "that",
                        meaning: "那个",
                        audio: "assets/audio/g3a-u2/that.mp3",
                      },
                      {
                        id: "g3a-u2-a-014",
                        bookId: "g3a",
                        unitId: "g3a-u2",
                        word: "go",
                        meaning: "去",
                        audio: "assets/audio/g3a-u2/that.mp3",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  await mkdir(path.join(root, "src/assets/audio/g3a-u1"), { recursive: true });
  await mkdir(path.join(root, "src/assets/audio/g3a-u2"), { recursive: true });
  await writeFile(path.join(root, "src/assets/audio/g3a-u1/hi.mp3"), "tiny");
  await writeFile(path.join(root, "src/assets/audio/g3a-u2/that.mp3"), "long enough audio bytes");

  const report = await checkAudioIntegrity({
    root,
    focusWords: ["hi", "duck"],
    minMp3Bytes: 10,
  });

  assert.equal(report.totalWords, 5);
  assert.equal(report.wordsMissingAudioField, 1);
  assert.equal(report.wordsAudioFileMissing, 1);
  assert.deepEqual(report.duplicateAudioPaths.map((entry) => entry.audio), ["assets/audio/g3a-u2/that.mp3"]);
  assert.equal(report.spellingWordsWithoutAudio.length, 1);
  assert.equal(report.focusWords.hi.fileExists, true);
  assert.equal(report.focusWords.hi.willFallbackToTts, false);
  assert.equal(report.focusWords.duck.audio, "");
  assert.ok(report.problemWords.some((entry) => entry.word === "hi" && entry.reason === "audio-file-too-small"));
  assert.ok(report.problemWords.some((entry) => entry.word === "what" && entry.reason === "legacy-audio-path"));
  assert.ok(existsSync(path.join(root, "reports/audio-integrity-report.json")));
});

test("app fetches vocabulary with a cache-busting version so new audio fields are loaded", async () => {
  const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.match(mainSource, /fetch\("\.\/src\/data\/vocabulary\.json\?v=\d+"/);
});

async function createTempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "english-word-audio-"));
  await mkdir(path.join(root, "src/data"), { recursive: true });
  await mkdir(path.join(root, "src/assets/audio/unit-1"), { recursive: true });
  await mkdir(path.join(root, "reports"), { recursive: true });
  return root;
}

async function writeFixtureVocabulary(root, words) {
  await writeFile(
    path.join(root, "src/data/vocabulary.json"),
    JSON.stringify(
      {
        books: [
          {
            id: "g3b",
            units: [
              {
                id: "g3b-u1",
                levels: [
                  {
                    id: "g3b-u1-main-1",
                    words,
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
