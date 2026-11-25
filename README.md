# 《子午线 1936：碎裂大陆》（Meridian 1936）

基于 **Vite + TypeScript (strict) + PixiJS v8 + Preact (`@preact/signals`) + Web Worker** 构建的 1936 欧洲历史大战略网页工程（当前已完成 **Batch 01 交互参谋地图**、**Batch 02 确定性 Worker 时钟与三锚点 HUD** 及 **Batch 03 工业建设、军需产线与自动贸易闭环**）。

## 核心特性
- **1936 欧洲参谋部亚麻制图（Batch 01）**：由公有领域 Natural Earth 经 LAEA 欧洲等积投影编译 **676 陆地省 + 62 海区**，GPU LUT 片元着色器 + 4 级语义缩放 LOD + 沿国土主脊贝塞尔弯曲国名 + O(1) 像素拾取。
- **确定性 Web Worker 时钟与双缓冲通信（Batch 02）**：`src/sim/` 纯 TS 零 DOM 依赖，采用千分比定点数 `FixedMath`、`sfc32` 确定性 PRNG、6 小时 Tick 日历（每日 4 跳：晨/午/昏/夜）与 `32 KB × 2` 双缓冲 `Transferable ArrayBuffer` 乒乓快照（不依赖 `SharedArrayBuffer`，原生兼容 GitHub Pages）。
- **《1936 欧洲参谋部国情档案袋》选国流程（Batch 02）**：8 大推荐国卡槽 + 31 国名录 + 背景地图点选全部 31 个 1936 欧洲主权国家开局；原创中性合规 SVG 国旗、首都地标版画剪影与五维综合国力简条（零领袖肖像、零违禁符号）。
- **原创“三锚点参谋桌面”HUD（Batch 02）**：顶栏双翼分体简报笺（中央留白、JetBrains Mono `tabular-nums` 等宽对齐、半圆欧洲危机度表盘与电报流水纸带）、底部居中胡桃木坞站（`F1–F6` 卷宗夹签 + `M1–M6` 地图模式透镜）与单一右侧 380px 上下文抽屉；全覆盖层指针穿透不阻挡地图缩放拖拽。
- **工业建设、7 类军需产线与战略资源自动贸易（Batch 03）**：聚类生成 **143 个行政工业区**（建筑槽、1–5 级基建、钢/油/稀产区）；每日确定性结算 `CIV/MIL/DOC/基建/合成炼油所` 工程队列（35% 民用消费品守恒）、7 类通用军需产线熟练度爬升（30%→75%）与缺料惩罚、自动资源进口撮合；实装 `[F3 军工与工程调度]` 380px 抽屉、省份卡快建、`M5` 工业资源气泡与地图施工斜纹/进度浮标。
- **开源合规与字体子集**：霞鹜文楷屏幕阅读版、思源黑体、JetBrains Mono、Cinzel（均为 SIL OFL 1.1）按字符集子集化为 WOFF2；全部资产登记于 [CREDITS.md](CREDITS.md) 与 `public/assets/ASSET_LICENSES.json`。

## 快速运行

```bash
# 安装依赖
npm install

# 开发模式（base = /）
npm run dev

# 生产构建（base = /meridian-1936/）与本地预览
npm run build
npx vite preview --port 4173
# 访问 http://localhost:4173/meridian-1936/

# 运行确定性回放、拓扑与合规单元测试
npm test
```

## 快捷键与调试 URL 协议
- **时间控制（主界面）**：`Space` 暂停 / 继续，`1` / `2` / `3` / `4` 切换 `1×–4×` 倍速
- **参谋卷宗（主界面）**：`F1` 方略 / `F2` 外交 / `F3` 军工 / `F4` 科技 / `F5` 占领补给 / `F6` 集团军
- **地图模式透镜（主界面）**：`Q` 政治（M1） / `W` 地形（M2） / `E` 补给（M3） / `R` 外交（M4） / `T` 工业（M5） / `Y` 海空（M6）
- **视口操作**：左键拖拽平移、滚轮缩放、`+` / `-` 缩放、`H` / `Home` 聚焦首都或重置全图、`Esc` 逐层关闭弹窗/抽屉/选省
- **确定性调试 URL**：
  - 选国档案袋：`?autotest=1&screen=country_select&country=GER`
  - 直入主界面设定国家与日期：`?autotest=1&scenario=1936&country=FRA&date=1936-03-15`
  - 展开指定抽屉与暂停：`?autotest=1&scenario=1936&country=GER&date=1936-01-01&paused=1&panel=industry`
  - 工业施工与贸易调试：`?autotest=1&scenario=1936&country=GER&panel=industry&subtab=construction|trade&mapmode=industry&queue=4:MIL,1:CIV&autotrade=1`
  - 地图与视角调试：`?autotest=1&mapmode=political|terrain|supply|diplomacy|industry|air_sea&cam=x,y,zoom&selectProv=<id>&hoverProv=<id>`
- **无头截图（SwiftShader 1440×900）**：
  ```bash
  node tools/shot.mjs --url "http://localhost:4173/meridian-1936/?autotest=1&scenario=1936&country=FRA&date=1936-03-15" --out shots/hud_fra_19360315.png --w 1440 --h 900 --wait 450
  ```
