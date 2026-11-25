# Batch 02 进度追踪 — 《子午线 1936：碎裂大陆》

## 状态：已完成（Batch 02 模拟骨架、三锚点 HUD 与选国档案袋验收通过）

## 已完成清单
- [x] 1. **纯 TS 确定性模拟骨架（Web Worker，零 `SharedArrayBuffer` / 零 DOM 依赖）**：
  - `src/sim/core/FixedMath.ts`：千分比 32 位定点数算术（`FIXED_SCALE = 1000`、`mulFixed`/`divFixed`/`lerpFixed`）
  - `src/sim/core/SeededRng.ts`：`sfc32` 确定性 32 位 PRNG（128-bit 状态可序列化/复现）
  - `src/sim/core/ClockCalendar.ts`：6 小时确定性 Tick（每日 4 跳：晨 00:00 / 午 06:00 / 昏 12:00 / 夜 18:00），支持格里高利闰年、`暂停 + 1×~4×` 倍速
  - `src/sim/core/GameCommand.ts`：`GameCommand` 单向 JSON 指令队列与历史记录
  - `src/sim/core/SnapshotCodec.ts` + `src/sim/worker.ts` + `src/ui/store/SimClient.ts`：32 KB × 2 双缓冲 `Transferable ArrayBuffer` 乒乓移交通信，不依赖 `SharedArrayBuffer`
  - `src/sim/core/SimEngine.ts` + `src/sim/data/nations1936*.ts`：时钟推进、种子、选国、1936 全部 31 国开局静态占位快照与轻量电报纸带（未提前引入 Batch 03 工业产线/建设/贸易循环）
- [x] 2. **《1936 欧洲参谋部国情档案袋》选国界面（`src/ui/ScenarioSelectModal.tsx`、`DossierCountryCard.tsx`）**：
  - 8 大推荐国卡槽（德/英/法/苏/意/波/西/捷）+ `全部 31 国` 名录弹窗 + 直接点击背景实时地图任选 31 个欧洲国家
  - 全套 36 枚中性合规 3:2 几何 SVG 国旗（含 31 个欧洲可选国 + `SPA` + `JPN` 日之丸等）；德国黑白红三色+中心直臂铁十字、意大利三色+萨伏依蓝盾无束棒、苏联简化金星红旗、零领袖肖像，配原创单色首都地标版画剪影与五维综合国力简条
  - 默认进入选国流程；支持 `?autotest=1&screen=country_select&country=GER` 与 `?scenario=1936&country=FRA&date=1936-03-15` 等确定性 URL 协议
- [x] 3. **原创三锚点参谋桌面 HUD（`src/ui/AppShell.tsx` + `src/ui/hud/` + `src/ui/drawers/`）**：
  - 顶栏双翼分体简报笺（中央完全留白）：左上为国旗/政体章与等宽对齐的行政点、凝聚/动员、可用人力、民/军/船工厂、钢/油/稀资源；右上为精确日期时段、暂停与 `1×–4×` 机械拨杆、半圆欧洲危机度表盘与可折叠电报流水纸带
  - 底部居中胡桃木公文坞站：6 枚梯形卷宗夹签 `F1–F6`（点击展开单一右侧 380px 占位卷宗抽屉）+ 6 枚圆形制图透镜 `M1–M6`（`Q/W/E/R/T/Y`，无冲突并存 `Space` 暂停与 `1–4` 倍速）
  - 覆盖层全容器 `pointer-events: none`，仅面板与控件 `pointer-events: auto`，保持现有 Batch 01 地图缩放、拖拽、悬停与选省完好无损
- [x] 4. **字体子集更新（SIL OFL 1.1）**：使用 `tools/build_fonts.py` 重子集化霞鹜文楷屏幕阅读版（294.5 KB）、思源黑体（279.2 KB）、JetBrains Mono（33.2 KB）与 Cinzel（36.7 KB），补全所有新增中文与符号
- [x] 5. **测试与构建验收**：
  - `npm test`：3 个测试文件共 **15/15 通过**（含 1,460 Tick 双次运行确定性哈希一致、32 KB Transferable 快照编解码、`src/sim/` 零 DOM/PIXI/SAB 静态扫描、全部 31+ 国 SVG 旗帜与地标版画违禁符号扫描、URL 解析与 Batch 01 全套拓扑边界回归）
  - `npm run build`：零报错通过（独立 ES Module Worker `dist/assets/worker-*.js` 18.17 KB）
  - 无头交互 E2E 验证：滚轮缩放、进入主界面、`4×` 时钟推进与 `Space` 暂停稳定零报错
- [x] 6. **SwiftShader 1440×900 视觉验收截图（未覆盖 Batch 01 既有截图，0 控制台报错）**：
  - `shots/country_select_ger.png` — 德国档案袋（黑白红直臂铁十字旗、勃兰登堡门版画、五维简条、8 大推荐国托盘）
  - `shots/country_select_overview.png` — 全欧地图背景 + 意大利档案袋（三色+萨伏依蓝盾、斗兽场版画）
  - `shots/hud_fra_19360315.png` — 法国 `1936-03-15` 三锚点主界面（双翼留白、等宽数字、危机度 10%、电报纸带、6 卷宗+6 透镜）
  - `shots/hud_paused.png` — 德国暂停态 + 右侧 380px `F3 军工` 占位卷宗抽屉

## 已知不足（留待后续批次补全）
- `M3 后勤补给` 与 `M6 海空态势` 当前为基于省份地形/都市的静态预览染色（真实多源补给网与海空战区将在 Batch 07 / 10 实装）
- `F1–F6` 卷宗抽屉目前展示实时同步快照与占位说明页（经济建设与产线从 Batch 03 起逐步实装）
- 尚未引入音频系统与存档持久化（规划于 Batch 12）
