# 《子午线 1936：碎裂大陆》（Meridian 1936）

基于 **Vite + TypeScript (strict) + PixiJS v8 + Preact (@preact/signals)** 构建的 1936 欧洲历史大战略参谋地图工程（当前交付 **Batch 01：工程底座、1936 欧洲离线地图编译器与可交互参谋地图**）。

## 视觉与技术特点（Batch 01）
- **原创“1936 参谋部亚麻制图”画风**：暖亚麻纸底纹、灰青石板海盆与近岸等深水纹、低饱和矿物国家色、钢笔粗墨国界 + 淡墨虚线省界、国界内侧水彩晕染、欧洲主要大河与 10° LAEA 经纬网。
- **1936 年历史版图离线编译**：由公有领域 Natural Earth 1:10m/1:50m 数据经 LAEA 欧洲等积方位投影（10°E, 52°N）重构 **677 个陆地省 + 62 个海域分区**，精确还原但泽自由市、波兰走廊、东普鲁士飞地、德国萨尔兰与西里西亚、捷克斯洛伐克与苏台德防线、独立奥地利、芬苏卡累利阿旧界、波兰克雷西与维尔诺、立陶宛梅梅尔与考纳斯、大罗马尼亚（含比萨拉比亚）、独立阿尔巴尼亚、爱尔兰自由邦、冰岛与土耳其欧洲部分。
- **GPU LUT 片元着色 + O(1) 像素拾取**：`province_id.png`（4096×3072 无损、NEAREST、无预乘 Alpha）配合 `4096×1` 查表纹理实现 4 种地图模式秒切（政治版图 / 地形地貌 / 外交阵营 / 工业资源），支持 4 级语义缩放 LOD、沿国土主脊贝塞尔弯曲排布的中文国名与屏幕空间防重叠标注。
- **合规中立设计**：全套国家旗帜为原创纯几何 SVG（德国黑白红+中心直臂铁十字 Balkenkreuz，意大利三色+萨伏依蓝盾无束棒，苏联简化金星红旗，日本日之丸）；严禁违禁符号；全部开放素材详见 [CREDITS.md](CREDITS.md) 及应用内“关于 / 致谢”面板。

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

# 运行拓扑、1936 边界与合规单元测试
npm test
```

## 离线重新编译地图（可选，产物已随仓库提交）
仓库已包含编译产物 `public/data/europe_1936/`，构建与运行完全不依赖网络。如需从 Natural Earth 重新编译：
```bash
npm run build:map
```

## 快捷键与调试 URL 参数
- 地图模式：`Q` 政治 / `W` 地形 / `E` 外交 / `R` 工业（或 `1`–`4`）
- 视口控制：鼠标左键拖拽平移、滚轮缩放、`+`/`-` 缩放、`H` 重置全欧视角、`Esc` 清除选中或关闭弹窗
- 调试参数：`?autotest=1&mapmode=political|terrain|diplomacy|industry&cam=x,y,zoom&selectProv=<id>&hoverProv=<id>&lang=zh`
- 无头截图（SwiftShader）：
  ```bash
  node tools/shot.mjs --url "http://localhost:4173/meridian-1936/?autotest=1" --out shots/capture.png --w 1440 --h 900 --wait 400
  ```
