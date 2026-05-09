export function buildSpellingQuestions({ unit, spellingLevel, random = Math.random }) {
  const wordById = new Map(getUnitWords(unit).map((word) => [word.id, word]));

  return (spellingLevel?.wordIds ?? [])
    .map((wordId, index) => {
      const word = wordById.get(wordId);

      if (!word) {
        return null;
      }

      return {
        id: `${spellingLevel.id}-${index + 1}`,
        type: spellingLevel.type,
        challengeId: spellingLevel.id,
        correctWord: word,
        letters: spellingLevel.type === "letter-order" ? shuffleLetters(word.word, random) : [],
      };
    })
    .filter(Boolean);
}

export function checkSpellingAnswer(question, answer) {
  return normalizeSpelling(answer) === normalizeSpelling(question?.correctWord?.word ?? "");
}

export function calculateSpellingStars(finalMistakeCount) {
  if (finalMistakeCount <= 0) {
    return 3;
  }

  if (finalMistakeCount <= 2) {
    return 2;
  }

  return 1;
}

function getUnitWords(unit) {
  return [
    ...(unit?.levels ?? []).flatMap((level) => level.words ?? []),
    ...(unit?.words ?? []),
  ];
}

function normalizeSpelling(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function shuffleLetters(word, random) {
  const letters = [...word.replace(/\s+/g, "")];
  const shuffled = [...letters];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (shuffled.join("") === letters.join("") && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}
