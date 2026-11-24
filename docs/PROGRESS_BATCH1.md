# Batch 01 进度追踪 — 《子午线 1936：碎裂大陆》

## 状态：已完成（Batch 01 验收通过）

## 已完成清单
- [x] 1. 工程底座：Vite 6 + TypeScript (strict) + PixiJS v8 + Preact + `@preact/signals` + Vitest；生产 `base = /meridian-1936/`
- [x] 2. 1936 欧洲离线地图编译器 (`tools/map-compiler/`)：从 Natural Earth (Public Domain) 下载至 `data/raw/`（已 gitignore），LAEA 欧洲投影生成 **677 陆地省 + 62 海区**，产物提交于 `public/data/europe_1936/`（`topology.topo.json`、`province_id.png`、`terrain_relief.webp`、`europe_1936.json`）
- [x] 3. 字体子集与合规清单：OFL 1.1 霞鹜文楷屏幕阅读版 + 思源黑体 + JetBrains Mono + Cinzel WOFF2 子集（总计 ~410 KB）、原创中性合规 SVG 国旗 (`src/assets/flags/neutralFlags.ts`)、`public/assets/ASSET_LICENSES.json`、`CREDITS.md`
- [x] 4. PixiJS v8 LUT 渲染管线：`provinceLut.ts` 片元着色器（NEAREST + 无预乘 Alpha + 水彩国界内晕染 + 近岸浅滩波纹 + 朱砂选中光晕）、`BorderMeshBuilder.ts`（拓扑弧段 + T 形接缝/内陆微缝法向校准 + 河流 + 10° 经纬网）、`CurvedLabelLayer.ts`（贝塞尔弯曲中文国名 + 4 级 LOD + 屏幕空间零重叠避让）、`Uint16Array` O(1) 像素拾取
- [x] 5. Preact 最小参谋地图覆盖层：左上标题铭牌、底中 4 模式切换条 + 快捷键、右下缩放与 LOD 指示、右上专题图例、左下带中性 SVG 国旗的悬停/选中省份卡、动态读取 `ASSET_LICENSES.json` 的“关于 / 致谢”弹窗、`src/debug/urlHarness.ts`
- [x] 6. Vitest 自动化测试（8/8 通过）：省份数、1258 万像素与 ID 一一对应无漏色、无孤立省与邻接严格对称、23 处 1936 历史边界坐标实测（但泽/波兰走廊/东普鲁士/苏台德/奥地利/卡累利阿/克雷西/维尔诺/梅梅尔/比萨拉比亚/萨尔兰/阿尔巴尼亚/爱尔兰/冰岛/土耳其欧土等）、国旗合规扫描与 URL 解析
- [x] 7. 视觉验收 (`tools/shot.mjs` + SwiftShader 1440×900) 与两轮人工审图打磨：全部 5 张截图零控制台报错，已存至 `shots/`
- [x] 8. `README.md`、`CREDITS.md`、本地 git commit

## 截图验收清单 (`shots/`)
- `shots/overview_political.png` — 全欧 1936 政治版图宏观视角
- `shots/danzig_zoom_selected.png` — 但泽自由市 / 波兰走廊 / 东普鲁士特写 + 选中朱砂高亮与悬停卡
- `shots/alps_terrain.png` — 阿尔卑斯与莱茵兰地形地貌模式
- `shots/hover_card.png` — 中欧悬停柏林信息卡（含黑白红直臂铁十字中性旗）+ 选中捷克斯洛伐克
- `shots/europe_diplomacy_showcase.png` — 西中欧外交阵营视角（选中法兰西）

## 后续（Batch 02+，本次不在范围内）
- Web Worker 确定性时钟、选国档案袋、三锚点桌面 HUD、经济工业与陆战结算系统
