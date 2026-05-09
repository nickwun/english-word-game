# English Word Game Codex Starter Pack

请把本压缩包解压到你的项目根目录，或把其中的文件复制到对应路径：

- docs/SPEC.md
- docs/DATA_SCHEMA.md
- docs/TASKS.md
- src/data/vocabulary.json

建议给 Codex 的第一条指令：

请先阅读 docs/SPEC.md、docs/DATA_SCHEMA.md、docs/TASKS.md 和 src/data/vocabulary.json。
严格按照文档实现第一版，不要扩展功能。
第一阶段只完整实现 Unit 1，Unit 2–4 显示“即将开放”。
请先输出你的开发计划和文件结构，不要马上大改代码。等我确认后，再开始实现。

## 开发说明：ID 迁移

词库已从单册 `units` 结构升级为 `books -> units -> levels -> words` 结构。当前三年级下册 ID 已从 `unit-1` / `u1-main-1` 迁移为 `g3b-u1` / `g3b-u1-main-1`，旧 localStorage 进度可能失效。开发阶段可通过家长面板的“重置进度”按钮，或清除浏览器中的 `english-word-game-progress` 后重新开始。
