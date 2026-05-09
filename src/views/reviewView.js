export function renderReviewStageView({ unit, question, questionIndex, totalQuestions, feedback }) {
  const isAudioQuestion = question.type === "audio-to-meaning";

  return `
    <section class="practice-panel" aria-labelledby="review-title">
      <div class="practice-status">
        <p class="eyebrow">${unit.displayTitle}</p>
        <strong>第 ${questionIndex + 1} / ${totalQuestions} 题</strong>
      </div>
      <h1 id="review-title">错词复习</h1>
      <div class="question-card">
        <p class="question-type">${isAudioQuestion ? "听发音，选中文" : "看英文，选中文"}</p>
        ${
          isAudioQuestion
            ? `<button class="listen-question-button" type="button" data-speak-word-id="${question.correctWord.id}">播放发音</button>`
            : `<div class="question-word">${question.correctWord.word}</div>`
        }
      </div>
      ${feedback ? renderReviewFeedback(feedback, question) : ""}
      <div class="answer-grid" aria-label="中文选项">
        ${question.options
          .map(
            (option) => `
              <button class="answer-option" type="button" data-answer-word-id="${option.id}" ${feedback?.lockAnswers ? "disabled" : ""}>
                ${option.meaning}
              </button>
            `,
          )
          .join("")}
      </div>
      ${
        feedback?.showNext
          ? `<button class="primary-action wide next-question-button" type="button" data-review-next="true">
              ${questionIndex + 1 === totalQuestions ? "完成复习" : "下一题"}
            </button>`
          : ""
      }
    </section>
  `;
}

export function renderReviewEmptyView({ unit }) {
  const unitLabel = getUnitLabel(unit);

  return `
    <section class="completion-panel" aria-labelledby="review-empty-title">
      <p class="eyebrow">${unit.displayTitle}</p>
      <h1 id="review-empty-title">当前没有需要复习的错词</h1>
      <div class="stage-footer">
        <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${unit.id}">
          返回 ${unitLabel}
        </button>
      </div>
    </section>
  `;
}

export function renderReviewCompleteView({ unit, masteredCount, remainingCount }) {
  const unitLabel = getUnitLabel(unit);

  return `
    <section class="completion-panel" aria-labelledby="review-complete-title">
      <p class="eyebrow">${unit.displayTitle}</p>
      <h1 id="review-complete-title">错词复习完成</h1>
      <p class="page-copy">本次掌握 ${masteredCount} 个错词，当前剩余 ${remainingCount} 个未掌握错词。</p>
      <div class="stage-footer">
        <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${unit.id}">
          返回 ${unitLabel}
        </button>
      </div>
    </section>
  `;
}

function renderReviewFeedback(feedback, question) {
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

function getUnitLabel(unit) {
  return unit.displayTitle.split(" ").slice(0, 2).join(" ");
}
