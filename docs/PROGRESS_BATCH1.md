# Batch 01 进度追踪 — 《子午线 1936：碎裂大陆》

## 状态：已完成（Batch 01 第 2 轮审图打磨验收通过）

## 已完成清单
- [x] 1. 工程底座：Vite 6 + TypeScript (strict) + PixiJS v8 + Preact + `@preact/signals` + Vitest；生产 `base = /meridian-1936/`
- [x] 2. 1936 欧洲离线地图编译器 (`tools/map-compiler/`)：从 Natural Earth (Public Domain) 下载至 `data/raw/`（已 gitignore），LAEA 欧洲投影生成 **676 陆地省 + 62 海区**，产物提交于 `public/data/europe_1936/`（`topology.topo.json`、`province_id.png`、`terrain_relief.webp`、`europe_1936.json`）
- [x] 3. 第 2 轮边界与地名打磨：
  - 移除现代加里宁格勒-波兰直线切缝及所有拼合微缝（东普鲁士/卡累利阿/克雷西/比萨拉比亚/外喀尔巴阡/南斯拉夫等统一焊合，海/陆双缓冲栅格化保留内湾孔洞）
  - 省界改为 **Natural Earth admin-1 聚合/切分 + 河流切分 + 水密共享边分形中点位移抖动**（`organic_borders.py`），彻底消除 Voronoi 直线与尖角
  - 省名重构为 **1936 历史城镇词典 + Natural Earth admin-1 中文名**（646/676 陆省带真实地名标签，无 `·甲/乙` 后缀；其余 30 处偏远腹地仅在信息卡显示描述名，地图上自动隐藏）
- [x] 4. 字体子集与合规清单：OFL 1.1 霞鹜文楷屏幕阅读版 + 思源黑体 + JetBrains Mono + Cinzel WOFF2 子集（按新地名重子集化，总计 ~447 KB）、原创中性合规 SVG 国旗 (`src/assets/flags/neutralFlags.ts`)、`public/assets/ASSET_LICENSES.json`、`CREDITS.md`
- [x] 5. PixiJS v8 LUT 渲染管线与语义修正：
  - 选中省份 = 该省朱砂外发光 + 柔和水彩内晕 + 所属国极细淡红边界；悬停省份 = 保留纸纹/地形浮雕的暖羊皮纸提亮 + 细古金色/墨色描边；其它国家无多余红线
  - 视口安全裁剪标注 (`CurvedLabelLayer.ts`)：国名/城名/省名整段位于视口安全区内，越界国名优先沿可见弧段重排，放不下则自动隐藏（无裁切、不与图例冲突）
- [x] 6. Vitest 自动化测试（10/10 通过）：省份数、1258 万像素 1-to-1 无漏色、无孤立省与邻接对称、27 处 1936 历史边界坐标（含外喀尔巴阡/南蒂罗尔/伊斯特拉/南多布罗加）、**国界/海岸内部接缝与东普鲁士假直线防回归检测**、可见省名无泛用后缀校验、国旗合规扫描与 URL 解析
- [x] 7. 视觉验收 (`tools/shot.mjs` + SwiftShader 1440×900)：全部 7 张截图零控制台报错且均已人工逐张核验，存至 `shots/`
- [x] 8. `README.md`、`CREDITS.md`、本地 git commit（未 push）

## 截图验收清单 (`shots/`)
- `shots/overview_political.png` — 全欧 1936 政治版图宏观视角
- `shots/overview_terrain.png` — 全欧 1936 地形地貌宏观视角
- `shots/danzig_zoom_selected.png` — 但泽自由市 / 波兰走廊 / 东普鲁士特写（选中但泽朱砂外发光、无东普鲁士接缝、博恩霍尔姆等真实地名）
- `shots/alps_terrain.png` — 阿尔卑斯与莱茵兰地形地貌模式（自然省界、无右上角越界国名）
- `shots/hover_card.png` — 中欧悬停柏林精致提亮 + 细金描边 + 情报卡（无捷克斯洛伐克红线）
- `shots/europe_diplomacy_showcase.png` — 西中欧外交阵营视角（选中巴黎 + 动态图例）
- `shots/berlin_zoom_political.png` — 柏林周边 2.5× 政治模式（核验手绘感自然省界与德波地名）

## 后续（Batch 02+，本次不在范围内）
- Web Worker 确定性时钟、选国档案袋、三锚点桌面 HUD、经济工业与陆战结算系统
