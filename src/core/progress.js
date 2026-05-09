export const PROGRESS_STORAGE_KEY = "english-word-game-progress";

export function createInitialProgress() {
  return {
    completedLevels: {},
    completedExtraLevels: {},
    spellingProgress: {},
    spellingMistakes: {},
    wrongWords: {},
    completedReviews: {},
    unlockedBadges: {},
  };
}

export function loadProgress(storage = globalThis.localStorage) {
  if (!storage) {
    return createInitialProgress();
  }

  const saved = storage.getItem(PROGRESS_STORAGE_KEY);
  if (!saved) {
    return createInitialProgress();
  }

  try {
    return normalizeProgress(JSON.parse(saved));
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(progress, storage = globalThis.localStorage) {
  if (!storage) {
    return;
  }

  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(normalizeProgress(progress)));
}

export function resetProgress(storage = globalThis.localStorage) {
  if (storage) {
    storage.removeItem(PROGRESS_STORAGE_KEY);
  }

  return createInitialProgress();
}

export function completeMainLevel(progress, { levelId, stars, completedAt = new Date().toISOString() }) {
  const normalized = normalizeProgress(progress);

  return {
    ...normalized,
    completedLevels: {
      ...normalized.completedLevels,
      [levelId]: {
        stars,
        completedAt,
      },
    },
  };
}

export function completeExtraLevel(
  progress,
  { levelId, specialStars, completedAt = new Date().toISOString() },
) {
  const normalized = normalizeProgress(progress);

  return {
    ...normalized,
    completedExtraLevels: {
      ...normalized.completedExtraLevels,
      [levelId]: {
        specialStars,
        completedAt,
      },
    },
  };
}

export function completeSpellingChallenge(
  progress,
  { challengeId, stars, completedAt = new Date().toISOString() },
) {
  const normalized = normalizeProgress(progress);
  const previous = normalized.spellingProgress[challengeId];

  return {
    ...normalized,
    spellingProgress: {
      ...normalized.spellingProgress,
      [challengeId]: {
        stars,
        completedAt,
        attempts: (previous?.attempts ?? 0) + 1,
      },
    },
  };
}

export function unlockBadgeIfEligible(unit, progress, { unlockedAt = new Date().toISOString() } = {}) {
  const normalized = normalizeProgress(progress);
  const mainLevels = (unit?.levels ?? []).filter((level) => level.type === "main");
  const extraLevels = (unit?.levels ?? []).filter((level) => level.type === "extra");
  const allMainComplete = mainLevels.length > 0 && mainLevels.every((level) => normalized.completedLevels[level.id]);
  const reviewComplete = Boolean(normalized.completedReviews[unit?.id]);
  const allExtraComplete =
    extraLevels.length === 0 || extraLevels.every((level) => normalized.completedExtraLevels[level.id]);

  if (!allMainComplete || !reviewComplete || !allExtraComplete || !unit?.badge?.id) {
    return normalized;
  }

  return {
    ...normalized,
    unlockedBadges: {
      ...normalized.unlockedBadges,
      [unit.badge.id]: normalized.unlockedBadges[unit.badge.id] ?? {
        unlockedAt,
      },
    },
  };
}

export function recordWrongWord(
  progress,
  { wordId, unitId, levelId, lastWrongAt = new Date().toISOString() },
) {
  const normalized = normalizeProgress(progress);
  const previous = normalized.wrongWords[wordId];

  return {
    ...normalized,
    wrongWords: {
      ...normalized.wrongWords,
      [wordId]: {
        wordId,
        unitId,
        levelId,
        wrongCount: (previous?.wrongCount ?? 0) + 1,
        mastered: false,
        lastWrongAt,
      },
    },
  };
}

export function recordSpellingMistake(
  progress,
  { wordId, unitId, challengeId, lastMistakeAt = new Date().toISOString() },
) {
  const normalized = normalizeProgress(progress);
  const previous = normalized.spellingMistakes[wordId];

  return {
    ...normalized,
    spellingMistakes: {
      ...normalized.spellingMistakes,
      [wordId]: {
        wordId,
        unitId,
        challengeId,
        mistakeCount: (previous?.mistakeCount ?? 0) + 1,
        lastMistakeAt,
      },
    },
  };
}

export function getActiveWrongWordsForUnit(progress, unitId) {
  const normalized = normalizeProgress(progress);

  return Object.values(normalized.wrongWords).filter(
    (entry) => entry.unitId === unitId && !entry.mastered,
  );
}

export function markWrongWordMastered(progress, wordId) {
  const normalized = normalizeProgress(progress);
  const previous = normalized.wrongWords[wordId];

  if (!previous) {
    return normalized;
  }

  return {
    ...normalized,
    wrongWords: {
      ...normalized.wrongWords,
      [wordId]: {
        ...previous,
        mastered: true,
      },
    },
  };
}

export function completeUnitReview(progress, { unitId, completedAt = new Date().toISOString() }) {
  const normalized = normalizeProgress(progress);

  return {
    ...normalized,
    completedReviews: {
      ...normalized.completedReviews,
      [unitId]: {
        completedAt,
      },
    },
  };
}

export function getParentUnitStats(unit, progress) {
  const summary = getUnitCompletionSummary(unit, progress);
  const completedLevelIds = new Set([
    ...summary.mainLevels
      .filter((level) => summary.progress.completedLevels[level.id])
      .map((level) => level.id),
    ...summary.extraLevels
      .filter((level) => summary.progress.completedExtraLevels[level.id])
      .map((level) => level.id),
  ]);
  const learnedWordIds = new Set(
    (unit?.levels ?? [])
      .filter((level) => completedLevelIds.has(level.id))
      .flatMap((level) => level.words ?? [])
      .map((word) => word.id),
  );

  return {
    status: calculateUnitStatus(unit, progress),
    completedMainLevels: summary.completedMainLevels,
    totalMainLevels: summary.mainLevels.length,
    completedExtraLevels: summary.completedExtraLevels,
    totalExtraLevels: summary.extraLevels.length,
    completedSpellingChallenges: summary.completedSpellingChallenges,
    totalSpellingChallenges: summary.spellingLevels.length,
    spellingStars: summary.spellingStars,
    spellingMistakeCount: summary.spellingMistakes.length,
    completedLevelCount: completedLevelIds.size,
    learnedWordCount: learnedWordIds.size,
    activeWrongWordCount: summary.activeWrongWords.length,
    masteredWrongWordCount: summary.masteredWrongWords.length,
    badgeUnlocked: summary.badgeUnlocked,
  };
}

export function calculateUnitStatus(unit, progress) {
  const summary = getUnitCompletionSummary(unit, progress);

  if (summary.allMainComplete && summary.reviewComplete && summary.allExtraComplete && summary.badgeUnlocked) {
    return "完全掌握";
  }

  if (summary.allMainComplete && summary.reviewComplete) {
    return "主线完成";
  }

  if (summary.completedMainLevels > 0) {
    return "学习中";
  }

  return "未开始";
}

export function summarizeUnitProgress(unit, progress) {
  const summary = getUnitCompletionSummary(unit, progress);

  return {
    completedMainLevels: summary.completedMainLevels,
    totalMainLevels: summary.mainLevels.length,
    completedExtraLevels: summary.completedExtraLevels,
    totalExtraLevels: summary.extraLevels.length,
    totalStars: summary.totalStars,
    wrongWords: summary.activeWrongWords.length,
    badgeUnlocked: summary.badgeUnlocked,
    status: calculateUnitStatus(unit, progress),
  };
}

function normalizeProgress(progress) {
  return {
    ...createInitialProgress(),
    ...progress,
    completedLevels: progress?.completedLevels ?? {},
    completedExtraLevels: progress?.completedExtraLevels ?? {},
    spellingProgress: progress?.spellingProgress ?? {},
    spellingMistakes: progress?.spellingMistakes ?? {},
    wrongWords: progress?.wrongWords ?? {},
    completedReviews: progress?.completedReviews ?? {},
    unlockedBadges: progress?.unlockedBadges ?? {},
  };
}

function getUnitCompletionSummary(unit, rawProgress) {
  const progress = normalizeProgress(rawProgress);
  const levels = unit?.levels ?? [];
  const mainLevels = levels.filter((level) => level.type === "main");
  const extraLevels = levels.filter((level) => level.type === "extra");
  const spellingLevels = unit?.spellingChallenge?.levels ?? [];
  const completedMainLevels = mainLevels.filter((level) => progress.completedLevels[level.id]).length;
  const completedExtraLevels = extraLevels.filter((level) => progress.completedExtraLevels[level.id]).length;
  const completedSpellingChallenges = spellingLevels.filter((level) => progress.spellingProgress[level.id]).length;
  const activeWrongWords = Object.values(progress.wrongWords).filter(
    (entry) => entry.unitId === unit?.id && !entry.mastered,
  );
  const masteredWrongWords = Object.values(progress.wrongWords).filter(
    (entry) => entry.unitId === unit?.id && entry.mastered,
  );
  const totalStars = mainLevels.reduce(
    (sum, level) => sum + (progress.completedLevels[level.id]?.stars ?? 0),
    0,
  );
  const spellingStars = spellingLevels.reduce(
    (sum, level) => sum + (progress.spellingProgress[level.id]?.stars ?? 0),
    0,
  );
  const spellingMistakes = Object.values(progress.spellingMistakes).filter((entry) => entry.unitId === unit?.id);

  return {
    progress,
    mainLevels,
    extraLevels,
    spellingLevels,
    completedMainLevels,
    completedExtraLevels,
    completedSpellingChallenges,
    allMainComplete: mainLevels.length > 0 && completedMainLevels === mainLevels.length,
    allExtraComplete: extraLevels.length > 0 && completedExtraLevels === extraLevels.length,
    reviewComplete: Boolean(progress.completedReviews[unit?.id]),
    badgeUnlocked: Boolean(progress.unlockedBadges[unit?.badge?.id]),
    activeWrongWords,
    masteredWrongWords,
    totalStars,
    spellingStars,
    spellingMistakes,
  };
}
