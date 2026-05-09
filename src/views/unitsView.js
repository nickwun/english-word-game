import { getBooks } from "../core/vocabulary.js?v=26";
import { summarizeUnitProgress } from "../core/progress.js?v=26";

export function renderUnitsView({ vocabulary, progress }) {
  const books = getBooks(vocabulary);

  return `
    <section class="page-heading">
      <p class="eyebrow">Unit 主线</p>
      <h1>选择今天的小关</h1>
      <p class="page-copy">当前支持上下册并存；旧进度如未显示，可在家长面板重置后重新开始。</p>
    </section>

    ${books
      .map(
        (book) => `
          <section class="book-unit-section" aria-label="${book.displayTitle}">
            <div class="book-heading">
              <p class="eyebrow">${book.title}</p>
              <h2>${book.displayTitle}</h2>
            </div>
            <div class="unit-list">
              ${(book.units ?? []).map((unit) => renderUnitCard(unit, progress)).join("")}
            </div>
          </section>
        `,
      )
      .join("")}
  `;
}

function renderUnitCard(unit, progress) {
  if (unit.status === "coming-soon") {
    return `
      <article class="unit-card is-locked">
        <div>
          <p class="unit-kicker">${unit.displayTitle}</p>
          <h2>${unit.title}</h2>
        </div>
        <strong>即将开放</strong>
      </article>
    `;
  }

  const summary = summarizeUnitProgress(unit, progress);

  return `
    <article class="unit-card">
      <div class="unit-card-main">
        <p class="unit-kicker">${unit.displayTitle}</p>
        <h2>${unit.title}</h2>
        <p>主线进度 ${summary.completedMainLevels}/${summary.totalMainLevels}，当前错词 ${summary.wrongWords} 个</p>
      </div>
      <div class="unit-meta">
        <span>${summary.status}</span>
        <span>${summary.totalStars} 颗星</span>
        <span>${summary.badgeUnlocked ? "徽章已解锁" : "徽章未解锁"}</span>
      </div>
      <button class="primary-action compact unit-enter-button" type="button" data-route="unit-detail" data-unit-id="${unit.id}">
        进入 ${getUnitLabel(unit)}
        <span>查看主线关卡</span>
      </button>
    </article>
  `;
}

function getUnitLabel(unit) {
  return unit.displayTitle.split(" ").slice(0, 2).join(" ");
}
