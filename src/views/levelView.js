import { getLevelsByType } from "../core/vocabulary.js?v=26";

export function renderLevelListView({ unit, progress }) {
  const mainLevels = getLevelsByType(unit, "main");
  const extraLevels = getLevelsByType(unit, "extra");
  const badgeUnlocked = Boolean(progress.unlockedBadges[unit.badge.id]);
  const unitLabel = getUnitLabel(unit);

  return `
    <section class="page-heading">
      <p class="eyebrow">${unit.displayTitle}</p>
      <h1>选择 ${unitLabel} 主线关卡</h1>
      <p class="page-copy">先进入学习卡片，再完成练习和挑战。</p>
    </section>

    <section class="main-level-grid" aria-label="${unitLabel} 主线关卡">
      ${mainLevels
        .map((level) => {
          const completed = progress.completedLevels[level.id];
          return `
            <article class="main-level-card">
              <div>
                <p class="unit-kicker">${level.id}</p>
                <h2>${level.displayTitle}</h2>
                <p>${level.words.length} 个单词</p>
              </div>
              <button class="primary-action compact" type="button" data-route="learning" data-level-id="${level.id}">
                开始学习
                <span>${completed ? `${completed.stars} 星` : "学习阶段"}</span>
              </button>
            </article>
          `;
        })
        .join("")}
    </section>

    <section class="stage-footer">
      <button class="secondary-action wide" type="button" data-route="review" data-unit-id="${unit.id}">
        错词复习
        <span>复习当前未掌握错词</span>
      </button>
      <button class="secondary-action wide" type="button" data-route="parent" data-unit-id="${unit.id}">
        家长面板
        <span>查看 ${unitLabel} 进度</span>
      </button>
    </section>

    ${renderSpellingChallengeSection({ unit, progress })}

    ${renderExtraLevelsSection({ extraLevels, progress, unit, unitLabel })}

    <section class="badge-panel" aria-label="${unitLabel} 徽章">
      <div>
        <p class="eyebrow">Unit 徽章</p>
        <h2>${unit.badge.name}</h2>
        <p>${unit.badge.description}</p>
      </div>
      <strong>${badgeUnlocked ? "已解锁" : "未解锁"}</strong>
    </section>
  `;
}

function renderSpellingChallengeSection({ unit, progress }) {
  if (!unit.spellingChallenge?.enabled) {
    return "";
  }

  return `
    <section class="page-heading spelling-heading">
      <p class="eyebrow">Spelling Challenge</p>
      <h1>${unit.spellingChallenge.title}</h1>
      <p class="page-copy">可选拼写挑战，不影响主线完成、星级和错词本。</p>
    </section>

    <section class="main-level-grid" aria-label="${unit.displayTitle} 拼写挑战">
      ${unit.spellingChallenge.levels
        .map((level) => {
          const completed = progress.spellingProgress?.[level.id];
          return `
            <article class="main-level-card">
              <div>
                <p class="unit-kicker">${level.id}</p>
                <h2>${level.title}</h2>
                <p>${level.wordIds.length} 个拼写词</p>
                ${level.description ? `<p>${level.description}</p>` : ""}
              </div>
              <button class="primary-action compact" type="button" data-route="spelling" data-unit-id="${unit.id}" data-spelling-level-id="${level.id}">
                开始拼写
                <span>${completed ? `${completed.stars} 拼写星` : "可选挑战"}</span>
              </button>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderExtraLevelsSection({ extraLevels, progress, unit, unitLabel }) {
  if (extraLevels.length === 0) {
    return `
      <section class="page-heading extra-heading">
        <p class="eyebrow">额外挑战</p>
        <h1>暂无额外挑战</h1>
        <p class="page-copy">当前 Unit 先完成主线学习和错词复习。</p>
      </section>
    `;
  }

  return `
    <section class="page-heading extra-heading">
      <p class="eyebrow">额外挑战</p>
      <h1>补充词挑战</h1>
      <p class="page-copy">完成所有额外挑战，并完成主线与错词复习后，可解锁 ${unit.badge.name}。</p>
    </section>

    <section class="main-level-grid" aria-label="${unitLabel} 额外挑战">
      ${extraLevels
        .map((level) => {
          const completed = progress.completedExtraLevels[level.id];
          return `
            <article class="main-level-card">
              <div>
                <p class="unit-kicker">${level.id}</p>
                <h2>${level.displayTitle}</h2>
                <p>${level.words.length} 个补充词</p>
              </div>
              <button class="primary-action compact" type="button" data-route="extra-challenge" data-level-id="${level.id}">
                开始额外挑战
                <span>${completed ? `${completed.specialStars} 特殊星` : "未完成"}</span>
              </button>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

export function renderLearningStageView({ level }) {
  return `
    <section class="page-heading">
      <p class="eyebrow">${level.id}</p>
      <h1>${level.displayTitle}</h1>
      <p class="page-copy">先看一看、听一听，把英文、中文和图像连起来。</p>
    </section>

    <section class="word-grid" aria-label="${level.displayTitle} 单词卡片">
      ${level.words.map((word) => renderWordCard(word)).join("")}
    </section>

    <section class="stage-footer">
      <button class="primary-action wide" type="button" data-route="practice" data-level-id="${level.id}">
        我学完了，进入练习
        <span>两种选择题</span>
      </button>
      <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${level.unitId}">
        返回关卡列表
      </button>
    </section>
  `;
}

export function renderPracticeStageView({ level, question, questionIndex, totalQuestions, feedback }) {
  return renderQuestionStageView({
    level,
    question,
    questionIndex,
    totalQuestions,
    feedback,
    title: "练习阶段",
    nextAction: "data-practice-next",
    completeLabel: "完成练习",
  });
}

export function renderChallengeStageView({ level, question, questionIndex, totalQuestions, feedback }) {
  return renderQuestionStageView({
    level,
    question,
    questionIndex,
    totalQuestions,
    feedback,
    title: "挑战阶段",
    nextAction: "data-challenge-next",
    completeLabel: "完成挑战",
  });
}

export function renderExtraChallengeStageView({ level, question, questionIndex, totalQuestions, feedback }) {
  return renderQuestionStageView({
    level,
    question,
    questionIndex,
    totalQuestions,
    feedback,
    title: "额外挑战",
    nextAction: "data-extra-challenge-next",
    completeLabel: "完成额外挑战",
  });
}

export function renderSpellingStageView({
  unit,
  spellingLevel,
  question,
  questionIndex,
  totalQuestions,
  feedback,
  builtAnswer,
  selectedLetterIndices = [],
}) {
  const isKeyboard = question.type.startsWith("keyboard-input");
  const unitLabel = getUnitLabel(unit);

  return `
    <section class="spelling-panel ${isKeyboard ? "is-keyboard-spelling" : ""}" aria-labelledby="spelling-title">
      <div class="practice-status">
        <p class="eyebrow">${spellingLevel.id}</p>
        <strong>第 ${questionIndex + 1} / ${totalQuestions} 题</strong>
      </div>
      <h1 id="spelling-title">${spellingLevel.title}</h1>
      ${spellingLevel.description ? `<p class="page-copy">${spellingLevel.description}</p>` : ""}
      <div class="question-card spelling-question-card">
        <p class="question-type">${isKeyboard ? "键盘输入" : "字母排序"}</p>
        <strong class="spelling-meaning">${question.correctWord.meaning}</strong>
        <button class="listen-question-button" type="button" data-speak-word-id="${question.correctWord.id}">播放发音</button>
      </div>
      ${feedback ? renderFeedback(feedback, question) : ""}
      ${
        isKeyboard
          ? renderKeyboardSpellingInput()
          : renderLetterOrderSpellingInput({ question, builtAnswer, selectedLetterIndices })
      }
      ${isKeyboard ? "" : renderSpellingStageFooter()}
      ${
        feedback?.showNext
          ? `<button class="primary-action wide next-question-button" type="button" data-spelling-next="true">
              ${questionIndex + 1 === totalQuestions ? "完成拼写挑战" : "下一题"}
            </button>`
          : ""
      }
      <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${unit.id}">
        返回 ${unitLabel}
      </button>
    </section>
  `;
}

function renderKeyboardSpellingInput() {
  return `
    <form class="spelling-compose-panel spelling-keyboard-form" data-spelling-form>
      <label class="spelling-input-label">
        <span>请输入英文单词</span>
        <input class="spelling-text-input" type="text" data-spelling-input autocomplete="off" autocapitalize="none" autocorrect="off" enterkeyhint="done" spellcheck="false" />
      </label>
      <div class="spelling-inline-actions">
        <button class="secondary-action wide" type="button" data-spelling-clear="true">
          清空当前拼写
        </button>
        <button class="primary-action wide" type="submit" data-spelling-check="true">
          检查答案
        </button>
      </div>
    </form>
  `;
}

function renderSpellingStageFooter() {
  return `
    <section class="stage-footer">
      <button class="secondary-action wide" type="button" data-spelling-clear="true">
        清空当前拼写
      </button>
      <button class="primary-action wide" type="button" data-spelling-check="true">
        检查
      </button>
    </section>
  `;
}

function renderLetterOrderSpellingInput({ question, builtAnswer, selectedLetterIndices }) {
  const selectedIndexSet = new Set(selectedLetterIndices);

  return `
    <div class="spelling-compose-panel">
      <p class="spelling-compose-title">点下面的字母来拼写</p>
      <div class="spelling-built-answer" aria-label="当前拼写">${builtAnswer || "..."}</div>
      <div class="spelling-letter-grid" aria-label="打乱后的字母">
        ${question.letters
          .map((letter, index) => {
            const selected = selectedIndexSet.has(index);
            return `
              <button class="spelling-letter-button" type="button" data-spelling-letter="${letter}" data-spelling-letter-index="${index}" ${selected ? "disabled" : ""}>
                ${letter}
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

export function renderSpellingCompleteView({ unit, spellingLevel, stars, finalMistakeCount }) {
  const unitLabel = getUnitLabel(unit);

  return `
    <section class="completion-panel" aria-labelledby="spelling-complete-title">
      <p class="eyebrow">${spellingLevel.id}</p>
      <h1 id="spelling-complete-title">拼写挑战完成</h1>
      <p class="page-copy">获得 ${stars} 个拼写星星。</p>
      <p class="page-copy">本次最终拼写错误 ${finalMistakeCount} 个。</p>
      <div class="stage-footer">
        <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${unit.id}">
          返回 ${unitLabel}
        </button>
      </div>
    </section>
  `;
}

function renderQuestionStageView({
  level,
  question,
  questionIndex,
  totalQuestions,
  feedback,
  title,
  nextAction,
  completeLabel,
}) {
  const questionMeta = getQuestionMeta(question);

  return `
    <section class="practice-panel" aria-labelledby="practice-title">
      <div class="practice-status">
        <p class="eyebrow">${level.id}</p>
        <strong>第 ${questionIndex + 1} / ${totalQuestions} 题</strong>
      </div>
      <h1 id="practice-title">${title}</h1>
      <div class="question-card">
        <p class="question-type">${questionMeta.label}</p>
        ${renderQuestionPrompt(question)}
      </div>
      ${feedback ? renderFeedback(feedback, question) : ""}
      <div class="answer-grid" aria-label="中文选项">
        ${question.options.map((option) => renderAnswerOption({ question, option, feedback })).join("")}
      </div>
      ${
        feedback?.showNext
          ? `<button class="primary-action wide next-question-button" type="button" ${nextAction}="true">
              ${questionIndex + 1 === totalQuestions ? completeLabel : "下一题"}
            </button>`
          : ""
      }
    </section>
  `;
}

export function renderPracticeCompleteView({ level }) {
  const unitLabel = getUnitLabelFromLevel(level);

  return `
    <section class="completion-panel" aria-labelledby="practice-complete-title">
      <p class="eyebrow">${level.id}</p>
      <h1 id="practice-complete-title">本关练习完成</h1>
      <p class="page-copy">你已经完成了这一关的练习。挑战阶段下一步再开放。</p>
      <div class="stage-footer">
        <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${level.unitId}">
          返回 ${unitLabel}
        </button>
        <button class="primary-action wide" type="button" data-route="challenge" data-level-id="${level.id}">
          进入挑战阶段
          <span>四种题型</span>
        </button>
      </div>
    </section>
  `;
}

export function renderChallengeCompleteView({ level, stars, wrongWordCount }) {
  const unitLabel = getUnitLabelFromLevel(level);

  return `
    <section class="completion-panel" aria-labelledby="challenge-complete-title">
      <p class="eyebrow">${level.id}</p>
      <h1 id="challenge-complete-title">本关挑战完成</h1>
      <p class="page-copy">获得 ${stars} 颗星。完成状态已经保存在本地。</p>
      <p class="page-copy">本关新增错词 ${wrongWordCount} 个。</p>
      <div class="stage-footer">
        <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${level.unitId}">
          返回 ${unitLabel}
        </button>
      </div>
    </section>
  `;
}

export function renderExtraChallengeCompleteView({ level, specialStars, badgeName, badgeUnlocked }) {
  const unitLabel = getUnitLabelFromLevel(level);

  return `
    <section class="completion-panel" aria-labelledby="extra-complete-title">
      <p class="eyebrow">${level.id}</p>
      <h1 id="extra-complete-title">额外挑战完成</h1>
      <p class="page-copy">获得 ${specialStars} 个特殊星。完成状态已经保存在本地。</p>
      <p class="page-copy">${badgeUnlocked ? `已解锁徽章：${badgeName}` : "继续完成主线、复习和所有额外挑战，可解锁徽章。"}</p>
      <div class="stage-footer">
        <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${level.unitId}">
          返回 ${unitLabel}
        </button>
      </div>
    </section>
  `;
}

function getQuestionMeta(question) {
  const labels = {
    "word-to-meaning": "看英文，选中文",
    "audio-to-meaning": "听发音，选中文",
    "audio-to-image": "听发音，选图片",
    "image-to-word": "看图片，选英文",
  };

  return {
    label: labels[question.type],
  };
}

function renderQuestionPrompt(question) {
  if (question.type === "audio-to-meaning" || question.type === "audio-to-image") {
    return `<button class="listen-question-button" type="button" data-speak-word-id="${question.correctWord.id}">播放发音</button>`;
  }

  if (question.type === "image-to-word") {
    return `<div class="question-image" aria-hidden="true">${question.correctWord.image}</div>`;
  }

  return `<div class="question-word">${question.correctWord.word}</div>`;
}

function renderAnswerOption({ question, option, feedback }) {
  const disabled = feedback?.lockAnswers ? "disabled" : "";

  if (question.type === "audio-to-image") {
    return `
      <button class="answer-option image-answer-option" type="button" data-answer-word-id="${option.id}" ${disabled} aria-label="${option.meaning}">
        <span class="option-image" aria-hidden="true">${option.image}</span>
      </button>
    `;
  }

  if (question.type === "image-to-word") {
    return `
      <button class="answer-option" type="button" data-answer-word-id="${option.id}" ${disabled}>
        ${option.word}
      </button>
    `;
  }

  return `
    <button class="answer-option" type="button" data-answer-word-id="${option.id}" ${disabled}>
      ${option.meaning}
    </button>
  `;
}

function renderFeedback(feedback, question) {
  if (feedback.type === "correct") {
    return `
      <div class="feedback-box is-correct" role="status">
        答对啦！${question.correctWord.word}，${question.correctWord.meaning}。
      </div>
    `;
  }

  if (feedback.type === "retry") {
    return `
      <div class="feedback-box is-retry" role="status">
        再想一想，听一遍发音。
      </div>
    `;
  }

  return `
    <div class="feedback-box is-answer" role="status">
      正确答案是 ${question.correctWord.word}，${question.correctWord.meaning}。
    </div>
  `;
}

function renderWordCard(word) {
  return `
    <article class="word-card">
      <div class="word-image" aria-hidden="true">${word.image}</div>
      <div class="word-content">
        <h2>${word.word}</h2>
        <p>${word.meaning}</p>
      </div>
      <button class="speak-button" type="button" data-speak-word-id="${word.id}" aria-label="播放 ${word.word} 发音">
        发音
      </button>
    </article>
  `;
}

function getUnitLabel(unit) {
  return unit.displayTitle.split(" ").slice(0, 2).join(" ");
}

function getUnitLabelFromLevel(level) {
  const match = level.unitId.match(/(?:^unit-|^g\d+[ab]-u)(\d+)$/);
  return match ? `Unit ${match[1]}` : "Unit";
}
