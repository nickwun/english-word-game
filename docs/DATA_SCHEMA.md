# DATA_SCHEMA.md

# 小学生英文单词游戏化学习网页数据结构说明

## 1. 数据设计原则

本项目第一版服务于“闽教版小学英语三年级下册新版”的单词学习。

第一版采用本地 JSON 文件管理词库数据，不使用数据库，不做后台编辑，不做账号系统。

核心原则：

1. Unit 是教材主线。
2. Level 是学习关卡。
3. Word 是最小学习单位。
4. A 类词为课文重点词，进入主线关卡。
5. B 类词为补充词，进入额外挑战关。
6. 学习进度保存在浏览器本地 localStorage。
7. Unit 状态由关卡完成情况、错词复习情况、额外挑战完成情况共同计算。

---

## 2. 顶层数据结构

词库文件路径建议：

```text
src/data/vocabulary.json
```

顶层结构：

```json
{
  "version": "1.0.0",
  "textbook": {
    "publisher": "福建教育出版社",
    "edition": "闽教版小学英语三年级下册新版",
    "grade": 3,
    "semester": "下册"
  },
  "units": []
}
```

---

## 3. Unit 数据结构

每个 Unit 表示教材中的一个单元。

```json
{
  "id": "unit-1",
  "title": "Our Animal Friends",
  "displayTitle": "Unit 1 Our Animal Friends",
  "status": "available",
  "badge": {
    "id": "badge-unit-1",
    "name": "动物朋友达人",
    "description": "完成 Unit 1 主线学习、错词复习和额外挑战后解锁"
  },
  "levels": []
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 是 | Unit 唯一 ID |
| title | string | 是 | Unit 英文标题 |
| displayTitle | string | 是 | 页面展示标题 |
| status | string | 是 | `available` 或 `coming-soon` |
| badge | object | 是 | Unit 徽章信息 |
| levels | array | 是 | 该 Unit 下的关卡列表 |

### status 可选值

```text
available：当前可学习
coming-soon：即将开放
```

MVP 阶段：

- Unit 1：available
- Unit 2–4：coming-soon

---

## 4. Level 数据结构

每个 Level 表示一个小关。

```json
{
  "id": "u1-main-1",
  "unitId": "unit-1",
  "type": "main",
  "title": "Level 1",
  "displayTitle": "动物朋友 1",
  "order": 1,
  "words": []
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 是 | Level 唯一 ID |
| unitId | string | 是 | 所属 Unit |
| type | string | 是 | `main` 或 `extra` |
| title | string | 是 | 关卡内部标题 |
| displayTitle | string | 是 | 页面展示标题 |
| order | number | 是 | 排序 |
| words | array | 是 | 本关单词 |

### type 可选值

```text
main：主线关卡，学习 A 类重点词
extra：额外挑战关，学习 B 类补充词
```

---

## 5. Word 数据结构

每个 Word 表示一个单词。

```json
{
  "id": "u1-a-001",
  "word": "animal",
  "meaning": "动物",
  "priority": "A",
  "tags": ["animal"],
  "image": "🐾",
  "audio": "",
  "example": ""
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 是 | 单词唯一 ID |
| word | string | 是 | 英文单词 |
| meaning | string | 是 | 中文意思 |
| priority | string | 是 | `A` 或 `B` |
| tags | array | 是 | 主题标签 |
| image | string | 是 | emoji、图标名或图片路径 |
| audio | string | 否 | 音频路径，第一版可为空 |
| example | string | 否 | 例句，第一版可为空 |

### priority 可选值

```text
A：课文重点词，进入主线关卡
B：补充词，进入额外挑战关
```

---

## 6. 本地进度数据结构

学习进度保存在 localStorage 中。

建议 key：

```text
english-word-game-progress
```

数据结构：

```json
{
  "completedLevels": {
    "u1-main-1": {
      "stars": 3,
      "completedAt": "2026-05-07T10:00:00.000Z"
    }
  },
  "completedExtraLevels": {
    "u1-extra-1": {
      "specialStars": 3,
      "completedAt": "2026-05-07T10:00:00.000Z"
    }
  },
  "wrongWords": {
    "u1-a-001": {
      "wordId": "u1-a-001",
      "unitId": "unit-1",
      "levelId": "u1-main-1",
      "wrongCount": 1,
      "mastered": false,
      "lastWrongAt": "2026-05-07T10:00:00.000Z"
    }
  },
  "completedReviews": {
    "unit-1": {
      "completedAt": "2026-05-07T10:00:00.000Z"
    }
  },
  "unlockedBadges": {
    "badge-unit-1": {
      "unlockedAt": "2026-05-07T10:00:00.000Z"
    }
  }
}
```

---

## 7. 星级计算规则

### 主线关卡星级

每个主线关卡最多 3 星。

建议规则：

```text
3 星：挑战阶段全部答对，或没有任何单词进入错词本
2 星：完成关卡，但有 1–2 个单词进入错词本
1 星：完成关卡，但有 3 个及以上单词进入错词本
```

第一版不需要过度复杂，不根据答题时间评分。

不要加入倒计时。

### 额外挑战特殊星星

额外挑战关也最多 3 个特殊星星。

规则可以与主线关卡一致，但在 UI 上用不同样式展示。

---

## 8. 错词规则

### 错词进入规则

当孩子在练习或挑战阶段答错某个单词时，该词进入 wrongWords。

如果同一个词多次答错：

```text
wrongCount + 1
lastWrongAt 更新为最近错误时间
```

### 错词掌握规则

在错词复习中答对后，可以标记：

```json
"mastered": true
```

第一版不做复杂记忆曲线。

---

## 9. Unit 状态计算规则

Unit 状态不要硬编码在词库里，而应由进度数据计算。

### 未开始

```text
该 Unit 没有任何已完成关卡
```

### 学习中

```text
至少完成 1 个主线关卡
但没有完成全部主线关卡和错词复习
```

### 主线完成

满足：

```text
该 Unit 所有 main levels 已完成
+
该 Unit 错词复习已完成
```

### 完全掌握

满足：

```text
该 Unit 所有 main levels 已完成
+
该 Unit 错词复习已完成
+
该 Unit 所有 extra levels 已完成
+
Unit 徽章已解锁
```

---

## 10. MVP 阶段数据范围

MVP 阶段：

1. Unit 1 完整可用；
2. Unit 2–4 只展示为即将开放；
3. Unit 1 包含：
   - main levels
   - extra levels
   - badge
   - A 类重点词
   - B 类补充词

---

## 11. 不做的事情

第一版数据结构不支持以下能力：

1. 多教材版本切换；
2. 多孩子账号；
3. 云端同步；
4. 后台编辑词库；
5. CSV / Excel 导入；
6. 复杂复习计划；
7. 金币、宠物、商店；
8. 排行榜；
9. 社交分享。

后续如需扩展，再单独升级数据结构。
