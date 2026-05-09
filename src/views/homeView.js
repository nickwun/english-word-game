import { getAllUnits, getUnitById } from "../core/vocabulary.js?v=26";
import { summarizeUnitProgress } from "../core/progress.js?v=26";

export function renderHomeView({ vocabulary, progress }) {
  const units = getAllUnits(vocabulary).filter((unit) => unit.status === "available");
  const unit = getUnitById(vocabulary, "g3b-u1");
  const summary = summarizeUnitProgress(unit, progress);

  return `
    <section class="hero-panel" aria-labelledby="home-title">
      <div>
        <p class="eyebrow">闽教版三年级下册</p>
        <h1 id="home-title">每天 5 个词，轻松闯一关</h1>
        <p class="hero-copy">Unit 1-4 已开放，继续沿用学习、练习、挑战、复习和额外挑战的节奏。</p>
      </div>
      <div class="progress-card" aria-label="当前学习进度">
        <span class="progress-number">${summary.completedMainLevels}/${summary.totalMainLevels}</span>
        <span>Unit 1 主线关卡</span>
        <strong>${summary.status}</strong>
      </div>
    </section>

    <section class="action-grid" aria-label="快捷入口">
      <button class="primary-action" type="button" data-route="units">
        继续学习
      </button>
      <button class="secondary-action" type="button" data-route="units">
        Unit 列表
        <span>${units.length} 个 Unit 可学习</span>
      </button>
      <button class="secondary-action" type="button" data-route="review" data-unit-id="g3b-u1">
        错词复习
        <span>${summary.wrongWords} 个待复习</span>
      </button>
      <button class="secondary-action" type="button" data-route="parent" data-unit-id="g3b-u1">
        家长面板
        <span>查看本地进度</span>
      </button>
    </section>
  `;
}
