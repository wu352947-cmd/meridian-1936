# Batch 08 简报：国家方略树引擎（6 大国专属 + 通用树）、EffectRunner，与 28 链加急电报事件

依据 `docs/DESIGN_carbon.md`：§11 Batch 08、§4.4（国家方略树与政务法令）、§4.5（历史与动态电报事件）、§6.1 / §6.2（F1 入口与中央纸卷模态）、§12.1–12.2（数据目录与 `ConditionExpr` + `EffectAction` + `Modifier` 契约），以及 ART_BIBLE §6.2 电报纸规范。在现有代码（Worker 时钟、法令三槽 `GovernanceDrawer`、科技树模态、产业/人力/陆军/陆战/补给天气、`urlHarness`、`BottomCommandDock` F1 夹签）上扩展。**不要重写**地图、HUD、Worker 骨架、已完成的法令切换、蓝晒科技树和第六/七批战斗与补给系统。**不要开始 Batch 09 及以后**（不做完整外交矩阵、宣战预览、和约大会、海空军、占领抵抗、存档/声景）。外交、宣战、附庸、割地只需本批事件/方略所需的最小效果桩（改归属、开战旗、互不侵犯、担保、新建 `SPA`/`VIC`），不要实现第九批整套外交 UI。

国家标签一律沿用现有三字码：英国是 `GBR`（不是 `ENG`）。`SPA` 国旗已在 `neutralFlags.ts`（国民派红-黄-红简旗，无鹰徽）；`VIC` 若新建，须自绘中性简旗并登记许可证，禁止法西斯符号。

## 0. 先看现状与参考
- 先打开 `shots/b7_logistics_drawer.png`、`shots/b7_battle_report_supply.png`，以及现有 F1 `GovernanceDrawer`（法令已实装，方略仍是占位）、F2 蓝晒科技树模态（中央磨砂纸卷的尺寸与开关方式可作结构参考，视觉必须改成电报纸而非蓝晒）。
- 现有数据包惯例：JSON 放 `public/data/europe_1936/`（科技树已这样加载）。本批按 §12.1 写入 `public/data/europe_1936/directives/` 与 `public/data/europe_1936/events.json`。
- 可选：仓库外内部参考 `/workspace/hoi4-aoh3-research/screenshots-internal/`（就地读取，只学可读性）。**不得复制其界面/图标/美术，绝不把这些图复制、链接或引用进仓库的任何被提交文件。**

## 1. 模拟：EffectRunner（通用修饰符与效果执行器）
- 按 §12.2 做成声明式解释器，方略完成与电报选项共用，禁止在各国树里写死分支逻辑。
- 实现 `ConditionExpr`（至少：`minDate` / `maxDate`、`completedDirective`、`ownsProvince` / `ownsRegion` / `provinceControlledBy`、`crisisAtLeast`、`atWar`、`hasLaw`、以及可组合的 `all` / `any` / `not`）。
- 实现 `EffectAction`（至少覆盖本批树与 28 事件所需）：`ADD_MODIFIER`、`ADD_BUILDING`、`ADD_TECH_BONUS`、`ADD_AP` / `ADD_COHESION`、`ADD_CRISIS`、`ADD_EQUIPMENT` / `ADD_MANPOWER`、`TRANSFER_PROVINCES`（含核心宣称更新）、`CREATE_COUNTRY` / `ANNEX_COUNTRY`、`CREATE_PUPPET`、`DECLARE_WAR` / `WHITE_PEACE`、`SIGN_NON_AGGRESSION`、`SET_GUARANTEE`、`SPAWN_VOLUNTEER_BRIGADE`。修饰符用定点千分比，确定性，写入现有国家/世界状态。
- 领土大规模变更后调用既有弯曲国名重拟合接口（若尚未对外暴露，加一个安全的 `rebuildAffected` 入口）；不要改拟合算法本身。

## 2. 模拟：国家方略树（`src/sim/systems/directiveSystem.ts`）
- 同一时刻每国只能签批 **1** 项国家方略；耗时 **28** 或 **42** 天；推进期间每日消耗 `0.5 AP`；中途中止退还已走天数的 50%，不返还 AP。
- 数据：`public/data/europe_1936/directives/{ger,gbr,fra,sov,ita,pol,generic}.json`，外加 4 项常设方略（可放 `standing.json` 或写在 generic 旁）。节点字段以 §12.2 为准，布局坐标用声明式 **`(col, row)`**（不要用自由 `x,y` 像素）。
- **6 国专属树（严格按 §4.4 的支线结构，节点数不可少）**，均含「经济重整 6–7 + 三军改革 6–7 + 地缘外交与战争 8–10（含 1 组历史/架空互斥分叉 `[!]`）」：
  - `GER` 24：四年工业计划 / 合成燃油；机动装甲学派；莱茵兰重武装 → 德奥合并 → 苏台德危机 → 但泽最后通牒 → 西线黄案 / 东线攻略。架空互斥：遏制激进扩张、重建中欧防务同盟。
  - `GBR` 22：影子工厂 / 雷达防空链；皇家海空协同；绥靖克制（危机度 ≥25% 解锁重整军备）→ 担保波兰 → 地中海与大西洋护航 → 诺曼底第二战场。架空互斥：帝国孤立防御 vs 大陆均势干涉。
  - `FRA` 22：化解政治僵局（消除初期凝聚度惩罚）/ 扩建阿尔卑斯与马奇诺；装甲师独立建制；巩固英法同盟 vs **小协约国主动东进**。架空互斥：慕尼黑强硬保卫捷克斯洛伐克，提前引爆 1938 德法战争。
  - `SOV` 24：五年重工东迁乌拉尔 / 矿冶扩产；军官团整肃与重建（短期降低组织度上限，完成后解锁大纵深反击红利）；集体安全外交 vs 东方缓冲带条约 → 卫国总体动员。
  - `ITA` 20：波河工业整合 / 地中海船坞扩建；北非公路补给线；钢铁盟约 vs **罗马多瑙河独立阵营**（拉拢奥匈保中立或背刺争霸地中海）。
  - `POL` 20：中央工业区（COP）；华沙筑垒与反坦防线；依托西方担保 vs **海间联邦**（联合波罗的海与罗马尼亚自建第四阵营）。
- **通用树 16 节点**：西班牙、捷克、罗马尼亚、匈牙利、芬兰、南斯拉夫、土耳其、瑞典等全部次要国家共用。含本土工业扩容（+3 民工 / +3 军工）、额外科研槽、国土防卫，以及靠拢三大阵营或武装中立。
- **4 项常设方略**：完成本国 ≥10 个方略节点后解锁，不限次数，持续生效直至切换——军工超负荷运转（军工产出 +10%）、战伤工程抢修（建筑修复 +50%）、海空护航建造（船坞产出 +15%）、绥靖抚慰占领区（占领地抵抗每日 -0.3%，占领系统未做完可先把修正写入状态并在 UI 标注「后续批次生效」）。
- AI：默认「史实 AI 方略」按预设历史队列点选；关闭后按 `aiWeight.alt` 加权随机。不要改现有法令 AI。
- F1 抽屉里那句「国家方略将在后续批次实装」必须去掉，改为显示当前签批进度、可用节点摘要，并提供打开全屏方略树的入口。

## 3. 模拟：28 链加急电报（`src/sim/systems/eventEngine.ts`）
- 声明式表：`public/data/europe_1936/events.json`。触发器至少支持 `{ minDate, completedDirective, provinceControlledBy, fireOnce: true }`，选项为 `{ label, effects, aiChance }`。需抉择电报对玩家自动暂停；AI 在同 Tick 内按 `aiChance` 与国力比立即决断，不阻塞模拟。普通新闻可进右上流水账（若尚无流水账，做一条最小列表即可，不要做成第九批外交日志）。
- **必须能跑通的验收路径（1936 开局）**：莱茵兰 → 西班牙内战地图动态分裂出 `SPA`（西属摩洛哥、塞维利亚与北部堡垒省划归国民派，共和派仍为 `SPR`）并发送志愿军电报（德意苏法：划拨 1500 步枪 + 1 个作战旅编制，获陆战学说加成）→ 不流血德奥合并 → 慕尼黑苏台德 3 个山地要塞省割让；**或**法国强硬拒绝慕尼黑，1938 提前开战。
- 另外必须实装：波希米亚肢解与梅梅尔索取（危机度破 50% 时英国自动解锁波兰担保电报）、莫洛托夫-里宾特洛甫密约（波战结束按约移交东波兰）、冬季战争（索取卡累利阿；芬兰坚守 90 天或守住赫尔辛基可触发莫斯科停战，割 2 边境省体面停战，不强制亡国）、法兰西停战（巴黎陷落且投降进度达标：北法与大西洋沿岸德占，南部与北非成立中立傀儡 `VIC`，英国同步自由法国抵抗电报）。
- 凑满 **28** 条独立事件 ID（一条链可含多条电报，但 `events.json` 必须恰好 28 条、ID 稳定），建议清单（可微调标题，不可砍掉加粗项）：
  1. **`rhineland_remilitarization`** 2. **`spanish_civil_war`** 3. **`scw_volunteers`** 4. `anti_comintern_pact` 5. **`anschluss`** 6. **`munich_crisis`** 7. `first_vienna_award` 8. **`bohemia_dismemberment`** 9. **`memel_ultimatum`** 10. **`british_guarantee_poland`** 11. `pact_of_steel` 12. **`molotov_ribbentrop`** 13. `danzig_ultimatum` 14. `poland_partition` 15. `western_war_entry` 16. **`winter_war`** 17. **`moscow_armistice`** 18. `scandinavian_campaign` 19. **`vichy_armistice`** 20. **`free_france`** 21. `britain_alone` 22. `barbarossa` 23. `lend_lease_europe` 24. `italian_armistice` 25. `casablanca_conference` 26. `normandy_second_front` 27. `bagration_offensive` 28. `ve_day_dispatch`
- 每份电报：发报日期与地点、80–150 字严肃简述、1–3 个策略选项；悬停选项必须列出全部数值后果与危机度变动，绝不藏私。正文与选项用中文。不要描写暴行、种族迫害或美化极权。

## 4. 渲染与 UI（原创电报纸 / 公文卷宗风格）
视觉语言已有规定，不要发明另一套皮肤：方略与电报卡片为暖象牙电报纸 `#F4EFE6`、墨字 `#221F1D`、朱砂红橡胶印章 `#B83A2D`；抽屉仍是炭褐档案封皮 `#1E1C1A` 镶哑光暗金细线 `#A88B56`。中文标题与电报正文用霞鹜文楷（LXGW WenKai）。模态约 `960×640`，`Esc` 或点空白秒关。新增文字后重跑 `tools/build_fonts.py`。

1. **`DirectiveTreeModal.tsx`（F1 / `?panel=directives` 打开全屏方略树）**：手绘印章 + 公文签批卡片；已完成 / 进行中 / 可签批 / 未解锁状态一眼可辨；互斥分支醒目标出 **`[!]`**；底部或侧栏是 **常设方略栏**。布局必须用声明式 `(col, row)` 网格 + **自动正交折线 SVG 连线**，连线 **严禁穿过其他卡片文字**。德国树必须在 1440×900 截图里完整可读（可内含轻度平移，但印章、互斥标和常设栏都要入画）。
2. **`DispatchEventModal.tsx`（顶部下滑电报纸）**：按 ART_BIBLE §6.2：顶栏双道朱砂横杠 + 等宽电报编号（如 `DISPATCH // 1938-09-29-MUC`），右上角 `rotate(-8deg)` 半透明红圆章；选项悬停展示后果预览。`?triggerEvent=munich_crisis` 必须能在开局立刻弹出（在 `urlHarness` 新增该参数，走与正式触发相同的渲染路径）。打字机音可做极短的程序合成或静音占位，**不要**实现 Batch 12 的完整声景引擎。
3. 扩展 `urlHarness`：支持 `triggerEvent`；`panel=directives` 打开方略树模态（不只是右侧法令抽屉）。

## 5. 测试（vitest，新增）
- 静态校验全部 **7** 棵树：节点数达标（GER/SOV 24、GBR/FRA 22、ITA/POL 20、generic 16），全部 `prerequisites` / `anyOfPrerequisites` / `mutuallyExclusive` ID 存在，无自指，互斥锁闭环无死锁，`(col,row)` 无重叠。
- 静态校验 **28** 条事件：ID 齐全，触发器引用的方略/省份/国家 ID 有效，每条至少 1 个选项，效果类型皆为已注册 `EffectAction`。
- 史实序列模拟（不经 UI）：1936 起按历史选项推进，至少覆盖莱茵兰、西班牙分裂出 `SPA`、德奥合并、慕尼黑割让苏台德；再跑一条法国拒约导致 1938 开战。全程无抛错，状态变更可断言。
- 方略规则：同时只能推进 1 项；28/42 天完成；每日 0.5 AP；中止退还规则。
- 原有 **50** 项继续全绿。

## 6. 截图（SwiftShader 1440×900，`tools/shot.mjs`，**不得覆盖任何已有截图**，全部用 `b8_` 前缀）
必拍（设计验收项）：
- `shots/b8_ger_directive_tree.png`：`?autotest=1&scenario=1936&country=GER&panel=directives`——德意志方略树全貌、手绘印章+公文卡、互斥 `[!]`、常设方略栏。
- `shots/b8_fra_munich_dispatch.png`：`?autotest=1&scenario=1936&country=FRA&triggerEvent=munich_crisis`——顶部滑出参谋部加急电报纸质感与悬停后果预览（悬停要拍进画面）。
建议加拍，便于审阅（仍用 `b8_`，不要覆盖）：
- `shots/b8_spa_civil_war_split.png`：内战后 `SPA` 从 `SPR` 分裂的政治地图。
- `shots/b8_anschluss_or_sudeten.png`：德奥合并或苏台德割让后的中欧国界。
- `shots/b8_standing_directives.png`：常设方略栏特写（若全貌图里已经足够清楚可省略）。
每张都要亲自打开看：卡片文字不被连线切断，印章与 `[!]` 可辨，电报正文与后果预览可读；控制台零报错。

## 7. 合规与文档
- 原创 IP；新素材只用自绘 SVG/程序纹理或开放许可资源，登记 `public/assets/ASSET_LICENSES.json` 与 `CREDITS.md`。
- 不出现卐字、SS 符文、法西斯束棒；国旗沿用 `neutralFlags.ts` 方案（德：黑白红三色+直臂铁十字；意：三色+萨伏依盾；苏：简化红旗金星）。
- 更新 `docs/PROGRESS_BATCH8.md` 与 README（按 Batch 07 的写法追加本批摘要，不要删旧段）。
- 工作方式：多次小工具调用，每轮回复简短，每次写文件不超过约 150 行。大 JSON 可按国拆文件，不要一次倾倒整棵树。

## Git 提交规则（用户要求，必须遵守）
- 直接在现有仓库 `main` 分支上工作（remote `origin` = https://github.com/wu352947-cmd/meridian-1936 ，`gh` 已登录）。
- 每完成一个**测试通过**的子步骤（例如：EffectRunner 与 schema → 方略数据与 directiveSystem → 7 树静态校验 → 事件引擎与 28 条电报 → 史实序列模拟 → DirectiveTreeModal 与正交连线 → DispatchEventModal 与 urlHarness → 截图与文档），就做一次小提交并推送：
  1. 先 `npm test`（若改了前端或类型，再 `npm run build`），必须通过才提交；
  2. `git status` 检查，只 `git add` 本子步骤相关文件（不要 `git add -A`）；
  3. **绝不提交** `ref/`、`logs-local/`、`.cache/`、`node_modules/`、`dist/`，也绝不提交任何钢铁雄心 4 / 文明时代 3 官方或玩家截图；
  4. 提交信息用 `feat(batch-08): <子步骤>` 风格；
  5. `git push origin main`。
- 不要改写已推送历史（不要 force push、amend、rebase）。不要推送或改动 `gh-pages` 分支（发布由审阅者负责）。
