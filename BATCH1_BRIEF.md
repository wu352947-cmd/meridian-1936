# BATCH 01 BRIEF — 《子午线 1936：碎裂大陆》 Meridian 1936 (only Batch 01!)

## 输出方式（硬性，否则会失败）
- 之前的长回复会因 `stream reading error: unexpected EOF` 被截断。你必须通过**很多次小的工具调用**工作：每次写文件不超过约 150 行 / 6000 字符，大文件分多次创建或追加；每轮文字回复保持简短（几句话）。不要在一次回复里输出大段代码或长文档。
- 随时保持仓库处于可继续状态；在 `docs/PROGRESS_BATCH1.md` 里简短记录已完成/待办，便于中断后续跑。

## 先读
- `docs/DESIGN_carbon.md`：重点读 §2（技术栈/地图渲染）、§3（地图数据管线）、§6.2/6.6（地图模式、中文字体）、§7（美术方向、调色板、旗帜决策、素材清单）、§11.0 与 Batch 01、§12（仓库结构）。分段读，不要一次读全文。
- `docs/ART_BIBLE.md`：调色板 hex、字体层级、各缩放级地图视觉规则、禁止事项。
- 风格参考（只看不抄、绝不复制进仓库）：`/workspace/ww2-europe-plan/ref/*.jpg|png`（HOI4/AoH3 官方截图）。我们的画风是原创的“1936 参谋部亚麻纸制图 + 墨线 + 水彩晕染”，不能模仿它们的 UI 布局。

## 范围 = 设计文档 Batch 01，仅此
工程底座 + 1936 欧洲地图编译器 + “一眼惊艳”的可交互参谋地图。**不做** Batch 02 及以后（无 Worker 时钟、无选国界面、无 HUD 卷宗、无经济/战斗）。可以有一个极简的地图模式切换条、缩放按钮、悬停/选中信息小卡片和“关于/致谢”入口（这些属于地图交互）。

## 技术（硬性）
- Vite + TypeScript(strict) + PixiJS v8 + Preact(+signals) 覆盖层；`vite.config.ts` 生产 base = `/meridian-1936/`。
- 必须在 headless Chrome + SwiftShader（WebGL2，无 GPU）下正确渲染（截图环境）。省份 ID 纹理采样 NEAREST、不预乘 alpha（见文档提示）。
- `npm run build`、`npm test`(vitest) 必须通过；浏览器控制台无报错。
- 地图编译器 `tools/map-compiler/`（Node/TS 或 Python 均可）：从 Natural Earth（公有领域；1:10m 或 1:50m admin-0/admin-1、海岸、河流、湖泊）下载到 `data/raw/`（已 gitignore），按文档 §3 生成 1936 欧洲历史国界与约 500–700 个陆地省 + 若干海区（目标 640+68，可略少但需合理），LAEA 欧洲投影；输出到 `public/data/europe_1936/`（topojson/二进制 + province_id.png + 省份属性 JSON：id、中文名、英文名、国家 tag、地形、是否沿海、邻接）。产物要提交进仓库，这样构建不依赖网络。
- 1936 关键历史边界必须正确：但泽自由市、波兰走廊、东普鲁士、苏台德属捷克斯洛伐克、奥地利独立、卡累利阿旧芬苏边界、波兰东部（克雷西）、罗马尼亚含比萨拉比亚、立陶宛不含维尔纽斯（属波兰）、梅梅尔属立陶宛、阿尔巴尼亚独立、萨尔属德国（1935 后）、爱尔兰自由邦、冰岛、土耳其欧洲部分等。北非沿岸/中东边缘可作为地图边缘背景。
- 网络：如需下载，环境变量已有代理（HTTPS_PROXY=http://127.0.0.1:7890）。
- 截图工具 `tools/shot.mjs`：puppeteer-core，executablePath `/usr/bin/google-chrome`，args `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox`；支持 `--url --out --w --h --wait`，等待 `window.__MERIDIAN_READY__`，打印控制台错误。先 `npm run build && npx vite preview` 或 dev server 再截。
- URL 参数（§11.0）：`autotest=1`、`mapmode=political|terrain|diplomacy(可占位但要好看)|industry(可占位)`、`cam=x,y,zoom`、`selectProv=<id>`、`hoverProv=<id>`（为截图模拟悬停）、`lang=zh`。

## 画面质量（用户最在意）
- 纸质亚麻底纹 + 海洋色阶（近岸浅、远海深，可有海图细等深线/经纬网）、国家低饱和矿物色（用 ART_BIBLE 调色板）、国界粗墨线 + 省界细虚线、国界内侧水彩晕染、主要河流墨线、山地/地形浮雕的淡阴影（地形模式更明显）。
- 中文国名沿国土主轴弯曲排布、随缩放 LOD 出现省名/城市名；文字不能互相重叠或溢出。中文字体用霞鹜文楷或思源（OFL），注意子集化/包体。
- 悬停：省份浅高亮 + 底部/角落信息卡（省名、所属国、地形）；点击国家/省份：朱砂色外发光描边。
- 旗帜（若信息卡中显示）：德国黑白红三色+中心直臂铁十字 Balkenkreuz；意大利三色+萨伏依盾无束棒；苏联简化红旗；日本日之丸。**任何地方都不允许卐字或 SS 符文。**自绘 SVG。
- 原创 UI，绝不照搬 HOI4/AoH3 布局、名称、图标、文字。

## 合规
- 只用开放许可素材，每一项写进 `CREDITS.md`（名称、URL、作者、许可证）和 `public/assets/ASSET_LICENSES.json`，游戏内有“关于/致谢”面板。Natural Earth 数据致谢。
- 绝不把 `/workspace/ww2-europe-plan/ref/` 的任何图片复制进本仓库。

## 验收（全部完成才算完）
1. vitest：拓扑/数据测试（无孤立陆地省、ID 与 PNG 像素一一对应、邻接对称、关键 1936 边界抽查如但泽/东普鲁士/苏台德归属）全部通过。
2. `npm run build` 通过。
3. 截图（1440×900，存到 `shots/`）：`overview_political.png`（全欧）、`danzig_zoom_selected.png`（但泽走廊特写+选中高亮）、`alps_terrain.png`（地形模式）、`hover_card.png`（悬停信息卡）、再加一张你认为最好看的；**你必须亲自打开查看每张截图**，挑出不好看的地方（文字重叠、锯齿、颜色脏、边界错误、空白）并修好再重截，至少迭代一轮。
4. `README.md`（中文简介 + 运行方式）、`CREDITS.md`、`docs/PROGRESS_BATCH1.md` 更新。
5. 不要 git push、不要创建 GitHub 仓库或部署；可以本地 git commit。

完成后用几句话简短汇报：做了什么、测试结果、截图路径、已知不足。
