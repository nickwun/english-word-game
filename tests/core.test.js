import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAllUnits,
  getAllWords,
  getAllWordsForUnit,
  getBooks,
  getBookById,
  getLevelById,
  getLevelsByType,
  getUnitById,
  getUnitsByBookId,
  getUnits,
  getWordById,
} from "../src/core/vocabulary.js";
import {
  completeMainLevel,
  completeExtraLevel,
  completeSpellingChallenge,
  calculateUnitStatus,
  createInitialProgress,
  completeUnitReview,
  getActiveWrongWordsForUnit,
  getParentUnitStats,
  loadProgress,
  markWrongWordMastered,
  PROGRESS_STORAGE_KEY,
  recordWrongWord,
  recordSpellingMistake,
  resetProgress,
  saveProgress,
  summarizeUnitProgress,
  unlockBadgeIfEligible,
} from "../src/core/progress.js";
import {
  buildChallengeQuestions,
  buildPracticeQuestions,
  buildReviewQuestions,
  calculateChallengeStars,
  checkAnswer,
} from "../src/core/game.js";
import {
  buildSpellingQuestions,
  calculateSpellingStars,
  checkSpellingAnswer,
} from "../src/core/spelling.js";
import { playWordAudio, speakWord } from "../src/core/speech.js";
import {
  renderLearningStageView,
  renderLevelListView,
  renderChallengeCompleteView,
  renderChallengeStageView,
  renderPracticeCompleteView,
  renderPracticeStageView,
  renderSpellingCompleteView,
  renderSpellingStageView,
} from "../src/views/levelView.js";
import {
  renderReviewCompleteView,
  renderReviewEmptyView,
  renderReviewStageView,
} from "../src/views/reviewView.js";
import { renderHomeView } from "../src/views/homeView.js";
import { renderParentView } from "../src/views/parentView.js";
import { renderUnitsView } from "../src/views/unitsView.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../src/data/vocabulary.json", import.meta.url), "utf8"),
);

test("vocabulary uses books structure for upper and lower grade 3 books", () => {
  const books = getBooks(vocabulary);

  assert.equal(vocabulary.version, "2.0.0");
  assert.equal(vocabulary.textbook, undefined);
  assert.equal(vocabulary.units, undefined);
  assert.deepEqual(books.map((book) => book.id), ["g3a", "g3b"]);
  assert.equal(getBookById(vocabulary, "g3a").displayTitle, "闽教版英语三年级上册");
  assert.equal(getBookById(vocabulary, "g3b").displayTitle, "闽教版英语三年级下册");
});

test("g3a and g3b expose separate Unit namespaces", () => {
  const upperUnits = getUnitsByBookId(vocabulary, "g3a");
  const lowerUnits = getUnitsByBookId(vocabulary, "g3b");

  assert.deepEqual(upperUnits.map((unit) => unit.id), ["g3a-u1", "g3a-u2", "g3a-u3", "g3a-u4"]);
  assert.deepEqual(lowerUnits.map((unit) => unit.id), ["g3b-u1", "g3b-u2", "g3b-u3", "g3b-u4"]);
  assert.deepEqual(upperUnits.map((unit) => unit.status), ["available", "available", "available", "available"]);
  assert.deepEqual(
    lowerUnits.map((unit) => unit.status),
    ["available", "available", "available", "available"],
  );
  assert.equal(getAllUnits(vocabulary).length, 8);
  assert.equal(getUnits(vocabulary).length, 8);
});

test("upper book Unit 1-4 expose main levels without extra vocabulary", () => {
  const expected = {
    "g3a-u1": { badgeName: "交朋友达人", mainLevels: 5, words: 25 },
    "g3a-u2": { badgeName: "数字达人", mainLevels: 4, words: 19 },
    "g3a-u3": { badgeName: "颜色达人", mainLevels: 5, words: 21 },
    "g3a-u4": { badgeName: "家庭达人", mainLevels: 5, words: 21 },
  };

  for (const [unitId, expectation] of Object.entries(expected)) {
    const unit = getUnitById(vocabulary, unitId);
    const mainLevels = getLevelsByType(unit, "main");
    const extraLevels = getLevelsByType(unit, "extra");

    assert.equal(unit.status, "available");
    assert.equal(unit.badge.name, expectation.badgeName);
    assert.equal(mainLevels.length, expectation.mainLevels);
    assert.equal(extraLevels.length, 0);
    assert.equal(getAllWordsForUnit(unit).length, expectation.words);
    assert.ok(mainLevels.every((level) => level.bookId === "g3a"));
    assert.ok(getAllWordsForUnit(unit).every((word) => word.bookId === "g3a" && word.priority === "A"));
  }
});

test("upper Unit 1 first main level contains the requested greeting words", () => {
  const level = getLevelById(vocabulary, "g3a-u1-main-1");

  assert.deepEqual(
    level.words.map((word) => `${word.word}:${word.meaning}`),
    ["hello:你好", "I:我", "Miss:女士；小姐", "nice:高兴的", "meet:遇见"],
  );
  assert.equal(getWordById(vocabulary, "g3a-u1-a-001").word, "hello");
});

test("upper book word and level ids are unique", () => {
  const upperUnits = getUnitsByBookId(vocabulary, "g3a");
  const levelIds = upperUnits.flatMap((unit) => unit.levels.map((level) => level.id));
  const wordIds = upperUnits.flatMap((unit) => unit.levels.flatMap((level) => level.words.map((word) => word.id)));

  assert.equal(new Set(levelIds).size, levelIds.length);
  assert.equal(new Set(wordIds).size, wordIds.length);
});

test("upper book local audio files exist for every main word", async () => {
  const upperWords = getUnitsByBookId(vocabulary, "g3a").flatMap((unit) => getAllWordsForUnit(unit));

  assert.equal(upperWords.length, 86);
  for (const word of upperWords) {
    assert.match(word.audio, /^assets\/audio\/g3a-u\d\/.+\.mp3$/);
    await access(new URL(`../src/${word.audio}`, import.meta.url));
  }
});

test("all vocabulary words have local audio files without legacy unit paths", async () => {
  const allWords = getAllWords(vocabulary);

  for (const word of allWords) {
    assert.match(word.audio, /^assets\/audio\/g3[ab]-u\d\/.+\.mp3$/, `${word.word} should use a namespaced local mp3`);
    assert.doesNotMatch(word.audio, /assets\/audio\/unit-\d\//);
    await access(new URL(`../src/${word.audio}`, import.meta.url));
  }
});

test("hi and duck have local mp3 audio", async () => {
  for (const wordText of ["hi", "duck"]) {
    const word = getAllWords(vocabulary).find((item) => item.word === wordText);

    assert.ok(word, `${wordText} should exist`);
    assert.match(word.audio, new RegExp(`^assets/audio/${word.unitId}/${wordText}\\.mp3$`));
    await access(new URL(`../src/${word.audio}`, import.meta.url));
  }
});

test("namespaced lookup helpers find lower-book Unit, Level, and Word", () => {
  assert.equal(getUnitById(vocabulary, "g3b-u1").title, "Our Animal Friends");
  assert.equal(getLevelById(vocabulary, "g3b-u1-main-1").displayTitle, "动物朋友 1");
  assert.equal(getWordById(vocabulary, "g3b-u1-a-001").word, "animal");
});

test("Unit 1 contains the documented main and extra level structure", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");

  assert.equal(getLevelsByType(unit, "main").length, 4);
  assert.equal(getLevelsByType(unit, "extra").length, 5);
  assert.equal(getAllWordsForUnit(unit).length, 43);
});

test("Unit 2-4 contain main and extra level structures with local audio fields", () => {
  const expected = {
    "g3b-u2": { badgeName: "衣服达人", mainLevels: 4, extraLevels: 3 },
    "g3b-u3": { badgeName: "时间达人", mainLevels: 4, extraLevels: 3 },
    "g3b-u4": { badgeName: "健康饮食达人", mainLevels: 4, extraLevels: 2 },
  };

  for (const [unitId, expectation] of Object.entries(expected)) {
    const unit = getUnitById(vocabulary, unitId);
    const mainLevels = getLevelsByType(unit, "main");
    const extraLevels = getLevelsByType(unit, "extra");

    assert.equal(unit.status, "available");
    assert.equal(unit.badge.name, expectation.badgeName);
    assert.equal(mainLevels.length, expectation.mainLevels);
    assert.equal(extraLevels.length, expectation.extraLevels);
    assert.ok(mainLevels.every((level) => level.words.length === 5));
    assert.ok(extraLevels.every((level) => level.words.length > 0 && level.words.length <= 5));

    for (const word of getAllWordsForUnit(unit)) {
      assert.equal(word.bookId, "g3b");
      assert.match(word.audio, /^assets\/audio\/g3b-u\d\/.+\.mp3$/);
    }
  }
});

test("empty progress reports Unit 1 as not started", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const progress = createInitialProgress();

  assert.equal(calculateUnitStatus(unit, progress), "未开始");
  assert.deepEqual(summarizeUnitProgress(unit, progress), {
    completedMainLevels: 0,
    totalMainLevels: 4,
    completedExtraLevels: 0,
    totalExtraLevels: 5,
    totalStars: 0,
    wrongWords: 0,
    badgeUnlocked: false,
    status: "未开始",
  });
});

test("Unit 1 main level list exposes the four documented main level ids", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const html = renderLevelListView({ unit, progress: createInitialProgress() });

  for (const levelId of ["g3b-u1-main-1", "g3b-u1-main-2", "g3b-u1-main-3", "g3b-u1-main-4"]) {
    assert.match(html, new RegExp(`data-level-id="${levelId}"`));
  }
});

test("Unit list separates upper and lower books", () => {
  const html = renderUnitsView({ vocabulary, progress: createInitialProgress() });

  assert.match(html, /闽教版英语三年级上册/);
  assert.match(html, /Unit 1 Meeting Friends/);
  assert.match(html, /Unit 4 Loving My Family/);
  assert.match(html, /闽教版英语三年级下册/);
  for (const unitId of ["g3a-u1", "g3a-u2", "g3a-u3", "g3a-u4", "g3b-u1", "g3b-u2", "g3b-u3", "g3b-u4"]) {
    assert.match(html, new RegExp(`data-unit-id="${unitId}"`));
  }
  assert.match(html, /进入 Unit 1/);
  assert.match(html, /进入 Unit 2/);
  assert.doesNotMatch(html, /即将开放/);
});

test("upper Unit without extra levels keeps main review flow available and omits extra challenge buttons", () => {
  const unit = getUnitById(vocabulary, "g3a-u1");
  const html = renderLevelListView({ unit, progress: createInitialProgress() });

  assert.match(html, /选择 Unit 1 主线关卡/);
  assert.match(html, /g3a-u1-main-1/);
  assert.match(html, /data-route="learning"/);
  assert.match(html, /data-route="review"/);
  assert.match(html, /data-route="parent"/);
  assert.match(html, /暂无额外挑战/);
  assert.doesNotMatch(html, /data-route="extra-challenge"/);
});

test("upper book Unit 1-4 expose spelling challenges", () => {
  for (const unitId of ["g3a-u1", "g3a-u2", "g3a-u3", "g3a-u4"]) {
    const unit = getUnitById(vocabulary, unitId);
    const html = renderLevelListView({ unit, progress: createInitialProgress() });

    assert.equal(unit.spellingChallenge.enabled, true);
    assert.equal(unit.spellingChallenge.levels.length, 2);
    assert.match(html, /拼写挑战/);
    assert.match(html, /data-route="spelling"/);
    assert.match(html, new RegExp(`data-spelling-level-id="${unitId}-spelling-1"`));
    assert.match(html, new RegExp(`data-spelling-level-id="${unitId}-spelling-2"`));
  }
});

test("upper Unit 2-4 spelling challenge word lists match the approved sample scope", () => {
  const expected = {
    "g3a-u2": {
      letter: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "many", "duck", "that", "go", "old", "year", "it", "phone", "pet"],
      keyboard: ["one", "two", "six", "ten", "go", "it", "pet"],
    },
    "g3a-u3": {
      letter: ["red", "green", "color", "blue", "yellow", "white", "pink", "orange", "schoolbag", "pencil", "pen", "ruler", "black", "flower", "draw", "cut", "make", "they"],
      keyboard: ["red", "blue", "pink", "pen", "cut", "they"],
    },
    "g3a-u4": {
      letter: ["father", "mother", "brother", "sister", "cake", "grandma", "grandpa", "we", "who", "he", "she", "family", "doctor", "farmer", "cook", "uncle", "worker", "aunt", "nurse", "love", "big"],
      keyboard: ["cake", "we", "who", "he", "she", "cook", "aunt", "love", "big"],
    },
  };

  for (const [unitId, lists] of Object.entries(expected)) {
    const unit = getUnitById(vocabulary, unitId);
    const [letterLevel, keyboardLevel] = unit.spellingChallenge.levels;

    assert.equal(letterLevel.id, `${unitId}-spelling-1`);
    assert.equal(letterLevel.type, "letter-order");
    assert.equal(keyboardLevel.id, `${unitId}-spelling-2`);
    assert.equal(keyboardLevel.type, "keyboard-input");
    assert.deepEqual(buildSpellingQuestions({ unit, spellingLevel: letterLevel, random: () => 0 }).map((question) => question.correctWord.word), lists.letter);
    assert.deepEqual(buildSpellingQuestions({ unit, spellingLevel: keyboardLevel, random: () => 0 }).map((question) => question.correctWord.word), lists.keyboard);
  }
});

test("lower book Unit 1-4 expose three spelling challenge levels", () => {
  for (const unitId of ["g3b-u1", "g3b-u2", "g3b-u3", "g3b-u4"]) {
    const unit = getUnitById(vocabulary, unitId);
    const html = renderLevelListView({ unit, progress: createInitialProgress() });

    assert.equal(unit.spellingChallenge.enabled, true);
    assert.deepEqual(
      unit.spellingChallenge.levels.map((level) => `${level.id}:${level.type}:${level.title}`),
      [
        `${unitId}-spelling-1:letter-order:字母排序`,
        `${unitId}-spelling-2:keyboard-input-basic:基础输入`,
        `${unitId}-spelling-3:keyboard-input-dictation:课本听写挑战`,
      ],
    );
    assert.match(html, new RegExp(`data-spelling-level-id="${unitId}-spelling-1"`));
    assert.match(html, new RegExp(`data-spelling-level-id="${unitId}-spelling-2"`));
    assert.match(html, new RegExp(`data-spelling-level-id="${unitId}-spelling-3"`));
    assert.match(html, /这一关更接近学校听写，适合复习后再挑战。/);
  }
});

test("lower dictation spelling levels include textbook long words and special phrases", () => {
  const expected = {
    "g3b-u1": ["animal", "bear", "horse", "bird", "panda", "small", "ear", "eye", "baby", "long", "leg", "these", "those", "jump", "mouth", "meat", "tiger", "no", "draw", "nose"],
    "g3b-u2": ["clothes", "shirt", "skirt", "whose", "sweater", "shorts", "nice", "but", "too", "put", "on", "hat", "shoe", "sock", "T-shirt", "new", "school", "bag", "jacket", "sports shoes"],
    "g3b-u3": ["time", "eleven", "twelve", "thirty", "early", "late", "o'clock", "home", "story", "so", "much", "good night", "to", "go", "bed", "watch", "TV", "homework", "at", "past"],
    "g3b-u4": ["breakfast", "milk", "egg", "bread", "lunch", "rice", "fish", "vegetable", "favorite", "hamburger", "dinner", "soup", "fruit", "some", "need", "food", "body", "strong", "healthy", "every"],
  };

  for (const [unitId, words] of Object.entries(expected)) {
    const unit = getUnitById(vocabulary, unitId);
    const dictationLevel = unit.spellingChallenge.levels.find((level) => level.type === "keyboard-input-dictation");

    assert.deepEqual(
      buildSpellingQuestions({ unit, spellingLevel: dictationLevel, random: () => 0 }).map((question) => question.correctWord.word),
      words,
    );
  }
});

test("lower spelling answer checks normalize case, trim, and repeated spaces while preserving required punctuation", () => {
  const unit = getUnitById(vocabulary, "g3b-u3");
  const dictationLevel = unit.spellingChallenge.levels.find((level) => level.type === "keyboard-input-dictation");
  const questions = buildSpellingQuestions({ unit, spellingLevel: dictationLevel, random: () => 0 });
  const tvQuestion = questions.find((question) => question.correctWord.word === "TV");
  const goodNightQuestion = questions.find((question) => question.correctWord.word === "good night");
  const oclockQuestion = questions.find((question) => question.correctWord.word === "o'clock");

  assert.equal(checkSpellingAnswer(tvQuestion, " tv "), true);
  assert.equal(checkSpellingAnswer(goodNightQuestion, " good   night "), true);
  assert.equal(checkSpellingAnswer(oclockQuestion, " O'CLOCK "), true);
  assert.equal(checkSpellingAnswer(oclockQuestion, "oclock"), false);

  const unit2 = getUnitById(vocabulary, "g3b-u2");
  const unit2Dictation = unit2.spellingChallenge.levels.find((level) => level.type === "keyboard-input-dictation");
  const unit2Questions = buildSpellingQuestions({ unit: unit2, spellingLevel: unit2Dictation, random: () => 0 });
  const tshirtQuestion = unit2Questions.find((question) => question.correctWord.word === "T-shirt");
  const sportsShoesQuestion = unit2Questions.find((question) => question.correctWord.word === "sports shoes");

  assert.equal(checkSpellingAnswer(tshirtQuestion, "t-shirt"), true);
  assert.equal(checkSpellingAnswer(sportsShoesQuestion, "sports   shoes"), true);
  assert.equal(checkSpellingAnswer(sportsShoesQuestion, "sportsshoes"), false);
});

test("all spelling challenge word ids resolve through the unified vocabulary lookup", () => {
  for (const unit of getAllUnits(vocabulary)) {
    for (const spellingLevel of unit.spellingChallenge?.levels ?? []) {
      for (const wordId of spellingLevel.wordIds) {
        assert.ok(getWordById(vocabulary, wordId), `${spellingLevel.id} references missing word ${wordId}`);
      }
    }

    assert.equal(unit.spellingChallenge?.words?.length ?? 0, 0);
  }
});

test("lower dictation-only words are available from Unit word pools", () => {
  assert.ok(getAllWordsForUnit(getUnitById(vocabulary, "g3b-u2")).some((word) => word.word === "sports shoes"));
  assert.ok(getAllWordsForUnit(getUnitById(vocabulary, "g3b-u3")).some((word) => word.word === "good night"));
  assert.ok(getAllWordsForUnit(getUnitById(vocabulary, "g3b-u4")).some((word) => word.word === "strong"));
});

test("lower dictation words all have local mp3 audio", async () => {
  for (const unitId of ["g3b-u1", "g3b-u2", "g3b-u3", "g3b-u4"]) {
    const unit = getUnitById(vocabulary, unitId);
    const dictationLevel = unit.spellingChallenge.levels.find((level) => level.type === "keyboard-input-dictation");

    for (const wordId of dictationLevel.wordIds) {
      const word = getWordById(vocabulary, wordId);

      assert.match(word.audio, new RegExp(`^assets/audio/${unitId}/.+\\.mp3$`), `${word.word} should use local mp3`);
      await access(new URL(`../src/${word.audio}`, import.meta.url));
    }
  }
});

test("special spelling words use stable ids and playable local audio", async () => {
  const expected = [
    ["g3b-u2", "T-shirt"],
    ["g3b-u2", "sports shoes"],
    ["g3b-u3", "o'clock"],
    ["g3b-u3", "good night"],
    ["g3b-u3", "TV"],
  ];

  for (const [unitId, wordText] of expected) {
    const word = getAllWordsForUnit(getUnitById(vocabulary, unitId)).find((item) => item.word === wordText);

    assert.ok(word?.id, `${wordText} should have a stable wordId`);
    assert.equal(getWordById(vocabulary, word.id)?.word, wordText);
    assert.match(word.audio, new RegExp(`^assets/audio/${unitId}/.+\\.mp3$`));
    await access(new URL(`../src/${word.audio}`, import.meta.url));
    assert.equal(await playWordAudio(word, { Audio: class { play() { return Promise.resolve(); } } }), true);
  }
});

test("spelling mistakes can be recorded with unified dictation word ids", () => {
  const unit = getUnitById(vocabulary, "g3b-u2");
  const dictationLevel = unit.spellingChallenge.levels.find((level) => level.type === "keyboard-input-dictation");
  const sportsShoesId = dictationLevel.wordIds.find((wordId) => getWordById(vocabulary, wordId)?.word === "sports shoes");
  const progress = recordSpellingMistake(createInitialProgress(), {
    wordId: sportsShoesId,
    unitId: unit.id,
    challengeId: dictationLevel.id,
    lastMistakeAt: "2026-05-09T00:00:00.000Z",
  });

  assert.equal(getWordById(vocabulary, sportsShoesId).word, "sports shoes");
  assert.equal(progress.spellingMistakes[sportsShoesId].wordId, sportsShoesId);
  assert.deepEqual(progress.wrongWords, {});
});

test("spelling questions generate letter-order and keyboard-input variants", () => {
  const unit = getUnitById(vocabulary, "g3a-u1");
  const [letterLevel, keyboardLevel] = unit.spellingChallenge.levels;
  const letterQuestions = buildSpellingQuestions({ unit, spellingLevel: letterLevel, random: () => 0 });
  const keyboardQuestions = buildSpellingQuestions({ unit, spellingLevel: keyboardLevel, random: () => 0 });

  assert.equal(letterQuestions.length, 17);
  assert.ok(letterQuestions.every((question) => question.type === "letter-order"));
  assert.deepEqual(letterQuestions.map((question) => question.correctWord.word), [
    "hello",
    "nice",
    "meet",
    "you",
    "what",
    "your",
    "name",
    "good",
    "morning",
    "fine",
    "afternoon",
    "thank",
    "mom",
    "this",
    "goodbye",
    "have",
    "day",
  ]);
  assert.ok(letterQuestions.every((question) => question.letters.join("") !== question.correctWord.word));

  assert.equal(keyboardQuestions.length, 8);
  assert.ok(keyboardQuestions.every((question) => question.type === "keyboard-input"));
  assert.deepEqual(keyboardQuestions.map((question) => question.correctWord.word), [
    "hi",
    "I",
    "am",
    "is",
    "you",
    "my",
    "mom",
    "day",
  ]);
  assert.equal(keyboardQuestions.some((question) => question.correctWord.word === "Miss"), false);
});

test("spelling answer checks are case-insensitive and trim whitespace", () => {
  const unit = getUnitById(vocabulary, "g3a-u1");
  const [letterLevel] = unit.spellingChallenge.levels;
  const [question] = buildSpellingQuestions({ unit, spellingLevel: letterLevel, random: () => 0 });

  assert.equal(checkSpellingAnswer(question, "hello"), true);
  assert.equal(checkSpellingAnswer(question, " HELLO "), true);
  assert.equal(checkSpellingAnswer(question, "helo"), false);
});

test("spelling progress and mistakes are independent from wrongWords", () => {
  const completedAt = "2026-05-08T13:00:00.000Z";
  const progress = createInitialProgress();
  const withMistake = recordSpellingMistake(progress, {
    wordId: "g3a-u1-a-001",
    unitId: "g3a-u1",
    challengeId: "g3a-u1-spelling-1",
    lastMistakeAt: completedAt,
  });
  const completed = completeSpellingChallenge(withMistake, {
    challengeId: "g3a-u1-spelling-1",
    stars: calculateSpellingStars(1),
    completedAt,
  });

  assert.deepEqual(withMistake.wrongWords, {});
  assert.deepEqual(completed.spellingMistakes["g3a-u1-a-001"], {
    wordId: "g3a-u1-a-001",
    unitId: "g3a-u1",
    challengeId: "g3a-u1-spelling-1",
    mistakeCount: 1,
    lastMistakeAt: completedAt,
  });
  assert.deepEqual(completed.spellingProgress["g3a-u1-spelling-1"], {
    stars: 2,
    completedAt,
    attempts: 1,
  });
});

test("spelling views render letter ordering, keyboard input, and completion stars", () => {
  const unit = getUnitById(vocabulary, "g3a-u1");
  const [letterLevel, keyboardLevel] = unit.spellingChallenge.levels;
  const [letterQuestion] = buildSpellingQuestions({ unit, spellingLevel: letterLevel, random: () => 0 });
  const [keyboardQuestion] = buildSpellingQuestions({ unit, spellingLevel: keyboardLevel, random: () => 0 });
  const letterHtml = renderSpellingStageView({
    unit,
    spellingLevel: letterLevel,
    question: letterQuestion,
    questionIndex: 0,
    totalQuestions: 17,
    feedback: null,
    builtAnswer: "",
  });
  const keyboardHtml = renderSpellingStageView({
    unit,
    spellingLevel: keyboardLevel,
    question: keyboardQuestion,
    questionIndex: 0,
    totalQuestions: 8,
    feedback: null,
    builtAnswer: "",
  });
  const completeHtml = renderSpellingCompleteView({ unit, spellingLevel: letterLevel, stars: 3, finalMistakeCount: 0 });

  assert.match(letterHtml, /字母排序/);
  assert.match(letterHtml, /class="spelling-compose-panel"/);
  assert.match(letterHtml, /data-spelling-letter=/);
  assert.match(letterHtml, /data-spelling-clear/);
  assert.match(letterHtml, /data-spelling-check/);
  assert.match(keyboardHtml, /data-spelling-input/);
  assert.match(keyboardHtml, /键盘输入/);
  assert.match(completeHtml, /拼写挑战完成/);
  assert.match(completeHtml, /3 个拼写星星/);
});

test("keyboard spelling views keep check actions near the input and support form submit", () => {
  const cases = [
    ["g3a-u1", "keyboard-input"],
    ["g3b-u1", "keyboard-input-basic"],
    ["g3b-u4", "keyboard-input-dictation"],
  ];

  for (const [unitId, type] of cases) {
    const unit = getUnitById(vocabulary, unitId);
    const spellingLevel = unit.spellingChallenge.levels.find((level) => level.type === type);
    const [question] = buildSpellingQuestions({ unit, spellingLevel, random: () => 0 });
    const html = renderSpellingStageView({
      unit,
      spellingLevel,
      question,
      questionIndex: 0,
      totalQuestions: 1,
      feedback: null,
      builtAnswer: "",
    });

    assert.match(html, /data-spelling-form/);
    assert.match(html, /enterkeyhint="done"/);
    assert.match(html, /type="submit" data-spelling-check="true"/);
    assert.match(html, /data-spelling-clear="true"/);
    assert.match(html, /class="spelling-inline-actions"/);
  }
});

test("app binds Enter key on spelling inputs to the spelling check flow", async () => {
  const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.match(mainSource, /addEventListener\("keydown"/);
  assert.match(mainSource, /\["Enter", "Return"\]\.includes\(event\.key\)/);
  assert.match(mainSource, /event\.target\.closest\("\[data-spelling-input\]"\)/);
  assert.match(mainSource, /checkCurrentSpellingAnswer\(\)/);
});

test("letter-order spelling view keeps button-based spelling controls", () => {
  const unit = getUnitById(vocabulary, "g3a-u1");
  const [spellingLevel] = unit.spellingChallenge.levels;
  const [question] = buildSpellingQuestions({ unit, spellingLevel, random: () => 0 });
  const html = renderSpellingStageView({
    unit,
    spellingLevel,
    question,
    questionIndex: 0,
    totalQuestions: 1,
    feedback: null,
    builtAnswer: "",
  });

  assert.doesNotMatch(html, /data-spelling-form/);
  assert.match(html, /data-spelling-letter=/);
  assert.match(html, /data-spelling-check="true"/);
});

test("parent panel displays spelling stats for upper and lower spelling units", () => {
  const unit = getUnitById(vocabulary, "g3a-u2");
  const lowerUnit = getUnitById(vocabulary, "g3b-u1");
  const completedAt = "2026-05-08T13:00:00.000Z";
  let progress = createInitialProgress();
  progress = completeSpellingChallenge(progress, {
    challengeId: "g3a-u2-spelling-1",
    stars: 3,
    completedAt,
  });
  progress = recordSpellingMistake(progress, {
    wordId: "g3a-u2-a-001",
    unitId: "g3a-u2",
    challengeId: "g3a-u2-spelling-1",
    lastMistakeAt: completedAt,
  });

  const stats = getParentUnitStats(unit, progress);
  const html = renderParentView({ unit, progress });
  const lowerHtml = renderParentView({ unit: lowerUnit, progress });

  assert.equal(stats.completedSpellingChallenges, 1);
  assert.equal(stats.totalSpellingChallenges, 2);
  assert.equal(stats.spellingStars, 3);
  assert.equal(stats.spellingMistakeCount, 1);
  assert.match(html, /拼写挑战完成数/);
  assert.match(html, /1\/2/);
  assert.match(html, /拼写星星/);
  assert.match(html, /3/);
  assert.match(html, /拼写错误词数/);
  assert.match(html, /1/);
  assert.match(lowerHtml, /拼写挑战完成数/);
  assert.match(lowerHtml, /0\/3/);
});

test("learning stage renders the selected level's five word cards", () => {
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const html = renderLearningStageView({ level });

  assert.equal(level.words.length, 5);
  assert.match(html, /animal/);
  assert.match(html, /panda/);
  assert.equal([...html.matchAll(/class="word-card"/g)].length, 5);
  assert.equal([...html.matchAll(/data-speak-word-id=/g)].length, 5);
  assert.match(html, /data-route="practice"/);
});

test("speakWord is safe when browser Text-to-Speech is unavailable", () => {
  assert.equal(speakWord("bear", { speechSynthesis: null, SpeechSynthesisUtterance: null }), false);
});

test("speakWord uses stable English TTS settings", () => {
  let spokenUtterance = null;
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }
  const environment = {
    SpeechSynthesisUtterance: FakeUtterance,
    speechSynthesis: {
      cancel() {},
      speak(utterance) {
        spokenUtterance = utterance;
      },
    },
  };

  assert.equal(speakWord("bear", environment), true);
  assert.equal(spokenUtterance.text, "bear");
  assert.equal(spokenUtterance.lang, "en-US");
  assert.equal(spokenUtterance.rate, 0.75);
  assert.equal(spokenUtterance.pitch, 1);
  assert.equal(spokenUtterance.volume, 1);
});

test("playWordAudio prefers local audio and falls back to TTS if playback fails", async () => {
  const playedSources = [];
  let fallbackWord = null;
  let warningPayload = null;
  class FakeAudio {
    constructor(src) {
      this.src = src;
      playedSources.push(src);
    }

    play() {
      return Promise.resolve();
    }
  }
  const successEnvironment = {
    Audio: FakeAudio,
    speakWord(word) {
      fallbackWord = word;
      return true;
    },
  };

  assert.equal(
    await playWordAudio({ word: "animal", audio: "assets/audio/unit-1/animal.ogg" }, successEnvironment),
    true,
  );
  assert.equal(playedSources[0], "./src/assets/audio/unit-1/animal.ogg?v24");
  assert.equal(fallbackWord, null);

  const fallbackEnvironment = {
    Audio: class {
      play() {
        return Promise.reject(new Error("audio failed"));
      }
    },
    console: {
      warn(_message, payload) {
        warningPayload = payload;
      },
    },
    speakWord(word) {
      fallbackWord = word;
      return true;
    },
  };

  assert.equal(
    await playWordAudio({ id: "g3b-u1-a-002", word: "bear", audio: "assets/audio/g3b-u1/bear.mp3" }, fallbackEnvironment),
    true,
  );
  assert.equal(fallbackWord, "bear");
  assert.deepEqual(warningPayload, {
    word: "bear",
    wordId: "g3b-u1-a-002",
    audio: "assets/audio/g3b-u1/bear.mp3",
  });
});

test("practice questions include every level word and four meaning options", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const questions = buildPracticeQuestions({ unit, level, random: () => 0.42 });

  assert.equal(questions.length, level.words.length);
  assert.deepEqual(
    questions.map((question) => question.correctWord.id).sort(),
    level.words.map((word) => word.id).sort(),
  );
  assert.ok(questions.some((question) => question.type === "word-to-meaning"));
  assert.ok(questions.some((question) => question.type === "audio-to-meaning"));

  for (const question of questions) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
    assert.ok(question.options.some((option) => option.id === question.correctWord.id));
  }
});

test("practice question distractors prefer words from the same level", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const [question] = buildPracticeQuestions({ unit, level, random: () => 0.5 });
  const levelWordIds = new Set(level.words.map((word) => word.id));

  for (const option of question.options) {
    assert.ok(levelWordIds.has(option.id));
  }
});

test("checkAnswer returns whether the selected option matches the correct word", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const [question] = buildPracticeQuestions({ unit, level, random: () => 0.5 });
  const wrongOption = question.options.find((option) => option.id !== question.correctWord.id);

  assert.equal(checkAnswer(question, question.correctWord.id), true);
  assert.equal(checkAnswer(question, wrongOption.id), false);
});

test("practice view renders the current question and completion placeholder", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const [question] = buildPracticeQuestions({ unit, level, random: () => 0.5 });
  const html = renderPracticeStageView({
    level,
    question,
    questionIndex: 0,
    totalQuestions: 5,
    feedback: null,
  });
  const completeHtml = renderPracticeCompleteView({ level });

  assert.match(html, /练习阶段/);
  assert.equal([...html.matchAll(/data-answer-word-id=/g)].length, 4);
  assert.match(completeHtml, /本关练习完成/);
  assert.match(completeHtml, /data-route="challenge"/);
});

test("challenge questions include every level word and all four challenge types", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const questions = buildChallengeQuestions({ unit, level, random: () => 0.42 });

  assert.equal(questions.length, level.words.length);
  assert.deepEqual(
    questions.map((question) => question.correctWord.id).sort(),
    level.words.map((word) => word.id).sort(),
  );
  assert.deepEqual(
    new Set(questions.map((question) => question.type)),
    new Set(["word-to-meaning", "audio-to-meaning", "audio-to-image", "image-to-word"]),
  );

  for (const question of questions) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
    assert.ok(question.options.some((option) => option.id === question.correctWord.id));
  }
});

test("challenge question distractors prefer words from the same level", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const questions = buildChallengeQuestions({ unit, level, random: () => 0.5 });
  const levelWordIds = new Set(level.words.map((word) => word.id));

  for (const question of questions) {
    for (const option of question.options) {
      assert.ok(levelWordIds.has(option.id));
    }
  }
});

test("challenge view renders image and word answer variants plus completion page", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-main-1");
  const questions = buildChallengeQuestions({ unit, level, random: () => 0.5 });
  const audioImageQuestion = questions.find((question) => question.type === "audio-to-image");
  const imageWordQuestion = questions.find((question) => question.type === "image-to-word");
  const audioImageHtml = renderChallengeStageView({
    level,
    question: audioImageQuestion,
    questionIndex: 2,
    totalQuestions: 5,
    feedback: null,
  });
  const imageWordHtml = renderChallengeStageView({
    level,
    question: imageWordQuestion,
    questionIndex: 3,
    totalQuestions: 5,
    feedback: null,
  });
  const completeHtml = renderChallengeCompleteView({ level, stars: 2, wrongWordCount: 1 });

  assert.match(audioImageHtml, /听发音，选图片/);
  assert.equal([...audioImageHtml.matchAll(/class="option-image"/g)].length, 4);
  assert.match(imageWordHtml, /看图片，选英文/);
  assert.equal([...imageWordHtml.matchAll(/data-answer-word-id=/g)].length, 4);
  assert.match(completeHtml, /本关挑战完成/);
  assert.match(completeHtml, /获得 2 颗星/);
  assert.match(completeHtml, /本关新增错词 1 个/);
  assert.match(completeHtml, /返回 Unit 1/);
});

test("challenge star calculation follows the documented final-error rule", () => {
  assert.equal(calculateChallengeStars(0), 3);
  assert.equal(calculateChallengeStars(1), 2);
  assert.equal(calculateChallengeStars(2), 2);
  assert.equal(calculateChallengeStars(3), 1);
  assert.equal(calculateChallengeStars(5), 1);
});

test("main level completion is saved without writing wrongWords", () => {
  const progress = createInitialProgress();
  const completedAt = "2026-05-07T10:00:00.000Z";
  const updated = completeMainLevel(progress, {
    levelId: "g3b-u1-main-1",
    stars: 3,
    completedAt,
  });

  assert.deepEqual(updated.completedLevels["g3b-u1-main-1"], { stars: 3, completedAt });
  assert.deepEqual(updated.wrongWords, {});
  assert.notEqual(updated, progress);
});

test("saved completed level reloads from localStorage and updates Unit 1 summary", () => {
  const storage = createMemoryStorage();
  const unit = getUnitById(vocabulary, "g3b-u1");
  const progress = completeMainLevel(createInitialProgress(), {
    levelId: "g3b-u1-main-1",
    stars: 2,
    completedAt: "2026-05-07T10:00:00.000Z",
  });

  saveProgress(progress, storage);
  const loaded = loadProgress(storage);
  const summary = summarizeUnitProgress(unit, loaded);
  const html = renderLevelListView({ unit, progress: loaded });

  assert.equal(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)).completedLevels["g3b-u1-main-1"].stars, 2);
  assert.equal(summary.completedMainLevels, 1);
  assert.equal(summary.totalMainLevels, 4);
  assert.equal(summary.totalStars, 2);
  assert.equal(summary.status, "学习中");
  assert.match(html, /2 星/);
});

test("wrong word recording creates DATA_SCHEMA compatible entries", () => {
  const progress = createInitialProgress();
  const lastWrongAt = "2026-05-07T10:10:00.000Z";
  const updated = recordWrongWord(progress, {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt,
  });

  assert.deepEqual(updated.wrongWords["g3b-u1-a-001"], {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    wrongCount: 1,
    mastered: false,
    lastWrongAt,
  });
});

test("wrong word recording increments previous entries and marks them unmastered", () => {
  const progress = {
    ...createInitialProgress(),
    wrongWords: {
      "g3b-u1-a-001": {
        wordId: "g3b-u1-a-001",
        unitId: "g3b-u1",
        levelId: "g3b-u1-main-1",
        wrongCount: 2,
        mastered: true,
        lastWrongAt: "2026-05-07T10:00:00.000Z",
      },
    },
  };
  const updated = recordWrongWord(progress, {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt: "2026-05-07T10:20:00.000Z",
  });

  assert.equal(updated.wrongWords["g3b-u1-a-001"].wrongCount, 3);
  assert.equal(updated.wrongWords["g3b-u1-a-001"].mastered, false);
  assert.equal(updated.wrongWords["g3b-u1-a-001"].lastWrongAt, "2026-05-07T10:20:00.000Z");
});

test("saved wrong words reload and update Unit 1 active wrong word count", () => {
  const storage = createMemoryStorage();
  const unit = getUnitById(vocabulary, "g3b-u1");
  const progress = recordWrongWord(createInitialProgress(), {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt: "2026-05-07T10:30:00.000Z",
  });

  saveProgress(progress, storage);
  const loaded = loadProgress(storage);
  const summary = summarizeUnitProgress(unit, loaded);
  const html = renderUnitsView({ vocabulary, progress: loaded });

  assert.equal(summary.wrongWords, 1);
  assert.equal(loaded.wrongWords["g3b-u1-a-001"].wrongCount, 1);
  assert.match(html, /当前错词 1 个/);
});

test("active wrong words include only Unit 1 unmastered words", () => {
  const progress = {
    ...createInitialProgress(),
    wrongWords: {
      "g3b-u1-a-001": {
        wordId: "g3b-u1-a-001",
        unitId: "g3b-u1",
        levelId: "g3b-u1-main-1",
        wrongCount: 1,
        mastered: false,
        lastWrongAt: "2026-05-07T10:00:00.000Z",
      },
      "g3b-u1-a-002": {
        wordId: "g3b-u1-a-002",
        unitId: "g3b-u1",
        levelId: "g3b-u1-main-1",
        wrongCount: 1,
        mastered: true,
        lastWrongAt: "2026-05-07T10:00:00.000Z",
      },
      "g3b-u2-a-001": {
        wordId: "g3b-u2-a-001",
        unitId: "g3b-u2",
        levelId: "g3b-u2-main-1",
        wrongCount: 1,
        mastered: false,
        lastWrongAt: "2026-05-07T10:00:00.000Z",
      },
    },
  };

  assert.deepEqual(getActiveWrongWordsForUnit(progress, "g3b-u1").map((entry) => entry.wordId), ["g3b-u1-a-001"]);
});

test("review questions cover each active wrong word with practice-style question types", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const wrongWordIds = ["g3b-u1-a-001", "g3b-u1-a-002"];
  const questions = buildReviewQuestions({ unit, wrongWordIds, random: () => 0.5 });

  assert.equal(questions.length, 2);
  assert.deepEqual(
    questions.map((question) => question.correctWord.id).sort(),
    wrongWordIds,
  );
  assert.deepEqual(
    new Set(questions.map((question) => question.type)),
    new Set(["word-to-meaning", "audio-to-meaning"]),
  );
  assert.ok(questions.every((question) => question.options.length === 4));
});

test("review progress can mark wrong words mastered and complete Unit review", () => {
  const lastWrongAt = "2026-05-07T10:00:00.000Z";
  const reviewedAt = "2026-05-07T11:00:00.000Z";
  const progress = recordWrongWord(createInitialProgress(), {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt,
  });
  const mastered = markWrongWordMastered(progress, "g3b-u1-a-001");
  const completed = completeUnitReview(mastered, {
    unitId: "g3b-u1",
    completedAt: reviewedAt,
  });

  assert.equal(mastered.wrongWords["g3b-u1-a-001"].mastered, true);
  assert.deepEqual(completed.completedReviews["g3b-u1"], { completedAt: reviewedAt });
});

test("Unit status becomes main complete after all main levels and Unit review are complete", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const completedAt = "2026-05-07T10:00:00.000Z";
  const progress = getLevelsByType(unit, "main").reduce(
    (current, level) => completeMainLevel(current, { levelId: level.id, stars: 3, completedAt }),
    createInitialProgress(),
  );
  const reviewed = completeUnitReview(progress, {
    unitId: "g3b-u1",
    completedAt: "2026-05-07T11:00:00.000Z",
  });

  assert.equal(calculateUnitStatus(unit, reviewed), "主线完成");
});

test("upper Unit without extra levels can unlock its badge without becoming fully mastered", () => {
  const unit = getUnitById(vocabulary, "g3a-u1");
  const completedAt = "2026-05-08T12:00:00.000Z";
  const mainDone = getLevelsByType(unit, "main").reduce(
    (current, level) => completeMainLevel(current, { levelId: level.id, stars: 3, completedAt }),
    createInitialProgress(),
  );
  const reviewed = completeUnitReview(mainDone, { unitId: "g3a-u1", completedAt });
  const unlocked = unlockBadgeIfEligible(unit, reviewed, { unlockedAt: completedAt });

  assert.deepEqual(unlocked.unlockedBadges["badge-g3a-u1"], { unlockedAt: completedAt });
  assert.equal(calculateUnitStatus(unit, unlocked), "主线完成");
});

test("review views render active review, empty state, and completion state", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const [question] = buildReviewQuestions({
    unit,
    wrongWordIds: ["g3b-u1-a-001"],
    random: () => 0.5,
  });
  const activeHtml = renderReviewStageView({
    unit,
    question,
    questionIndex: 0,
    totalQuestions: 1,
    feedback: null,
  });
  const emptyHtml = renderReviewEmptyView({ unit });
  const completeHtml = renderReviewCompleteView({ unit, masteredCount: 1, remainingCount: 0 });

  assert.match(activeHtml, /错词复习/);
  assert.equal([...activeHtml.matchAll(/data-answer-word-id=/g)].length, 4);
  assert.match(emptyHtml, /当前没有需要复习的错词/);
  assert.match(completeHtml, /错词复习完成/);
});

test("review answer buttons use the shared quiz answer contract", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const [question] = buildReviewQuestions({
    unit,
    wrongWordIds: ["g3b-u1-a-001"],
    random: () => 0.5,
  });
  const html = renderReviewStageView({
    unit,
    question,
    questionIndex: 0,
    totalQuestions: 1,
    feedback: null,
  });

  assert.match(html, /data-answer-word-id="g3b-u1-a-001"/);
});

test("extra challenge questions use Unit 1 extra levels and fill options from Unit 1 when needed", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const level = getLevelById(vocabulary, "g3b-u1-extra-5");
  const questions = buildChallengeQuestions({ unit, level, random: () => 0.5 });

  assert.equal(questions.length, level.words.length);
  assert.deepEqual(
    questions.map((question) => question.correctWord.id).sort(),
    level.words.map((word) => word.id).sort(),
  );
  for (const question of questions) {
    assert.equal(question.options.length, 4);
    assert.ok(question.options.some((option) => option.id === question.correctWord.id));
  }
});

test("extra level completion stores special stars separately from main levels", () => {
  const completedAt = "2026-05-07T12:00:00.000Z";
  const progress = completeExtraLevel(createInitialProgress(), {
    levelId: "g3b-u1-extra-1",
    specialStars: 3,
    completedAt,
  });

  assert.deepEqual(progress.completedExtraLevels["g3b-u1-extra-1"], {
    specialStars: 3,
    completedAt,
  });
  assert.deepEqual(progress.completedLevels, {});
});

test("Unit 1 badge unlocks only after main levels, review, and all extra levels are complete", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const completedAt = "2026-05-07T12:00:00.000Z";
  const mainDone = getLevelsByType(unit, "main").reduce(
    (current, level) => completeMainLevel(current, { levelId: level.id, stars: 3, completedAt }),
    createInitialProgress(),
  );
  const reviewed = completeUnitReview(mainDone, { unitId: "g3b-u1", completedAt });
  const extraDone = getLevelsByType(unit, "extra").reduce(
    (current, level) => completeExtraLevel(current, { levelId: level.id, specialStars: 3, completedAt }),
    reviewed,
  );
  const unlocked = unlockBadgeIfEligible(unit, extraDone, { unlockedAt: completedAt });

  assert.deepEqual(unlocked.unlockedBadges["badge-g3b-u1"], { unlockedAt: completedAt });
  assert.equal(calculateUnitStatus(unit, unlocked), "完全掌握");
});

test("Unit 1 level list displays extra challenge status and badge name", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const progress = completeExtraLevel(createInitialProgress(), {
    levelId: "g3b-u1-extra-1",
    specialStars: 2,
    completedAt: "2026-05-07T12:00:00.000Z",
  });
  const html = renderLevelListView({ unit, progress });

  for (const levelId of ["g3b-u1-extra-1", "g3b-u1-extra-2", "g3b-u1-extra-3", "g3b-u1-extra-4", "g3b-u1-extra-5"]) {
    assert.match(html, new RegExp(`data-level-id="${levelId}"`));
  }
  assert.match(html, /额外挑战/);
  assert.match(html, /2 特殊星/);
  assert.match(html, /动物朋友达人/);
});

test("Unit 2 level list uses generic Unit labels and exposes the complete flow", () => {
  const unit = getUnitById(vocabulary, "g3b-u2");
  const html = renderLevelListView({ unit, progress: createInitialProgress() });

  assert.match(html, /选择 Unit 2 主线关卡/);
  assert.match(html, /data-route="learning"/);
  assert.match(html, /data-route="review"/);
  assert.match(html, /data-route="parent"/);
  assert.match(html, /data-route="extra-challenge"/);
  assert.match(html, /衣服达人/);
  assert.doesNotMatch(html, /Unit 1/);
});

test("home and Unit 1 pages expose the parent panel entry", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const progress = createInitialProgress();
  const homeHtml = renderHomeView({ vocabulary, progress });
  const unitHtml = renderLevelListView({ unit, progress });

  assert.match(homeHtml, /data-route="parent"/);
  assert.match(homeHtml, /家长面板/);
  assert.match(unitHtml, /data-route="parent"/);
  assert.match(unitHtml, /家长面板/);
});

test("parent stats summarize Unit 1 progress for the parent panel", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const completedAt = "2026-05-07T13:00:00.000Z";
  let progress = createInitialProgress();
  progress = completeMainLevel(progress, { levelId: "g3b-u1-main-1", stars: 3, completedAt });
  progress = completeMainLevel(progress, { levelId: "g3b-u1-main-2", stars: 2, completedAt });
  progress = completeExtraLevel(progress, { levelId: "g3b-u1-extra-1", specialStars: 3, completedAt });
  progress = recordWrongWord(progress, {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt: completedAt,
  });
  progress = recordWrongWord(progress, {
    wordId: "g3b-u1-a-002",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt: completedAt,
  });
  progress = markWrongWordMastered(progress, "g3b-u1-a-002");

  const stats = getParentUnitStats(unit, progress);

  assert.equal(stats.status, "学习中");
  assert.equal(stats.completedMainLevels, 2);
  assert.equal(stats.totalMainLevels, 4);
  assert.equal(stats.completedExtraLevels, 1);
  assert.equal(stats.totalExtraLevels, 5);
  assert.equal(stats.completedLevelCount, 3);
  assert.equal(stats.learnedWordCount, 15);
  assert.equal(stats.activeWrongWordCount, 1);
  assert.equal(stats.masteredWrongWordCount, 1);
  assert.equal(stats.badgeUnlocked, false);
});

test("parent stats summarize Unit 2 progress with the same flow", () => {
  const unit = getUnitById(vocabulary, "g3b-u2");
  const completedAt = "2026-05-08T10:00:00.000Z";
  let progress = createInitialProgress();
  const [firstMain, secondMain] = getLevelsByType(unit, "main");
  const [firstExtra] = getLevelsByType(unit, "extra");
  progress = completeMainLevel(progress, { levelId: firstMain.id, stars: 3, completedAt });
  progress = completeMainLevel(progress, { levelId: secondMain.id, stars: 2, completedAt });
  progress = completeExtraLevel(progress, { levelId: firstExtra.id, specialStars: 3, completedAt });
  progress = recordWrongWord(progress, {
    wordId: firstMain.words[0].id,
    unitId: "g3b-u2",
    levelId: firstMain.id,
    lastWrongAt: completedAt,
  });

  const stats = getParentUnitStats(unit, progress);
  const html = renderParentView({ unit, progress });

  assert.equal(stats.status, "学习中");
  assert.equal(stats.completedMainLevels, 2);
  assert.equal(stats.totalMainLevels, 4);
  assert.equal(stats.completedExtraLevels, 1);
  assert.equal(stats.totalExtraLevels, 3);
  assert.equal(stats.completedLevelCount, 3);
  assert.equal(stats.learnedWordCount, 15);
  assert.match(html, /Unit 2/);
  assert.match(html, /衣服达人/);
  assert.match(html, new RegExp(firstMain.id));
  assert.match(html, new RegExp(firstMain.words[0].word));
  assert.match(html, /返回 Unit 2/);
  assert.doesNotMatch(html, /这里显示 Unit 1/);
});

test("parent panel renders Unit 1 stats, level details, wrong words, and reset action", () => {
  const unit = getUnitById(vocabulary, "g3b-u1");
  const completedAt = "2026-05-07T13:00:00.000Z";
  let progress = createInitialProgress();
  progress = completeMainLevel(progress, { levelId: "g3b-u1-main-1", stars: 3, completedAt });
  progress = completeExtraLevel(progress, { levelId: "g3b-u1-extra-1", specialStars: 2, completedAt });
  progress = recordWrongWord(progress, {
    wordId: "g3b-u1-a-001",
    unitId: "g3b-u1",
    levelId: "g3b-u1-main-1",
    lastWrongAt: completedAt,
  });

  const html = renderParentView({ unit, progress });

  assert.match(html, /家长面板/);
  assert.match(html, /Unit 状态/);
  assert.match(html, /学习中/);
  assert.match(html, /主线关卡完成数/);
  assert.match(html, /1\/4/);
  assert.match(html, /额外挑战完成数/);
  assert.match(html, /1\/5/);
  assert.match(html, /已完成关卡数/);
  assert.match(html, /已学单词数/);
  assert.match(html, /当前未掌握错词数/);
  assert.match(html, /动物朋友达人/);
  assert.match(html, /g3b-u1-main-1/);
  assert.match(html, /3 星/);
  assert.match(html, /g3b-u1-extra-1/);
  assert.match(html, /2 特殊星/);
  assert.match(html, /animal/);
  assert.match(html, /动物/);
  assert.match(html, /wrongCount 1/);
  assert.match(html, /未掌握/);
  assert.match(html, /data-reset-progress/);
});

test("reset progress clears the saved localStorage progress key", () => {
  const storage = createMemoryStorage();
  const progress = completeMainLevel(createInitialProgress(), {
    levelId: "g3b-u1-main-1",
    stars: 3,
    completedAt: "2026-05-07T13:20:00.000Z",
  });

  saveProgress(progress, storage);
  const reset = resetProgress(storage);

  assert.equal(storage.getItem(PROGRESS_STORAGE_KEY), null);
  assert.deepEqual(reset, createInitialProgress());
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
