# Batch 07 进度追踪 — 《子午线 1936：碎裂大陆》

## 状态：已完成（Batch 07 多源补给网络、缺粮/断粮惩罚、季节泥泞严冬与夜战、M3 后勤透镜、F5 后勤抽屉验收通过）

## 已完成清单
- [x] 1. **补给源与气候带静态数据（`supplySources1936.ts`、`climateZones1936.ts`）**：
  - 按 §4.10 规则构建 1936 全图补给源表：本国首都 `S=100`、本土核心工业都市（`vp≥15` 或高工业权重）`S=85`、友方海港 `S=35+13×L`（Lv 1–5；过滤内陆伪海岸省并为和平期孤立岛屿/飞地补设 Lv 1 地方港，和平开局全图可玩省 `S=0` 归零；预留海区护航折减接口）。
  - 划分 676 陆地省为西欧温带、地中海/北非干旱、北欧亚寒带、东欧大陆性 4 气候带（紧凑 `Uint8Array`），标注 `FIN`/`SOV` 固有抗寒国家表。
- [x] 2. **多源 Dijkstra 补给网络与二进制快照传输（`supplyTypes.ts`、`supplySystem.ts`、`SnapshotCodec.ts`）**：
  - 采用 CSR 邻接 `Uint16Array`/`Int32Array` 与零分配二叉最大堆实现每日 00:00 全图确定性多源补给重算（仅经本国与盟友控制省传播，敌控阻断），676 省中位耗时 **0.31 ms**（< 0.5 ms 目标）。
  - 精确核算跨省阻抗：`BaseTerrainCost ÷ 基建倍率（0.8–1.8）+ 新占领不满 14 天惩罚（+8）− 摩托化补给卡车减免（−3，消耗卡车库存）`。
  - 定点整数 `S_p ∈ [0,100]` 写入既有 `32 KB` `Transferable ArrayBuffer` 偏移 `4096` 处随乒乓快照零拷贝传回主线程。
- [x] 3. **缺粮/断粮状态、确定性季节天气与战斗/行军/AI 联动（`supplyPenalties.ts`、`weatherSystem.ts`、`combatMath.ts`、`combatBattleStep.ts`、`armyMovement.ts`、`armyOrderSystem.ts`、`arrowExecution.ts`）**：
  - 供养上限 `Cap_p = max(1, ⌊S_p/15⌋)`；缺粮（`N > Cap_p` 或 `S_p < 30`）线性施加 `-10%～-50%` 攻防与至多 `-50%` 移速惩罚，并暂停组织度自然恢复；断粮（`S_p = 0` 满 48 小时 / 8 Tick）固定 `-60%` 攻防、每 Tick `-4` 组织度与 `-1.5%` 装备损耗（严冬缺补给损耗翻倍）。
  - 季节与夜战确定性生效：东欧 4 月与 10 月下半月泥泞（行军 `-40%`、装甲/摩托化进攻 `-35%`）；东欧与北欧 12–2 月严冬（非山地旅进攻 `-25%`，`MTN` 豁免，`FIN`/`SOV` 抗寒减半）；18:00 夜间 Tick 陆战攻击 `×0.75`（空军 `×0.50` 预留接口）；制空支援维持「未启用」。
  - 集团军填线 AI 自动规避 `N ≥ Cap_p` 的超载省，泥泞与严冬下装甲/摩托化总攻权重降为 `×0.4`。
- [x] 4. **M3 实时补给透镜、色盲色表、季节叠层与兵牌/战报可读性（`provinceLut.ts`、`lutPalette.ts`、`SupplyOverlayLayer.ts`、`SeasonalMapOverlay.tsx`、`counterArt.ts`、`UnitCounterLayer.ts`、`BattleReportDrawer.tsx`）**：
  - **M3 后勤模式**：实时按 `S_p` 渲染翠绿（80–100）→ 琥珀（40–79）→ 铁锈红（<40）→ 屏幕像素空间黑红斜纹（`S=0`，缩放无摩尔纹），支持一键/URL `?cb=1` 切换 Okabe-Ito 蓝–灰–橙色盲安全色表；自绘 SVG 首都星标、工业核心枢纽与海港锚标（低缩放自动隐藏 Lv 1–2 小港去噪）。
  - **克制季节叠层**：受影响气候带叠加极淡冷蓝/泥褐滤色，视口四角浮现自绘 SVG 冰霜/泥渍纹饰且完全不挡字不脏图；右上时钟旁新增季节标签（如「东欧 · 严冬」「东欧 · 泥泞」）。
  - **兵牌与战地简报**：缺粮兵牌右上角点亮自绘红色油桶叹号小标，断粮兵牌切换黑红警示粗边并触发闪烁脉冲；`[战报]` 抽屉完整展示补给、季节与夜战真实乘数及来源说明，10 项因子同屏无截断。
- [x] 5. **F5 `[后勤补给与季节天气]` 抽屉（`LogisticsDrawer.tsx`、`RightDossierDrawer.tsx`、`TopRightClockBar.tsx`、`BottomCommandDock.tsx`）**：
  - 替换 F5 占位面板：呈现全国平均补给/缺粮断粮旅数/卡车储备与日耗、按集团军切换「摩托化补给」并联动 F5 缺粮红点提示、补给源列表、当前气候带天气效果与下次换季日期，并保留「占领管理（后续开放）」占位标题。
- [x] 6. **测试、字体子集、合规登记与 SwiftShader 1440×900 视觉验收（0 报错）**：
  - `npm test`：**10 个测试文件 50/50 全绿**（原有 41 项全通过 + 新增 9 项 Batch 07 专项测试：`tests/batch07Supply.test.ts` 与 `tests/batch07Weather.test.ts`，覆盖确定性、海港恢复、基建/新占/卡车阻抗、缺粮/断粮 8-Tick 损耗、676 省 < 0.5 ms 性能、泥泞/严冬/抗寒/山地豁免与夜战 ×0.75）。
  - `tools/build_fonts.py` 重建 1,497 字形 WOFF2 子集；`src/assets/icons/logisticsIcons.ts` 与程序纹饰登记至 `public/assets/ASSET_LICENSES.json` 与 `CREDITS.md`。
  - 新增 7 张 SwiftShader 1440×900 截图（未覆盖任何既有截图）并逐张目视复查确认过渡平滑、零重叠、零控制台报错：`shots/b7_supply_lens_ger.png`、`shots/b7_supply_lens_sov_winter.png`、`shots/b7_supply_lens_colorblind.png`、`shots/b7_mud_season.png`、`shots/b7_out_of_supply_front.png`、`shots/b7_battle_report_supply.png`、`shots/b7_logistics_drawer.png`。

## 审阅返工（r2）
- 季节叠层加强：严冬四角冰霜晕与受影响气候带冷蓝灰调、泥泞季四角泥渍与东欧泥褐调，现可一眼识别，且不降低国名/军牌/HUD 可读性。
- M3 补给透镜：色带内部连续明暗渐变，S=80 / S=40 处加铅笔等值线；色盲色表同步。
- 重拍 `b7_supply_lens_ger.png`、`b7_supply_lens_sov_winter.png`、`b7_supply_lens_colorblind.png`、`b7_mud_season.png`。

## 已知不足（留待后续批次补全）
- 海区护航效率对港口补给的动态折减与空军夜间出动率（`×0.50`）已预留数据接口，留待海空军批次（Batch 10）接入。
- 占领区抵抗度、顺从度与宪兵镇压留待后续批次实装（当前 F5 仅保留「占领管理（后续开放）」占位）。
- 完整国家方略树、电报事件与外交宣战体系留待 Batch 08 / 09 实施。
