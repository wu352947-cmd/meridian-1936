# Batch 01 进度追踪 — 《子午线 1936：碎裂大陆》

## 状态：已完成（Batch 01 第 4 轮省界平滑打磨验收通过）

## 已完成清单
- [x] 1. 工程底座：Vite 6 + TypeScript (strict) + PixiJS v8 + Preact + `@preact/signals` + Vitest；生产 `base = /meridian-1936/`
- [x] 2. 1936 欧洲离线地图编译器 (`tools/map-compiler/`)：从 Natural Earth (Public Domain) 下载至 `data/raw/`（已 gitignore），LAEA 欧洲投影生成 **676 陆地省 + 62 海区**，产物提交于 `public/data/europe_1936/`（`topology.topo.json`、`province_id.png`、`terrain_relief.webp`、`europe_1936.json`）
- [x] 3. 第 2 轮边界与地名打磨：
  - 移除现代加里宁格勒-波兰直线切缝及所有拼合微缝（东普鲁士/卡累利阿/克雷西/比萨拉比亚/外喀尔巴阡/南斯拉夫等统一焊合，海/陆双缓冲栅格化保留内湾孔洞）
  - 省界改为 **Natural Earth admin-1 聚合/切分 + 河流切分 + 水密共享边有机曲线**（`organic_borders.py`），消除 Voronoi 直线与尖角
  - 省名重构为 **1936 历史城镇词典 + Natural Earth admin-1 中文名**（带真实地名标签，无 `·甲/乙` 后缀；偏远腹地仅在信息卡显示描述名，地图上自动隐藏）
- [x] 4. 第 3 轮缩放省界与省内层次打磨（不改玩法/数据模型/旗帜）：
  - **中高缩放省界清晰化 (`BorderMeshBuilder.ts`)**：省界改为三层细墨线组合（暖羊皮纸微浅衬底 `1.50px / 0xF0E7D6 / α0.23` + 极细连续墨导引线 `0.44px` + 深棕黑虚线墨笔 `0.90px / 0x261F19 / 5.8-2.4`），LOD 在 `0.90×–4×` 平滑提升，国界保持 `2.05px` 实心重墨明显粗于省界
  - **亚麻纸纹与政治模式浮雕透出 (`provinceLut.ts`)**：着色器新增缩放自适应细密亚麻纤维织纹、水彩纸肌理与极微省际手绘色差，增强政治/外交/工业模式下的山脉丘陵浮雕透出
  - **省内河流、城市点与地形微标 (`TerrainDetailLayer.ts`、`CurvedLabelLayer.ts`、`BorderMeshBuilder.ts`)**：提前中缩放支流与区域城市点显示并补充既有历史城镇三级小圆点；新增基于既有地形数据与 `pickGrid` 边界校验的克制铜版地形微标（平原草纹、针叶林簇、丘陵弧坡、高山峰脊、沼泽芦苇），不新增泛用地名标签
- [x] 5. 第 4 轮省界平滑度打磨（消除不自然的分形锯齿抖动）：
  - **严格保留真实自然边界 (`subdivide_provinces.py`、`organic_borders.py`)**：取消对 Natural Earth admin-1 聚合边界及整国二次通道的抖动覆写；修正 `ne_10m_rivers_europe` 的 `scalerank <= 11` 过滤并用 `linemerge` 拼接连通河段，让奥得河/易北河/多瑙河等真实水系更充分参与省界切分
  - **带限平滑手绘曲线替代高频中点分形 (`organic_borders.py`)**：对剩余人工内部分割边，以端点固定的低频非对称谱桥曲线（`m_max ∈ [2, 5]`、最短半波 ≥ 15px、`amp = min(L * 0.118, 10.2)`、双向回退防碰界）替代原 `base_amp = min(L*0.16, 12.5)` / depth 2–4 高频锯齿分形，水密重构无缝隙无重叠，同时避免回退成直线几何多边形
  - **保持清晰度与地图气质**：`BorderMeshBuilder.ts` 细墨虚线 + 暖羊皮纸衬底与亚麻纸肌理原样保留，重编 `public/data/europe_1936/` 产物并通过全套测试与 6 张截图人工复核
- [x] 6. 字体子集与合规清单：OFL 1.1 霞鹜文楷屏幕阅读版 + 思源黑体 + JetBrains Mono + Cinzel WOFF2 子集（按新地名重子集化，总计 ~447 KB）、原创中性合规 SVG 国旗 (`src/assets/flags/neutralFlags.ts`)、`public/assets/ASSET_LICENSES.json`、`CREDITS.md`
- [x] 7. PixiJS v8 LUT 渲染管线与语义修正：
  - 选中省份 = 该省朱砂外发光 + 柔和水彩内晕 + 所属国极细淡红边界；悬停省份 = 保留纸纹/地形浮雕的暖羊皮纸提亮 + 细古金色/墨色描边；其它国家无多余红线
  - 视口安全裁剪标注 (`CurvedLabelLayer.ts`)：国名/城名/省名整段位于视口安全区内，越界国名优先沿可见弧段重排，放不下则自动隐藏（无裁切、不与图例冲突）
- [x] 8. Vitest 自动化测试（10/10 通过）：省份数、1258 万像素 1-to-1 无漏色、无孤立省与邻接对称、27 处 1936 历史边界坐标（含外喀尔巴阡/南蒂罗尔/伊斯特拉/南多布罗加）、**国界/海岸内部接缝与东普鲁士假直线防回归检测**、可见省名无泛用后缀校验、国旗合规扫描与 URL 解析
- [x] 9. 视觉验收 (`tools/shot.mjs` + SwiftShader 1440×900)：第 4 轮覆写验收的 6 张截图零控制台报错且均已人工逐张核验，存至 `shots/`
- [x] 10. `README.md`、`CREDITS.md`、本地 git commit（未 push）

## 截图验收清单 (`shots/`)
- `shots/overview_political.png` — 全欧 1936 政治版图宏观视角（山脉浮雕自然透出）
- `shots/overview_terrain.png` — 全欧 1936 地形地貌宏观视角
- `shots/danzig_zoom_selected.png` — 但泽自由市 / 波兰走廊 / 东普鲁士 2.75× 特写（省界细墨虚线清晰可读、林区与平原微标克制、无东普鲁士接缝）
- `shots/alps_terrain.png` — 阿尔卑斯与莱茵兰 2.30× 地形地貌模式（省界与森林/山地层次清晰）
- `shots/hover_card.png` — 中欧 1.65× 悬停柏林精致提亮 + 区域城市点与省界清晰 + 合规德国黑白红直臂铁十字旗
- `shots/europe_diplomacy_showcase.png` — 西中欧 1.25× 外交阵营视角（选中巴黎 + 动态图例）
- `shots/berlin_zoom_political.png` — 柏林周边 2.50× 政治模式（细密亚麻纸纹、清晰虚线省界、河流支流与城镇点层次）

## 后续（Batch 02+，本次不在范围内）
- Web Worker 确定性时钟、选国档案袋、三锚点桌面 HUD、经济工业与陆战结算系统
