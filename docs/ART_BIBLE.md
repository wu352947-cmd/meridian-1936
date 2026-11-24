# 《子午线 1936：碎裂大陆》（Meridian 1936）美术圣经与开源资产规范（ART BIBLE）

- **配套主文档**：`DESIGN_carbon.md`
- **适用对象**：`Gemini 4 Neon XHigh` 编码 Agent（直接将本文档中的 Hex 色值、CSS Token、SVG 尺寸与 GLSL 参数写入 `src/ui/styles/tokens.css` 与 `src/render/` 着色器常量）

---

## 1. 核心视觉支柱：“1936 参谋部亚麻制图与电报档案”

全游戏拒绝廉价塑料感高饱和纯色、拒绝科幻霓虹发光边、拒绝画风割裂的 AI 生成油画人物小图。一切视觉元素统一收敛于 **四大战时实物质感**：
1. **微黄亚麻衬底参谋纸（Linen Staff Paper）**：地图与浅色卡片带 `4%` 不透明度的细微纸纤维噪点，温润护眼。
2. **钢笔墨线与矿物水彩晕染（Ink & Mineral Wash）**：国界如钢笔蘸浓墨勾勒，国土着色如矿物水彩沿边境向内自然晕开，透出底层山脉阴影。
3. **胡桃木与哑光暗黄铜（Walnut & Aged Brass）**：HUD 坞站与深色抽屉采用深炭胡桃木底镶 `1px` 细磨砂铜线，克制内敛。
4. **普鲁士蓝晒工程图（Cyanotype Blueprint）**：科技树专属视觉空间，深普鲁士蓝底衬纯白工程制图线与等宽技术铭牌。

---

## 2. 全局调色板规范（Exact Hex Color Palette & CSS Tokens）

### 2.1 地图环境与地形底色 Token
| 用途分类 | Token 名称 | 精确 Hex 值 | 视觉说明 |
| :--- | :--- | :---: | :--- |
| **陆地纸张基底** | `--map-paper-base` | `#EAE2D3` | 无控制区/地形底图叠加前的暖亚麻底色 |
| **深海海盆** | `--map-sea-deep` | `#2B3D4F` | 大西洋与地中海深水区灰青石板蓝 |
| **近岸浅滩海区** | `--map-sea-coastal` | `#435B6E` | 距海岸线 `18px` 内的浅水过渡带 |
| **海岸线浓墨** | `--map-ink-coast` | `#2C2621` | `1.6px` 海岸勾边 |
| **国际国界粗墨** | `--map-ink-border` | `#1E1A17` | `2.2px` 动态主权国界线 |
| **国内省界淡墨** | `--map-ink-prov` | `#6E655C` | `0.7px`（`alpha: 0.45`）省界细线，LOD 0 隐藏 |
| **通航大河墨蓝** | `--map-river-major` | `#3B5C76` | `1.8px` 莱茵/多瑙/维斯瓦/第聂伯/伏尔加干流 |
| **地形模式专用色** | `plains / forest / hills / mountain / marsh / urban / desert` | `#E5DEC9` / `#6F8260` / `#B59E7A` / `#6E5A4B` / `#6B7D78` / `#A65E52` / `#D8C394` | `M2 地形与筑垒模式` 着色器查表色阶 |

### 2.2 欧洲各国政治版图矿物色盘（HSL 低饱和校准，严禁刺眼荧光色）
| 国家 (`TAG`) | 政治主色 Hex | 国家 (`TAG`) | 政治主色 Hex | 国家 (`TAG`) | 政治主色 Hex |
| :--- | :---: | :--- | :---: | :--- | :---: |
| **德意志 (`GER`)** | `#4A555E`（铁青灰） | **大不列颠 (`GBR`)** | `#B86B6B`（帝国暖绯） | **法兰西 (`FRA`)** | `#4B6B94`（矢车菊蓝） |
| **苏联 (`SOV`)** | `#963E3A`（赭石绛红） | **意大利 (`ITA`)** | `#5D7A52`（橄榄苔绿） | **波兰 (`POL`)** | `#A86478`（玫瑰灰紫） |
| **西班牙共和 (`SPR`)** | `#C48A47`（暖琥珀） | **西班牙国民 (`SPA`)** | `#8C6239`（焦赭褐） | **捷克斯洛伐克 (`CZE`)** | `#4E7A7D`（波希米亚青） |
| **奥地利 (`AUS`)** | `#C8BDB0`（维也纳灰白） | **匈牙利 (`HUN`)** | `#8F6B58`（多瑙陶褐） | **罗马尼亚 (`ROM`)** | `#B89C4E`（喀尔巴阡麦黄） |
| **南斯拉夫 (`YUG`)** | `#5B688A`（亚得里亚靛） | **保加利亚 (`BUL`)** | `#687D5B`（巴尔干暗绿） | **希腊 (`GRE`)** | `#5D8AA8`（爱琴海灰蓝） |
| **土耳其 (`TUR`)** | `#5A877A`（安纳托利亚青绿） | **芬兰 (`FIN`)** | `#CAD4DC`（千湖冰白） | **瑞典 (`SWE`)** | `#3E6B89`（北欧群青） |
| **挪威 (`NOR`)** | `#8A5A64`（峡湾暗红） | **丹麦 (`DEN`)** | `#B05B52`（日德兰砖红） | **荷兰 (`HOL`)** | `#C87D4B`（低地暗橙） |
| **比利时 (`BEL`)** | `#A89256`（佛兰德斯芥黄） | **瑞士 (`SWI`)** | `#A84642`（阿尔卑斯红） | **葡萄牙 (`POR`)** | `#4E7861`（里斯本松绿） |
| **波罗的海三国 (`LIT/LAT/EST`)** | `#9E8B5C` / `#7D4E52` / `#5C7A8E` | **爱尔兰 / 卢森堡 / 阿尔巴尼亚** | `#5E8A66` / `#7CA2B8` / `#7A4448` | **维希行政区 (`VIC`)** | `#6E7B8B`（铅蓝灰） |

### 2.3 UI 表面、语义状态与 Okabe-Ito 色盲安全映射表
| 语义角色 | CSS 变量名 | 标准模式 Hex | **色觉无障碍模式（Okabe-Ito）Hex** |
| :--- | :--- | :---: | :---: |
| **深色面板底（抽屉/顶栏）** | `--ui-bg-panel` | `#1E1C1A`（`94%` 不透明） | `#1E1C1A` |
| **次级卡片底 / 表格斑马纹** | `--ui-bg-elevated` | `#2A2724` | `#2A2724` |
| **电报纸 / 方略公文浅色底** | `--ui-paper-card` | `#F4EFE6`（墨字 `#221F1D`） | `#F4EFE6` |
| **科技蓝晒图纸底 / 线条** | `--ui-blueprint-bg / line` | `#142B42` / `#E6F2FF` | `#142B42` / `#E6F2FF` |
| **哑光黄铜描边 / 激活高光** | `--ui-border-brass / gold` | `#6E5D42` / `#C5A059` | `#6E5D42` / `#E69F00` |
| **正向 / 己方优势 / 补给充裕** | `--ui-status-positive` | `#4E8A57`（森林翠绿） | **`#0072B2`（高辨识钴蓝）** |
| **警告 / 闲置槽位 / 补给吃紧** | `--ui-status-warning` | `#C8933E`（琥珀金） | **`#F0E442`（明柠檬黄）** |
| **负向 / 敌方封锁 / 缺口断粮** | `--ui-status-danger` | `#B83A2D`（朱砂印红） | **`#D55E00`（朱橙红）** |

---

## 3. 字体层级与中文精排规范（Typography Scale）

| 排版层级 | 首选开源 WebFont | 系统瞬时回退栈 | 字号 / 行高 / 字重 | 强制排版规则 |
| :--- | :--- | :--- | :---: | :--- |
| **H1 选国大标题 / 终局卷首** | `LXGW WenKai Screen` | `'Songti SC', 'Noto Serif SC', serif` | `28px / 1.30 / 600` | 字距 `letter-spacing: 0.06em` |
| **H2 抽屉主标题 / 电报抬头** | `LXGW WenKai Screen` | `'Songti SC', serif` | `18px / 1.35 / 600` | 配合底部 `1px` 黄铜分割线 |
| **H3 方略节点名 / 卡片小标** | `Noto Sans SC` | `'PingFang SC', 'Microsoft YaHei', sans-serif` | `14px / 1.40 / 600` | 严禁截断，单行超长自适应字号微缩 |
| **Body 面板正文 / 事件叙述** | `Noto Sans SC` | `'PingFang SC', 'Microsoft YaHei', sans-serif` | `13px / 1.55 / 400` | 电报叙述限宽 `46ch` 提升阅读舒适度 |
| **Mono 数值 / 日期 / 修正表** | `JetBrains Mono` | `'Consolas', ui-monospace, monospace` | `12px~14px / 1.35 / 500` | **全局强制 `font-variant-numeric: tabular-nums`** |
| **地图弯曲国名（大写/中文）** | `LXGW WenKai` + `Cinzel` | `serif` | 动态 `14px~42px` | 浅米白字 `#F5F0E6` 配 `2.5px` 深炭褐外描边 `#1E1A17` |

## 4. 地图四级缩放（LOD 0~3）视觉规则与 Shader 参数

### 4.1 片元着色器（`provinceLut.frag`）核心视觉公式
1. **水彩国界内晕染（Inner Border Tint）**：
   - 采样邻域检测距最近国际国界的屏幕空间距离 $d \in [0, 14]\text{ px}$：
   - 色彩混合权重 $\alpha_{\text{fill}} = \text{mix}(0.72, 0.36, \text{smoothstep}(0.0, 12.0, d))$。国界内侧浓艳定界，向内陆平滑减淡为 `36%` 半透明，使底层 `terrain_relief.webp` 的阿尔卑斯/喀尔巴阡山脉立体晕渲与亚麻纸纹清晰透出。
2. **战时占领斜纹（Occupation Hatching）**：
   - 当某省 `controller !== coreOwner` 时，按屏幕坐标 `mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) < 3.5` 交替渲染法理国底色与占领国 `68%` 不透明度斜条纹。
3. **外交目标圈选光晕**：点击某国打开外交抽屉时，沿该国全部国际边界外侧叠加 `4px` 宽朱砂红（`#B83A2D`）柔和内发光，宣战预览目标国叠加 `8px` 间距交叉警戒线。

### 4.2 四档语义缩放层级显隐矩阵（Semantic Zoom Visibility）
| 视觉图层元素 | **LOD 0 洲际层** (`zoom < 1.1`) | **LOD 1 战役层** (`1.1 ≤ zoom < 2.2`) | **LOD 2 战术层** (`2.2 ≤ zoom < 3.8`) | **LOD 3 详查层** (`zoom ≥ 3.8`) |
| :--- | :---: | :---: | :---: | :---: |
| 国际国界粗墨线 (`2.2px`) & 弯曲国名 | 显示 | 显示 | 显示（大国名渐隐至 `25%` 防挡视线） | 隐藏大国名 |
| 国内省界虚线 (`0.7px`) | **隐藏** | 半透明 `0.25` | 清晰 `0.55` | 清晰 `0.70` |
| 主要通航大河 & 首都五角星 | 仅首都星标 | 显示大河 + `VP ≥ 5` 都市 | 显示全部河网 + 全部城市/港口/机场标 | 同左 + 建筑等级数字 |
| 连续战线与进攻大箭头 | 简化粗线 | 标准齿状战线 + 流动条纹箭头 | 高清齿状战线 + 箭头印集团军名 | 同左 |
| 陆军战术军牌（Counters） | **按集团军聚合为大徽牌** | **同省自动叠牌显示总旅数** | **展开单旅/叠牌 + 绿橙双进度条** | 同左 + 显示旅番号 |
| 省份中文地名与补给百分比角标 | **隐藏** | **隐藏** | 仅交战省与鼠标悬停省显示 | **全省份清晰显示** |

---

## 5. 改良北约战术军牌（Unit Counters）与图标规范

### 5.1 `44 × 28 px` 战术军牌像素解剖图
```text
+------------------------------------------+  <- 1px 深墨外框 #1A1816，圆角 rx=3px，底部 2px 投影
| [10x7旗] |   [18x12 白底北约军标]   | 04 |  <- 左：国家主色底+中性小旗；中：几何兵种标；右：等宽旅数
|==========|==========================|====|
| ████████████████████░░░░░░ (翠绿组织度条) |  <- 高 3px (#4E8A57 / 色盲 #0072B2)
| ████████████████████████░░ (琥珀实力条)   |  <- 高 3px (#C8933E / 色盲 #E69F00)
+------------------------------------------+
```
- **6 类标准作战旅纯几何矢量军标（`1.5px` 黑线绘于 `#F4EFE6` 象牙白内框上）**：
  1. **主力步兵旅 (`INF`)**：标准对角十字交叉线（`X` 满撑内框）；
  2. **山地猎兵旅 (`MTN`)**：对角交叉线 + 底边中央实心小三角山峰（`▲`）；
  3. **摩托化步兵旅 (`MOT`)**：对角交叉线 + 底框下方并列两枚 `r=2px` 车轮圆圈；
  4. **装甲突击旅 (`ARM`)**：水平居中椭圆履带环（长轴 `12px`，短轴 `6px`）；
  5. **重炮支援旅 (`ART`)**：正中央一枚 `r=3.5px` 实心黑圆点（二线支援旅外框左上角额外切一金色小斜角以示区分）；
  6. **守备警备旅 (`GAR`)**：单条左下至右上斜杠 + 中央微型盾牌轮廓。
- **UI 图标统一规范**：全局功能图标采用 `18×18px` / `20×20px` 规格，统一 `stroke-width: 1.75px` 圆头线框风格（Lucide / Phosphor）；军工装备剪影（Game-icons）统一去色转为单色暖金灰（`#D6C7AE`）衬于深灰底槽上，严禁五颜六色卡通图标混排。

---

## 6. 中性合规国旗规范与 UI 组件样式准则

### 6.1 重点国家中性国旗 SVG 精确色值规范（比例统一 `3:2`）
> **用户决策（2026-11-25 已拍板）**：德国旗 = 黑白红三色 + 中心直臂铁十字 Balkenkreuz；意大利三色 + 萨伏依盾、无束棒；苏联简化红旗；日本日之丸。严禁卐字与 SS 符文。
- **德意志 (`GER`)**：上黑 `#1C1C1C`、中白 `#F2EFE9`、下红 `#B52B27` 等高横三色；中心叠一枚宽高 `40%` 旗高的黑白直臂几何铁十字（**严禁任何倾斜万字符或党卫军折线**）。
- **意大利 (`ITA`)**：左绿 `#007A3D`、中白 `#F2EFE9`、右红 `#C82829` 竖三色；中央嵌蓝底 `#1E4D8C` 白十字萨伏依简盾（**严禁束棒**）。
- **苏联 (`SOV`)**：深绛红底 `#9E2421`，左上角绘制一枚纯几何五角金星 `#E0B445`（无复杂镰锤细碎锯齿或人物头像，在小尺寸 10×7px 下依然极度清晰）。
- **日本 (`JPN`，外交提及与后续亚太包)**：纯米白底 `#F5F3EE` 正中心绘直径为旗高 `3/5` 的正红圆盘 `#BC002D`（**日章旗 Hinomaru，严禁任何放射光芒条纹**）。
- **西班牙 (`SPR` / `SPA`)**：共和派为红 `#B8292F` - 黄 `#E5B53A` - 紫 `#63326E` 横三色；国民派为 `1:2:1` 红-黄-红双色横条简旗（无鹰徽）。

### 6.2 四类核心 UI 组件样式规范
1. **参谋按钮（Staff Button）**：默认态 `#2C2824` 底 + `1px solid #6E5D42` 铜线；悬停态提亮至 `#3A342E` + 铜线变亮金 `#C5A059`；按下态下沉 `translateY(1px)`；禁用态不透明度 `0.42` 且悬停仍须弹出解释“为何不可点（如：需欧洲危机度 ≥ 25%）”的红字原因提示！
2. **内嵌数据条对比表（Bar-in-Cell Table）**：用于行政区工业表与占领总览表，数值单元格背景用 `linear-gradient(90deg, rgba(197,160,89,0.28) var(--pct), transparent var(--pct))` 直接绘出横向比例尺。
3. **加急电报纸弹窗（Dispatch Card）**：背景 `#F4EFE6`，顶部印双道朱砂红横杠与等宽电报编号（如 `DISPATCH // 1938-09-29-MUC`），右上角斜盖 `rotate(-8deg)` 半透明红色圆章。
4. **蓝晒科技节点卡（Blueprint Node）**：未研发为 `#142B42` 底配虚线白框；研发中亮起琥珀流动进度边框；已研发转为实心浅普鲁士蓝 `#234B6E` 配亮白勾标。

---

## 7. 美术与内容绝对禁止事项清单（10 Hard Redlines）

1. **严禁出现纳粹卐字（Swastika）、SS 双闪电符文、法西斯束棒（Fasces）、日本十六道旭日战旗**于任何像素、SVG、字体字形或测试截图中。
2. **严禁直接拷贝、描摹或裁剪**《钢铁雄心 4》与《文明时代 3》的任何 UI 边框切图、国策徽章、地图省份轮廓、科技图标或官方手册画面。
3. **严禁将 `ref/` 目录下的任何内部参考图片**复制进 `public/`、`src/` 或提交到 Git 历史。
4. **严禁使用 AI 生成的油画人物头像、写实士兵半身像或风格杂乱的建筑小插画**。
5. **严禁在产品中描绘平民伤亡、战俘虐待、种族迫害或美化任何极权暴行的文字与图像**。
6. **严禁引入任何带 `NC`（非商业，如 CShapes 2.0、GADM、英国 IWM 博物馆图）或 `ND`（禁止演绎）的第三方素材**。
7. **严禁将不可单独公开再分发的商业免版税音效原文件（如 Sonniss GDC 原始 wav）直接推入公开 GitHub 仓库**。
8. **严禁对 `province_id.png` 开启双线性插值（`LINEAR`）或有损压缩（WebP/JPEG）**，必须保持无损 PNG + `NEAREST` 采样。
9. **严禁使用高饱和荧光纯色（如 `#FF0000`、`#00FF00`、`#0000FF`）填充国家领土或海洋**。
10. **严禁出现无等宽对齐的跳动数字列，或因定宽容器过窄导致的中文生硬截断省略**。

## 8. 完整合规开源素材清单总表（与主设计文档完全一致）

下表列出允许进入仓库 `public/assets/` 的全部已核验开源与公有领域资产，入库时须同步写入 `public/assets/ASSET_LICENSES.json` 并在 `CREDITS.md` 及游戏内【关于与开源致谢】面板完整展示：

| 资产名称 | 项目内具体用途 | 准确官方 URL | 许可证 | 署名与合规执行要求 |
| :--- | :--- | :--- | :---: | :--- |
| **Natural Earth v5.x (1:10m Cultural & Physical)** | 欧洲海岸线、河流、湖泊、高程阴影底图及一级行政区切割基底 | `https://www.naturalearthdata.com/` <br>(`https://github.com/nvkelso/natural-earth-vector`) | **Public Domain (CC0)** | 无需强制署名；礼貌列入 `CREDITS.md` |
| **geoBoundaries v6.0** | 东欧/巴尔干局部二级行政边界细分参考 | `https://www.geoboundaries.org/` <br>(`https://github.com/wmgeolab/geoBoundaries`) | **CC BY 4.0** | **必须署名**：在致谢中引用 `Runfola, D. et al. (2020) geoBoundaries, PLoS ONE` 及 CC-BY 4.0 链接 |
| **霞鹜文楷（LXGW WenKai Screen）** | 游戏主标题、国家印章名、电报正文、方略树节点标题中文字体 | `https://github.com/lxgw/LxgwWenKai` | **SIL OFL 1.1** | 保留字体版权声明于仓库 `public/fonts/OFL.txt` 并列入致谢，构建期用 `cn-font-split` 切片 |
| **思源黑体（Noto Sans CJK SC）** | 高密度 UI 面板正文、表格、Tooltip 小字号清晰无衬线字体 | `https://github.com/notofonts/noto-cjk` | **SIL OFL 1.1** | 同上，保留 OFL-1.1 文本并列入致谢 |
| **思源宋体（Noto Serif CJK SC）** | 备选公文衬线标题与终局历史档案册字体 | `https://github.com/notofonts/noto-cjk` | **SIL OFL 1.1** | 同上，保留 OFL-1.1 文本并列入致谢 |
| **JetBrains Mono** | 全部资源数字、日期时钟、战斗百分比与对齐表格等宽数字 | `https://github.com/JetBrains/JetBrainsMono` | **SIL OFL 1.1** | 同上，仅子集化提取 ASCII 数字与符号（`< 18 KB` woff2） |
| **Cinzel** | 地图远景拉丁/西文古典衬线装饰字与罗马数字刻度 | `https://github.com/NDISCOVER/Cinzel` | **SIL OFL 1.1** | 同上，保留 OFL-1.1 声明 |
| **Lucide Icons** | 通用 UI 控件图标（关闭、保存、筛选、锁定、音量、时间拨杆、搜索） | `https://lucide.dev/` <br>(`https://github.com/lucide-icons/lucide`) | **ISC License** | 宽松开源，保留 ISC 版权说明于 `CREDITS.md` |
| **Phosphor Icons** | 政务法令、外交行动、天气气候与海空状态线框图标 | `https://phosphoricons.com/` <br>(`https://github.com/phosphor-icons/core`) | **MIT License** | 宽松开源，保留 MIT 版权说明于 `CREDITS.md` |
| **Game-icons.net** | 军工装备剪影（步枪、榴弹炮、卡车、防空炮、港口锚标、油桶、齿轮） | `https://game-icons.net/` <br>(`https://github.com/game-icons/icons`) | **CC BY 3.0** | **必须逐作者署名**：在 `CREDITS.md` 与游戏内面板明确列出使用图标的创作者（如 Lorc, Delapouite, Skoll）及 CC-BY 3.0 链接 |
| **自研纯 SVG 北约改良军标** | 6 种陆军作战旅战术符号与三色中性几何国旗 | 仓库内联生成 `src/assets/counters/` & `flags/` | **MIT / CC0（原创）** | 纯几何图形代码自绘，100% 原创无外部版权负担 |
| **Wikimedia Commons 公有领域历史民用国旗** | 1936 欧洲 29 国中性历史民用三色旗比例与色值校对（逐枚核验） | `https://commons.wikimedia.org/wiki/Category:SVG_historical_flags` | **Public Domain (`PD-shape` / `PD-ineligible`)** | 仅选取简单几何色块构成的 `PD-shape` 公有领域旗帜；若个别纹章含 `CC BY-SA` 则改用代码自绘简化几何盾徽 |
| **ambientCG 纸张与织物 PBR 纹理** | 参谋地图底层无缝亚麻纸张纤维贴图（取 Roughness/Color 通道降采样） | `https://ambientcg.com/`（`Paper001`–`Paper006`, `Fabric` 分类） | **CC0 1.0** | 完全公有领域，礼貌列入 `CREDITS.md` |
| **Poly Haven 纹理库** | 底部公文坞站深胡桃木细纹与磨砂黄铜微噪点贴图 | `https://polyhaven.com/textures` | **CC0 1.0** | 完全公有领域，礼貌列入 `CREDITS.md` |
| **Kenney UI Pack & Game Assets** | 九宫格按钮切图参考、面板滑块轨道与光标基础原型 | `https://kenney.nl/assets` | **CC0 1.0** | 完全公有领域，礼貌署名 `Kenney (www.kenney.nl)` |
| **Library of Congress (LoC) / US National Archives (NARA)** | （可选）选国档案袋与终局纪实背景黑白无版权建筑/工业老照片 | `https://www.loc.gov/free-to-use/` <br>`https://catalog.archives.gov/` | **Public Domain (US Gov / No Known Restrictions)** | 仅限选用明确标有 `No known restrictions on publication` 的公有领域条目，严禁选用含人物暴行或违禁符号照片 |
| **Musopen 公有领域古典管弦录音** | 和平期与史诗战争期古典交响背景配乐（如霍尔斯特、德沃夏克、贝多芬公有领域录音） | `https://musopen.org/music/`（筛选 `Public Domain Mark 1.0 / CC0`） | **Public Domain / CC0**（部分标注曲目为 **CC BY 3.0**） | 入库前逐曲核验许可证标签：CC0 直接入库，CC-BY 曲目在致谢中完整标注演奏乐团与链接 |
| **Incompetech (Kevin MacLeod)** | 危机酝酿期低沉弦乐与参谋室环境背景乐 | `https://incompetech.com/music/royalty-free/music.html` | **CC BY 4.0** | **必须标准格式署名**：`"[Track Title]" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License` |
| **Kenney Audio (UI Audio / Interface Sounds / Impact Sounds)** | 按钮清脆卡扣、卷宗抽屉翻页、木质印章敲击音效 | `https://kenney.nl/assets/category:Audio` | **CC0 1.0** | 完全公有领域，可自由随公开 GitHub 仓库再分发 |
| **OpenGameArt.org (CC0 战争与电报音效精选)** | 机械打字机敲击、摩尔斯电报滴答、远方低沉炮火闷雷 | `https://opengameart.org/`（严格限定过滤 `License: CC0`） | **CC0 1.0** | 仅下载明确标记 `CC0` 的音效包，记录原页面 URL 于 `CREDITS.md` 备查 |

---

### 8.1 `ASSET_LICENSES.json` 标准条目结构示例
```json
[
  {
    "assetId": "font_lxgw_wenkai",
    "files": ["public/assets/fonts/lxgw-wenkai-subset-*.woff2"],
    "title": "LXGW WenKai Screen (霞鹜文楷屏幕阅读版)",
    "author": "LXGW & Fontworks (Klee One)",
    "sourceUrl": "https://github.com/lxgw/LxgwWenKai",
    "license": "SIL Open Font License 1.1",
    "licenseUrl": "https://openfontlicense.org/",
    "modifications": "Subsetted to WOFF2 slices via cn-font-split"
  }
]
```
*(ART_BIBLE.md 全文完)*
