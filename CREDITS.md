# 开源素材与数据致谢（CREDITS & LICENSES）

《子午线 1936：碎裂大陆》（Meridian 1936: Shattered Continent）坚持使用 100% 开放商用安全许可（Public Domain / CC0 / SIL OFL 1.1 / MIT / ISC）的数据与字体素材，拒绝任何含非商业（NC）或禁止演绎（ND）条款的第三方资源。

全部运行期外部素材均同步登记于 [public/assets/ASSET_LICENSES.json](public/assets/ASSET_LICENSES.json)，并在应用内“关于 / 致谢”面板完整呈现。

---

## 1. 地理与地图数据（Cartographic Data）

| 素材名称 | 用途 | 来源 URL | 作者 | 许可证 |
| :--- | :--- | :--- | :--- | :--- |
| **Natural Earth v5.x (1:10m Cultural & Physical)** | 欧洲海岸线、行政区基底、河流、湖泊及主要城市点（离线重投影为 LAEA 欧洲并重构为 1936 年历史国界） | https://www.naturalearthdata.com/ | Natural Earth Contributors (Tom Patterson, Nathaniel Vaughn Kelso 等) | **Public Domain (CC0 Equivalent)** |
| **Natural Earth 1:50m Shaded Relief & Hypsometric Tints (`GRAY_50M_SR_OB`, `HYP_50M_SR`)** | 欧洲山地立体晕渲与海盆地形底图（融合程序化亚麻纸纹与近岸浅海过渡） | https://www.naturalearthdata.com/downloads/50m-raster-data/ | Natural Earth Contributors | **Public Domain (CC0 Equivalent)** |

---

## 2. 开源字体（Open-Source Fonts）

| 字体名称 | 用途 | 来源 URL | 作者 | 许可证 |
| :--- | :--- | :--- | :--- | :--- |
| **霞鹜文楷屏幕阅读版（LXGW WenKai Screen v1.530）** | 地图弯曲中文国名、主标题与省名展示（已按字符集子集化为 WOFF2） | https://github.com/lxgw/LxgwWenKai-Screen | LXGW（落霞孤鹜）& Fontworks Inc. (Klee One) | **SIL Open Font License 1.1** |
| **思源黑体（Noto Sans CJK SC）** | 界面卡片正文、城市与省份标注（已子集化为 WOFF2） | https://github.com/notofonts/noto-cjk | Google & Adobe | **SIL Open Font License 1.1** |
| **JetBrains Mono** | 坐标、缩放倍数与等宽数值（已子集化为 WOFF2） | https://github.com/JetBrains/JetBrainsMono | JetBrains s.r.o. | **SIL Open Font License 1.1** |
| **Cinzel** | 地图西文衬线与装饰字（已子集化为 WOFF2） | https://github.com/NDISCOVER/Cinzel | Natanael Gama (NDISCOVER) | **SIL Open Font License 1.1** |

字体完整许可说明见 [public/assets/fonts/OFL.txt](public/assets/fonts/OFL.txt)。

---

## 3. 图形、国旗与软件栈（Original Art & Libraries）

- **1936 中性合规几何国旗 SVG、首都版画剪影、陆战印章与后勤气候图标**（[src/assets/flags/neutralFlags.ts](src/assets/flags/neutralFlags.ts)、[src/assets/landmarks/capitalLandmarks.ts](src/assets/landmarks/capitalLandmarks.ts)、[src/assets/icons/combatIcons.ts](src/assets/icons/combatIcons.ts)、[src/assets/icons/logisticsIcons.ts](src/assets/icons/logisticsIcons.ts)）：本项目 100% 原创纯几何 SVG 绘制（MIT / CC0）。德意志采用黑白红横三色配中心直臂铁十字（Balkenkreuz），意大利采用三色配萨伏依蓝盾（无束棒），苏联采用简化金星红旗，日本采用日之丸；零领袖肖像，全仓库严禁任何纳粹卐字、SS 符文、束棒或旭日战旗。补给源星标、海港锚标、缺粮油桶警报与季节冰霜/泥渍纹理全部由自绘矢量与程序化着色器生成。
- **核心开源引擎与工具**：PixiJS v8 (MIT)、Preact & `@preact/signals` (MIT)、Vite (MIT)、Vitest (MIT)、TopoJSON Client (ISC)、Mapshaper (MPL-2.0，仅构建期离线编译使用)、Shapely / PyProj / Pillow / NumPy / SciPy / fontTools（仅离线地图与字体编译期使用）。
