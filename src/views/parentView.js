import { getAllWordsForUnit, getLevelsByType } from "../core/vocabulary.js?v=26";
import { getParentUnitStats } from "../core/progress.js?v=26";

export function renderParentView({ unit, progress }) {
  const stats = getParentUnitStats(unit, progress);
  const wordById = new Map(getAllWordsForUnit(unit).map((word) => [word.id, word]));
  const wrongWords = Object.values(progress.wrongWords ?? {}).filter((entry) => entry.unitId === unit.id);
  const mainLevels = getLevelsByType(unit, "main");
  const extraLevels = getLevelsByType(unit, "extra");
  const unitLabel = getUnitLabel(unit);

  return `
    <section class="page-heading parent-heading">
      <p class="eyebrow">${unit.displayTitle}</p>
      <h1>家长面板</h1>
      <p class="page-copy">这里显示 ${unitLabel} 的本地学习记录，方便家长快速了解孩子当前进度。</p>
    </section>

    <section class="parent-stats-grid" aria-label="${unitLabel} 基础统计">
      ${renderStatCard("Unit 状态", stats.status)}
      ${renderStatCard("主线关卡完成数", `${stats.completedMainLevels}/${stats.totalMainLevels}`)}
      ${renderStatCard("额外挑战完成数", `${stats.completedExtraLevels}/${stats.totalExtraLevels}`)}
      ${renderStatCard("已完成关卡数", stats.completedLevelCount)}
      ${renderStatCard("已学单词数", stats.learnedWordCount)}
      ${renderStatCard("当前未掌握错词数", stats.activeWrongWordCount)}
      ${renderStatCard("已掌握错词数", stats.masteredWrongWordCount)}
      ${renderStatCard(`${unit.badge.name}徽章`, stats.badgeUnlocked ? "已解锁" : "未解锁")}
      ${unit.spellingChallenge?.enabled ? renderStatCard("拼写挑战完成数", `${stats.completedSpellingChallenges}/${stats.totalSpellingChallenges}`) : ""}
      ${unit.spellingChallenge?.enabled ? renderStatCard("拼写星星", stats.spellingStars) : ""}
      ${unit.spellingChallenge?.enabled ? renderStatCard("拼写错误词数", stats.spellingMistakeCount) : ""}
    </section>

    <section class="parent-section" aria-labelledby="parent-main-title">
      <h2 id="parent-main-title">主线关卡</h2>
      <div class="parent-level-list">
        ${mainLevels
          .map((level) => renderMainLevelRow(level, progress.completedLevels[level.id]))
          .join("")}
      </div>
    </section>

    <section class="parent-section" aria-labelledby="parent-extra-title">
      <h2 id="parent-extra-title">额外挑战关</h2>
      <div class="parent-level-list">
        ${extraLevels
          .map((level) => renderExtraLevelRow(level, progress.completedExtraLevels[level.id]))
          .join("")}
      </div>
    </section>

    <section class="parent-section" aria-labelledby="parent-wrong-title">
      <h2 id="parent-wrong-title">当前错词列表</h2>
      ${wrongWords.length > 0 ? renderWrongWordList(wrongWords, wordById) : `<p class="page-copy">当前没有错词记录。</p>`}
    </section>

    <section class="parent-actions" aria-label="家长操作">
      <button class="danger-action wide" type="button" data-reset-progress="true">
        重置进度
        <span>清空本机保存的学习记录</span>
      </button>
      <button class="secondary-action wide" type="button" data-route="unit-detail" data-unit-id="${unit.id}">
        返回 ${unitLabel}
      </button>
    </section>
  `;
}

function renderStatCard(label, value) {
  return `
    <article class="parent-stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function renderMainLevelRow(level, completed) {
  return `
    <article class="parent-level-row">
      <div>
        <p class="unit-kicker">${level.id}</p>
        <h3>${level.displayTitle}</h3>
      </div>
      <span>${completed ? "已完成" : "未完成"}</span>
      <strong>${completed ? `${completed.stars} 星` : "0 星"}</strong>
    </article>
  `;
}

function renderExtraLevelRow(level, completed) {
  return `
    <article class="parent-level-row">
      <div>
        <p class="unit-kicker">${level.id}</p>
        <h3>${level.displayTitle}</h3>
      </div>
      <span>${completed ? "已完成" : "未完成"}</span>
      <strong>${completed ? `${completed.specialStars} 特殊星` : "0 特殊星"}</strong>
    </article>
  `;
}

function renderWrongWordList(wrongWords, wordById) {
  return `
    <div class="wrong-word-table" role="table" aria-label="错词列表">
      <div class="wrong-word-row wrong-word-header" role="row">
        <span role="columnheader">英文</span>
        <span role="columnheader">中文</span>
        <span role="columnheader">wrongCount</span>
        <span role="columnheader">mastered</span>
      </div>
      ${wrongWords
        .map((entry) => {
          const word = wordById.get(entry.wordId);
          return `
            <div class="wrong-word-row" role="row">
              <span role="cell">${word?.word ?? entry.wordId}</span>
              <span role="cell">${word?.meaning ?? "未找到释义"}</span>
              <span role="cell">wrongCount ${entry.wrongCount}</span>
              <span role="cell">${entry.mastered ? "已掌握" : "未掌握"}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function getUnitLabel(unit) {
  return unit.displayTitle.split(" ").slice(0, 2).join(" ");
}
