export const PRACTICE_QUESTION_TYPES = ["word-to-meaning", "audio-to-meaning"];
export const CHALLENGE_QUESTION_TYPES = [
  "word-to-meaning",
  "audio-to-meaning",
  "audio-to-image",
  "image-to-word",
];

export function buildPracticeQuestions({ unit, level, random = Math.random }) {
  return buildQuestions({
    unit,
    level,
    random,
    types: PRACTICE_QUESTION_TYPES,
    idPrefix: "practice",
  });
}

export function buildChallengeQuestions({ unit, level, random = Math.random }) {
  return buildQuestions({
    unit,
    level,
    random,
    types: CHALLENGE_QUESTION_TYPES,
    idPrefix: "challenge",
  });
}

export function buildReviewQuestions({ unit, wrongWordIds, random = Math.random }) {
  const unitWords = getUnitWords(unit);
  const reviewWords = wrongWordIds
    .map((wordId) => unitWords.find((word) => word.id === wordId))
    .filter(Boolean);
  const reviewLevel = {
    id: `${unit.id}-review`,
    words: reviewWords,
  };

  return reviewWords.map((word, index) => {
    const type = PRACTICE_QUESTION_TYPES[index % PRACTICE_QUESTION_TYPES.length];

    return {
      id: `${unit.id}-review-${index + 1}`,
      type,
      levelId: reviewLevel.id,
      correctWord: word,
      options: buildOptions({ correctWord: word, level: reviewLevel, unitWords, random }),
    };
  });
}

export function checkAnswer(question, selectedWordId) {
  return question?.correctWord?.id === selectedWordId;
}

export function calculateChallengeStars(finalWrongWordCount) {
  if (finalWrongWordCount <= 0) {
    return 3;
  }

  if (finalWrongWordCount <= 2) {
    return 2;
  }

  return 1;
}

function buildQuestions({ unit, level, random, types, idPrefix }) {
  const unitWords = getUnitWords(unit);

  return (level?.words ?? []).map((word, index) => {
    const type = types[index % types.length];

    return {
      id: `${level.id}-${idPrefix}-${index + 1}`,
      type,
      levelId: level.id,
      correctWord: word,
      options: buildOptions({ correctWord: word, level, unitWords, random }),
    };
  });
}

function buildOptions({ correctWord, level, unitWords, random }) {
  const distractors = collectDistractors({ correctWord, level, unitWords });
  const selectedDistractors = distractors.slice(0, 3);

  return shuffle([correctWord, ...selectedDistractors], random);
}

function collectDistractors({ correctWord, level, unitWords }) {
  const sameLevel = (level?.words ?? []).filter((word) => word.id !== correctWord.id);
  const sameTags = unitWords.filter(
    (word) =>
      word.id !== correctWord.id &&
      !sameLevel.some((sameLevelWord) => sameLevelWord.id === word.id) &&
      word.tags?.some((tag) => correctWord.tags?.includes(tag)),
  );
  const sameUnit = unitWords.filter(
    (word) =>
      word.id !== correctWord.id &&
      !sameLevel.some((sameLevelWord) => sameLevelWord.id === word.id) &&
      !sameTags.some((sameTagWord) => sameTagWord.id === word.id),
  );

  return [...sameLevel, ...sameTags, ...sameUnit];
}

function getUnitWords(unit) {
  return (unit?.levels ?? []).flatMap((level) => level.words ?? []);
}

function shuffle(items, random) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
