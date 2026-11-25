/**
 * Deterministic 1936 Supply Sources & Port Levels (Carbon §4.10 / Batch 07 §1).
 *
 * Rules for Supply Sources:
 *  1. National Capital: S = 100 (active when controlled by its native owner).
 *  2. Native Industrial Core Cities (non-capital provinces with VP >= 15 in provinces1936.json):
 *     S = 85 (active when controlled by its native owner).
 *  3. Friendly Ports (portLevel 1..5): S = 35 + 13 * portLevel (48 / 61 / 74 / 87 / 100),
 *     active for any controller (convoy efficiency hook defaults to 1.00 until Batch 10 Navy).
 *     Port levels derive from coastal status + dockyards + VP + curated major/minor naval ports
 *     (excluding inland map-edge artifacts like Sverdlovsk/Poznan/Tehran).
 *
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { getCapitalProvince, SIM_PROVINCES, type SimProvince } from './provinces1936';
import { getRegionDefByProvince } from './regions1936';

export type SupplySourceKind = 'capital' | 'core_city' | 'port';

export interface StaticPortDef {
  provId: number;
  portLevel: 1 | 2 | 3 | 4 | 5;
  nameZh: string;
}

export interface StaticSupplyHub {
  provId: number;
  owner: string;
  kind: SupplySourceKind;
  portLevel: number;
  baseSupply: number;
  nameZh: string;
  cx: number;
  cy: number;
}

export const CAPITAL_SUPPLY_VALUE = 100;
export const CORE_CITY_SUPPLY_VALUE = 85;
export const CORE_CITY_MIN_VP = 15;

export function calcPortSupplyValue(portLevel: number): number {
  const lvl = Math.max(0, Math.min(5, Math.trunc(portLevel)));
  return lvl > 0 ? Math.min(100, 35 + 13 * lvl) : 0;
}

/** Inland provinces flagged coastal by map-edge/river-estuary rasterization; never seaports. */
const NON_SEAPORT_IDS = new Set<number>([
  133, // 里尔 (inland Flanders)
  178, // 伯明翰 (English Midlands)
  300, // 德黑兰 (inland Iran)
  324, // 博洛尼亚 (inland Po valley)
  388, // 波兹南 (inland Greater Poland)
  457, // 阿克托贝 (inland Kazakhstan)
  459, // 斯维尔德洛夫斯克 (Urals)
  460, // 汉特-曼西 (Siberia)
  481, // 库尔干 (Urals)
]);

/** Curated historical 1936 naval/commercial port level overrides (1..5). */
const CURATED_PORT_LEVELS: Readonly<Record<number, 1 | 2 | 3 | 4 | 5>> = {
  // Major Lv 5 hubs (S=100)
  175: 5, // 伦敦
  243: 5, // 汉堡
  483: 5, // 列宁格勒
  132: 5, // 马赛
  20: 5,  // 安特卫普
  273: 5, // 阿姆斯特丹
  311: 5, // 那不勒斯
  326: 5, // 热那亚
  651: 5, // 伊斯坦布尔
  164: 5, // 曼彻斯特/利物浦
  596: 5, // 巴塞罗那
  620: 5, // 斯德哥尔摩
  51: 5,  // 哥本哈根
  263: 5, // 雅典
  422: 5, // 里斯本
  // Important Lv 4 naval & strategic ports (S=87)
  249: 4, // 柯尼斯堡 (East Prussia lifeline)
  244: 4, // 基尔
  220: 4, // 斯德丁
  55: 4,  // 但泽自由市
  167: 4, // 格拉斯哥
  173: 4, // 爱丁堡
  119: 4, // 波尔多
  317: 4, // 罗马/奥斯蒂亚
  519: 4, // 塞瓦斯托波尔
  534: 4, // 敖德萨
  468: 4, // 摩尔曼斯克
  559: 4, // 巴库
  110: 4, // 阿尔及尔
  153: 4, // 亚历山大
  155: 4, // 苏伊士
  76: 4,  // 赫尔辛基
  373: 4, // 奥斯陆
  357: 4, // 里加
  59: 4,  // 塔林
  295: 4, // 都柏林
  345: 4, // 的黎波里
  // Regional Lv 3 tactical ports (S=74 = 35+39)
  417: 3, // 格丁尼亚 (Poland Baltic corridor port)
  204: 3, // 不来梅哈芬
  223: 3, // 罗斯托克
  456: 3, // 阿尔汉格尔斯克
  474: 3, // 顿河畔罗斯托夫
  529: 3, // 尼古拉耶夫
  102: 3, // 卡萨布兰卡
  118: 3, // 突尼斯
  334: 3, // 托布鲁克
  341: 3, // 班加西
  147: 3, // 马耳他
  182: 3, // 塞浦路斯
  158: 3, // 特拉维夫
  161: 3, // 海法
  255: 3, // 塞萨洛尼基
  305: 3, // 雷克雅未克
};

function derivePortLevel(p: SimProvince): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!p.isCoastal || NON_SEAPORT_IDS.has(p.id)) return 0;
  const curated = CURATED_PORT_LEVELS[p.id];
  if (curated) return curated;
  const reg = getRegionDefByProvince(p.id);
  const isRegHub = reg !== null && reg.hubProvId === p.id;
  if (isRegHub && reg.doc >= 2) return 3;
  if (p.vp >= 12) return 3;
  if (p.vp >= 8 || (isRegHub && p.vp >= 6)) return 2;
  if (p.vp >= 5) return 1;
  return 0;
}

export const MAX_SIM_PROV_ID = SIM_PROVINCES.reduce((m, p) => Math.max(m, p.id), 0);

export const PORT_LEVEL_BY_PROV = new Uint8Array(MAX_SIM_PROV_ID + 1);
export const IS_CAPITAL_PROV = new Uint8Array(MAX_SIM_PROV_ID + 1);
export const IS_CORE_CITY_PROV = new Uint8Array(MAX_SIM_PROV_ID + 1);

const CAPITAL_IDS = new Set<number>();
for (const p of SIM_PROVINCES) {
  const cap = getCapitalProvince(p.owner);
  if (cap) CAPITAL_IDS.add(cap.id);
}

for (const p of SIM_PROVINCES) {
  PORT_LEVEL_BY_PROV[p.id] = derivePortLevel(p);
  const isCap = CAPITAL_IDS.has(p.id);
  const isCoreCity = !isCap && p.vp >= CORE_CITY_MIN_VP;
  if (isCap) IS_CAPITAL_PROV[p.id] = 1;
  if (isCoreCity) IS_CORE_CITY_PROV[p.id] = 1;
}

// Ensure isolated 1936 islands & coastal exclaves (e.g., Shetland, Balearics, Saaremaa, Zeeland) have a Lv 1 local port
const provById = new Map<number, SimProvince>(SIM_PROVINCES.map((p) => [p.id, p]));
const visited = new Uint8Array(MAX_SIM_PROV_ID + 1);
for (const p of SIM_PROVINCES) {
  if (visited[p.id]) continue;
  const comp: SimProvince[] = [];
  const q: SimProvince[] = [p];
  visited[p.id] = 1;
  let hasHub = false;
  while (q.length > 0) {
    const cur = q.pop()!;
    comp.push(cur);
    if (IS_CAPITAL_PROV[cur.id] || IS_CORE_CITY_PROV[cur.id] || PORT_LEVEL_BY_PROV[cur.id]! > 0) hasHub = true;
    for (const nbId of cur.neighbors) {
      if (visited[nbId]) continue;
      const nb = provById.get(nbId);
      if (nb && nb.owner === p.owner) {
        visited[nbId] = 1;
        q.push(nb);
      }
    }
  }
  if (!hasHub && p.owner !== 'EDG') {
    const coastal = comp.filter((c) => c.isCoastal && !NON_SEAPORT_IDS.has(c.id)).sort((a, b) => b.vp - a.vp || a.id - b.id);
    if (coastal[0]) PORT_LEVEL_BY_PROV[coastal[0].id] = 1;
  }
}

const ALL_HUBS: StaticSupplyHub[] = [];

for (const p of SIM_PROVINCES) {
  const portLvl = PORT_LEVEL_BY_PROV[p.id]!;
  const isCap = IS_CAPITAL_PROV[p.id] === 1;
  const isCoreCity = IS_CORE_CITY_PROV[p.id] === 1;

  if (isCap) {
    ALL_HUBS.push({
      provId: p.id, owner: p.owner, kind: 'capital', portLevel: portLvl,
      baseSupply: CAPITAL_SUPPLY_VALUE, nameZh: p.nameZh, cx: p.cx, cy: p.cy,
    });
  } else if (isCoreCity) {
    ALL_HUBS.push({
      provId: p.id, owner: p.owner, kind: 'core_city', portLevel: portLvl,
      baseSupply: Math.max(CORE_CITY_SUPPLY_VALUE, calcPortSupplyValue(portLvl)),
      nameZh: p.nameZh, cx: p.cx, cy: p.cy,
    });
  } else if (portLvl > 0) {
    ALL_HUBS.push({
      provId: p.id, owner: p.owner, kind: 'port', portLevel: portLvl,
      baseSupply: calcPortSupplyValue(portLvl), nameZh: p.nameZh, cx: p.cx, cy: p.cy,
    });
  }
}

export const STATIC_SUPPLY_HUBS: readonly StaticSupplyHub[] = ALL_HUBS;

export function getPortLevel(provId: number): number {
  return provId >= 0 && provId <= MAX_SIM_PROV_ID ? (PORT_LEVEL_BY_PROV[provId] ?? 0) : 0;
}
