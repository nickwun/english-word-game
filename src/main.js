import {
  buildChallengeQuestions,
  buildPracticeQuestions,
  buildReviewQuestions,
  calculateChallengeStars,
  checkAnswer,
} from "./core/game.js?v=26";
import {
  buildSpellingQuestions,
  calculateSpellingStars,
  checkSpellingAnswer,
} from "./core/spelling.js?v=26";
import {
  completeExtraLevel,
  completeMainLevel,
  completeSpellingChallenge,
  completeUnitReview,
  getActiveWrongWordsForUnit,
  loadProgress,
  markWrongWordMastered,
  recordWrongWord,
  recordSpellingMistake,
  resetProgress,
  saveProgress,
  summarizeUnitProgress,
  unlockBadgeIfEligible,
} from "./core/progress.js?v=26";
import { playWordAudio } from "./core/speech.js?v=26";
import { getAllWords, getLevelById, getUnitById } from "./core/vocabulary.js?v=26";
import { renderHomeView } from "./views/homeView.js?v=26";
import {
  renderLearningStageView,
  renderLevelListView,
  renderChallengeCompleteView,
  renderChallengeStageView,
  renderExtraChallengeCompleteView,
  renderExtraChallengeStageView,
  renderPracticeCompleteView,
  renderPracticeStageView,
  renderSpellingCompleteView,
  renderSpellingStageView,
} from "./views/levelView.js?v=26";
import {
  renderReviewCompleteView,
  renderReviewEmptyView,
  renderReviewStageView,
} from "./views/reviewView.js?v=26";
import { renderParentView } from "./views/parentView.js?v=26";
import { renderUnitsView } from "./views/unitsView.js?v=26";

const app = document.querySelector("#app");
const state = {
  vocabulary: null,
  progress: loadProgress(),
  route: "home",
  selectedUnitId: "g3b-u1",
  selectedLevelId: null,
  selectedSpellingLevelId: null,
  quiz: {
    questions: [],
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    finalWrongWordIds: new Set(),
  },
  challengeResult: null,
  reviewResult: null,
  extraResult: null,
  spelling: {
    questions: [],
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    builtAnswer: "",
    selectedLetterIndices: [],
    finalMistakeWordIds: new Set(),
  },
  spellingResult: null,
};

async function startApp() {
  try {
    const response = await fetch("./src/data/vocabulary.json?v=26", {
      cache: "no-store",
    });
    state.vocabulary = await response.json();
    bindNavigation();
    render();
  } catch {
    app.innerHTML = `
      <section class="empty-state">
        <h1>词库加载失败</h1>
        <p>请通过本地服务器打开页面，不要直接双击 HTML 文件。</p>
      </section>
    `;
  }
}

function bindNavigation() {
  document.body.addEventListener("submit", (event) => {
    if (!event.target.closest("[data-spelling-form]")) {
      return;
    }

    event.preventDefault();
    checkCurrentSpellingAnswer();
  });

  document.body.addEventListener("focusin", (event) => {
    const spellingInput = event.target.closest("[data-spelling-input]");

    if (!spellingInput) {
      return;
    }

    window.setTimeout(() => {
      spellingInput.closest("[data-spelling-form]")?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }, 120);
  });

  document.body.addEventListener("keydown", (event) => {
    const spellingInput = event.target.closest("[data-spelling-input]");

    if (!spellingInput || !["Enter", "Return"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    checkCurrentSpellingAnswer();
  });

  document.body.addEventListener("click", (event) => {
    const resetButton = event.target.closest("[data-reset-progress]");
    if (resetButton) {
      resetSavedProgress();
      return;
    }

    const answerButton = event.target.closest("[data-answer-word-id]");
    if (answerButton) {
      handleQuizAnswer(answerButton.dataset.answerWordId);
      return;
    }

    const nextPracticeButton = event.target.closest("[data-practice-next]");
    if (nextPracticeButton) {
      goToNextQuizQuestion("practice-complete");
      return;
    }

    const nextChallengeButton = event.target.closest("[data-challenge-next]");
    if (nextChallengeButton) {
      goToNextQuizQuestion("challenge-complete");
      return;
    }

    const nextReviewButton = event.target.closest("[data-review-next]");
    if (nextReviewButton) {
      goToNextQuizQuestion("review-complete");
      return;
    }

    const nextExtraChallengeButton = event.target.closest("[data-extra-challenge-next]");
    if (nextExtraChallengeButton) {
      goToNextQuizQuestion("extra-challenge-complete");
      return;
    }

    const spellingLetterButton = event.target.closest("[data-spelling-letter]");
    if (spellingLetterButton) {
      appendSpellingLetter(spellingLetterButton.dataset.spellingLetter, spellingLetterButton.dataset.spellingLetterIndex);
      return;
    }

    const spellingClearButton = event.target.closest("[data-spelling-clear]");
    if (spellingClearButton) {
      clearSpellingAnswer();
      return;
    }

    const spellingCheckButton = event.target.closest("[data-spelling-check]");
    if (spellingCheckButton) {
      event.preventDefault();
      checkCurrentSpellingAnswer();
      return;
    }

    const spellingNextButton = event.target.closest("[data-spelling-next]");
    if (spellingNextButton) {
      goToNextSpellingQuestion();
      return;
    }

    const speakButton = event.target.closest("[data-speak-word-id]");
    if (speakButton) {
      playWordAudio(findWordItemById(speakButton.dataset.speakWordId));
      return;
    }

    const routeButton = event.target.closest("[data-route]");
    if (!routeButton) {
      return;
    }

    state.route = routeButton.dataset.route;
    state.selectedUnitId = routeButton.dataset.unitId ?? state.selectedUnitId;
    state.selectedLevelId = routeButton.dataset.levelId ?? state.selectedLevelId;
    state.selectedSpellingLevelId = routeButton.dataset.spellingLevelId ?? state.selectedSpellingLevelId;

    if (state.route === "practice") {
      startPracticeStage();
    }

    if (state.route === "challenge") {
      startChallengeStage();
    }

    if (state.route === "review") {
      startReviewStage();
    }

    if (state.route === "extra-challenge") {
      startExtraChallengeStage();
    }

    if (state.route === "spelling") {
      startSpellingStage();
    }

    render();
  });
}

function resetSavedProgress() {
  const confirmed = window.confirm("确认要重置所有学习进度吗？这个操作不能撤销。");

  if (!confirmed) {
    return;
  }

  state.progress = resetProgress();
  state.route = "home";
  state.selectedUnitId = "g3b-u1";
  state.selectedLevelId = null;
  state.selectedSpellingLevelId = null;
  state.challengeResult = null;
  state.reviewResult = null;
  state.extraResult = null;
  state.spellingResult = null;
  state.quiz = {
    questions: [],
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    finalWrongWordIds: new Set(),
  };
  state.spelling = {
    questions: [],
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    builtAnswer: "",
    selectedLetterIndices: [],
    finalMistakeWordIds: new Set(),
  };
  render();
}

function findWordItemById(wordId) {
  const vocabularyWord = getAllWords(state.vocabulary).find((word) => word.id === wordId);

  if (vocabularyWord) {
    return vocabularyWord;
  }

  return state.spelling.questions.map((question) => question.correctWord).find((word) => word.id === wordId);
}

function startPracticeStage() {
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);
  const level = getLevelById(state.vocabulary, state.selectedLevelId);

  state.quiz = {
    questions: buildPracticeQuestions({ unit, level }),
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    finalWrongWordIds: new Set(),
  };
}

function startChallengeStage() {
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);
  const level = getLevelById(state.vocabulary, state.selectedLevelId);

  state.quiz = {
    questions: buildChallengeQuestions({ unit, level }),
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    finalWrongWordIds: new Set(),
  };
  state.challengeResult = null;
}

function startExtraChallengeStage() {
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);
  const level = getLevelById(state.vocabulary, state.selectedLevelId);

  state.quiz = {
    questions: buildChallengeQuestions({ unit, level }),
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    finalWrongWordIds: new Set(),
  };
  state.extraResult = null;
}

function startReviewStage() {
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);
  const activeWrongWords = getActiveWrongWordsForUnit(state.progress, state.selectedUnitId);

  state.reviewResult = null;

  if (activeWrongWords.length === 0) {
    maybeCompleteReviewWhenReady(unit);
    state.route = "review-empty";
    return;
  }

  state.quiz = {
    questions: buildReviewQuestions({
      unit,
      wrongWordIds: activeWrongWords.map((entry) => entry.wordId),
    }),
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    finalWrongWordIds: new Set(),
  };
}

function startSpellingStage() {
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);
  const spellingLevel = getSelectedSpellingLevel(unit);

  state.spelling = {
    questions: buildSpellingQuestions({ unit, spellingLevel }),
    questionIndex: 0,
    attemptCount: 0,
    feedback: null,
    builtAnswer: "",
    selectedLetterIndices: [],
    finalMistakeWordIds: new Set(),
  };
  state.spellingResult = null;
}

function handleQuizAnswer(selectedWordId) {
  if (
    !["practice", "challenge", "review", "extra-challenge"].includes(state.route) ||
    state.quiz.feedback?.lockAnswers
  ) {
    return;
  }

  const question = state.quiz.questions[state.quiz.questionIndex];
  const isCorrect = checkAnswer(question, selectedWordId);

  if (isCorrect) {
    playWordAudio(question.correctWord);
    if (state.route === "review") {
      state.progress = markWrongWordMastered(state.progress, question.correctWord.id);
      saveProgress(state.progress);
    }
    state.quiz.feedback = {
      type: "correct",
      lockAnswers: true,
      showNext: true,
    };
    render();
    return;
  }

  if (state.quiz.attemptCount === 0) {
    state.quiz.attemptCount = 1;
    playWordAudio(question.correctWord);
    state.quiz.feedback = {
      type: "retry",
      lockAnswers: false,
      showNext: false,
    };
    render();
    return;
  }

  playWordAudio(question.correctWord);
  if (state.route === "challenge" || state.route === "extra-challenge") {
    state.quiz.finalWrongWordIds.add(question.correctWord.id);
  }
  state.quiz.feedback = {
    type: "answer",
    lockAnswers: true,
    showNext: true,
  };
  render();
}

function appendSpellingLetter(letter, letterIndex) {
  if (state.route !== "spelling" || state.spelling.feedback?.lockAnswers) {
    return;
  }

  const parsedIndex = Number(letterIndex);
  if (state.spelling.selectedLetterIndices.includes(parsedIndex)) {
    return;
  }

  state.spelling.builtAnswer = `${state.spelling.builtAnswer}${letter}`;
  state.spelling.selectedLetterIndices = [...state.spelling.selectedLetterIndices, parsedIndex];
  render();
}

function clearSpellingAnswer() {
  if (state.route !== "spelling" || state.spelling.feedback?.lockAnswers) {
    return;
  }

  state.spelling.builtAnswer = "";
  state.spelling.selectedLetterIndices = [];
  render();
}

function checkCurrentSpellingAnswer() {
  if (state.route !== "spelling" || state.spelling.feedback?.lockAnswers) {
    return;
  }

  const question = state.spelling.questions[state.spelling.questionIndex];
  const typedAnswer = document.querySelector("[data-spelling-input]")?.value ?? state.spelling.builtAnswer;
  const isCorrect = checkSpellingAnswer(question, typedAnswer);

  if (isCorrect) {
    playWordAudio(question.correctWord);
    state.spelling.feedback = {
      type: "correct",
      lockAnswers: true,
      showNext: true,
    };
    render();
    return;
  }

  if (state.spelling.attemptCount === 0) {
    state.spelling.attemptCount = 1;
    state.spelling.feedback = {
      type: "retry",
      lockAnswers: false,
      showNext: false,
    };
    render();
    return;
  }

  state.spelling.finalMistakeWordIds.add(question.correctWord.id);
  state.progress = recordSpellingMistake(state.progress, {
    wordId: question.correctWord.id,
    unitId: state.selectedUnitId,
    challengeId: state.selectedSpellingLevelId,
  });
  saveProgress(state.progress);
  state.spelling.feedback = {
    type: "answer",
    lockAnswers: true,
    showNext: true,
  };
  render();
}

function goToNextSpellingQuestion() {
  const nextIndex = state.spelling.questionIndex + 1;

  if (nextIndex >= state.spelling.questions.length) {
    completeSpellingStage();
    state.route = "spelling-complete";
    render();
    return;
  }

  state.spelling.questionIndex = nextIndex;
  state.spelling.attemptCount = 0;
  state.spelling.feedback = null;
  state.spelling.builtAnswer = "";
  state.spelling.selectedLetterIndices = [];
  render();
}

function goToNextQuizQuestion(completionRoute) {
  const nextIndex = state.quiz.questionIndex + 1;

  if (nextIndex >= state.quiz.questions.length) {
    if (completionRoute === "challenge-complete") {
      completeChallengeStage();
    }

    if (completionRoute === "review-complete") {
      completeReviewStage();
    }

    if (completionRoute === "extra-challenge-complete") {
      completeExtraChallengeStage();
    }

    state.route = completionRoute;
    render();
    return;
  }

  state.quiz.questionIndex = nextIndex;
  state.quiz.attemptCount = 0;
  state.quiz.feedback = null;
  render();
}

function completeChallengeStage() {
  const finalWrongWordCount = state.quiz.finalWrongWordIds.size;
  const stars = calculateChallengeStars(finalWrongWordCount);

  state.progress = completeMainLevel(state.progress, {
    levelId: state.selectedLevelId,
    stars,
  });
  const lastWrongAt = new Date().toISOString();
  for (const wordId of state.quiz.finalWrongWordIds) {
    state.progress = recordWrongWord(state.progress, {
      wordId,
      unitId: state.selectedUnitId,
      levelId: state.selectedLevelId,
      lastWrongAt,
    });
  }
  saveProgress(state.progress);
  state.challengeResult = {
    stars,
    finalWrongWordCount,
  };
}

function completeExtraChallengeStage() {
  const finalWrongWordCount = state.quiz.finalWrongWordIds.size;
  const specialStars = calculateChallengeStars(finalWrongWordCount);
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);

  state.progress = completeExtraLevel(state.progress, {
    levelId: state.selectedLevelId,
    specialStars,
  });
  const beforeBadgeUnlocked = Boolean(state.progress.unlockedBadges[unit.badge.id]);
  state.progress = unlockBadgeIfEligible(unit, state.progress);
  saveProgress(state.progress);
  const badgeUnlocked = !beforeBadgeUnlocked && Boolean(state.progress.unlockedBadges[unit.badge.id]);

  state.extraResult = {
    specialStars,
    badgeUnlocked,
    badgeName: unit.badge.name,
  };
}

function completeReviewStage() {
  const remainingCount = getActiveWrongWordsForUnit(state.progress, state.selectedUnitId).length;
  const masteredCount = state.quiz.questions.length - remainingCount;
  const unit = getUnitById(state.vocabulary, state.selectedUnitId);

  if (remainingCount === 0) {
    state.progress = completeUnitReview(state.progress, {
      unitId: state.selectedUnitId,
    });
    state.progress = unlockBadgeIfEligible(unit, state.progress);
    saveProgress(state.progress);
  }

  state.reviewResult = {
    masteredCount,
    remainingCount,
    unit,
  };
}

function completeSpellingStage() {
  const finalMistakeCount = state.spelling.finalMistakeWordIds.size;
  const stars = calculateSpellingStars(finalMistakeCount);

  state.progress = completeSpellingChallenge(state.progress, {
    challengeId: state.selectedSpellingLevelId,
    stars,
  });
  saveProgress(state.progress);
  state.spellingResult = {
    stars,
    finalMistakeCount,
  };
}

function getSelectedSpellingLevel(unit) {
  return unit?.spellingChallenge?.levels?.find((level) => level.id === state.selectedSpellingLevelId);
}

function maybeCompleteReviewWhenReady(unit) {
  const summary = summarizeUnitProgress(unit, state.progress);

  if (summary.completedMainLevels === summary.totalMainLevels) {
    state.progress = completeUnitReview(state.progress, {
      unitId: unit.id,
    });
    state.progress = unlockBadgeIfEligible(unit, state.progress);
    saveProgress(state.progress);
  }
}

function render() {
  const viewState = {
    vocabulary: state.vocabulary,
    progress: state.progress,
  };

  if (state.route === "units") {
    app.innerHTML = renderUnitsView(viewState);
  } else if (state.route === "unit-detail") {
    app.innerHTML = renderLevelListView({
      unit: getUnitById(state.vocabulary, state.selectedUnitId),
      progress: state.progress,
    });
  } else if (state.route === "learning") {
    app.innerHTML = renderLearningStageView({
      level: getLevelById(state.vocabulary, state.selectedLevelId),
    });
  } else if (state.route === "practice") {
    const level = getLevelById(state.vocabulary, state.selectedLevelId);
    app.innerHTML = renderPracticeStageView({
      level,
      question: state.quiz.questions[state.quiz.questionIndex],
      questionIndex: state.quiz.questionIndex,
      totalQuestions: state.quiz.questions.length,
      feedback: state.quiz.feedback,
    });
  } else if (state.route === "practice-complete") {
    app.innerHTML = renderPracticeCompleteView({
      level: getLevelById(state.vocabulary, state.selectedLevelId),
    });
  } else if (state.route === "challenge") {
    const level = getLevelById(state.vocabulary, state.selectedLevelId);
    app.innerHTML = renderChallengeStageView({
      level,
      question: state.quiz.questions[state.quiz.questionIndex],
      questionIndex: state.quiz.questionIndex,
      totalQuestions: state.quiz.questions.length,
      feedback: state.quiz.feedback,
    });
  } else if (state.route === "extra-challenge") {
    const level = getLevelById(state.vocabulary, state.selectedLevelId);
    app.innerHTML = renderExtraChallengeStageView({
      level,
      question: state.quiz.questions[state.quiz.questionIndex],
      questionIndex: state.quiz.questionIndex,
      totalQuestions: state.quiz.questions.length,
      feedback: state.quiz.feedback,
    });
  } else if (state.route === "spelling") {
    const unit = getUnitById(state.vocabulary, state.selectedUnitId);
    app.innerHTML = renderSpellingStageView({
      unit,
      spellingLevel: getSelectedSpellingLevel(unit),
      question: state.spelling.questions[state.spelling.questionIndex],
      questionIndex: state.spelling.questionIndex,
      totalQuestions: state.spelling.questions.length,
      feedback: state.spelling.feedback,
      builtAnswer: state.spelling.builtAnswer,
      selectedLetterIndices: state.spelling.selectedLetterIndices,
    });
  } else if (state.route === "challenge-complete") {
    app.innerHTML = renderChallengeCompleteView({
      level: getLevelById(state.vocabulary, state.selectedLevelId),
      stars: state.challengeResult?.stars ?? 1,
      wrongWordCount: state.challengeResult?.finalWrongWordCount ?? 0,
    });
  } else if (state.route === "extra-challenge-complete") {
    const level = getLevelById(state.vocabulary, state.selectedLevelId);
    app.innerHTML = renderExtraChallengeCompleteView({
      level,
      specialStars: state.extraResult?.specialStars ?? 1,
      badgeName: state.extraResult?.badgeName ?? "动物朋友达人",
      badgeUnlocked: Boolean(state.extraResult?.badgeUnlocked),
    });
  } else if (state.route === "spelling-complete") {
    const unit = getUnitById(state.vocabulary, state.selectedUnitId);
    app.innerHTML = renderSpellingCompleteView({
      unit,
      spellingLevel: getSelectedSpellingLevel(unit),
      stars: state.spellingResult?.stars ?? 1,
      finalMistakeCount: state.spellingResult?.finalMistakeCount ?? 0,
    });
  } else if (state.route === "review") {
    const unit = getUnitById(state.vocabulary, state.selectedUnitId);
    app.innerHTML = renderReviewStageView({
      unit,
      question: state.quiz.questions[state.quiz.questionIndex],
      questionIndex: state.quiz.questionIndex,
      totalQuestions: state.quiz.questions.length,
      feedback: state.quiz.feedback,
    });
  } else if (state.route === "review-empty") {
    app.innerHTML = renderReviewEmptyView({
      unit: getUnitById(state.vocabulary, state.selectedUnitId),
    });
  } else if (state.route === "review-complete") {
    const unit = getUnitById(state.vocabulary, state.selectedUnitId);
    app.innerHTML = renderReviewCompleteView({
      unit,
      masteredCount: state.reviewResult?.masteredCount ?? 0,
      remainingCount: state.reviewResult?.remainingCount ?? 0,
    });
  } else if (state.route === "parent") {
    app.innerHTML = renderParentView({
      unit: getUnitById(state.vocabulary, state.selectedUnitId),
      progress: state.progress,
    });
  } else {
    app.innerHTML = renderHomeView(viewState);
  }

  app.focus();
}

startApp();
