import type { CountryInfo, TerrainType } from '../types/map';

export const TERRAIN_INFO: Record<
  TerrainType,
  { nameZh: string; nameEn: string; color: string; descZh: string }
> = {
  plains: { nameZh: '平原', nameEn: 'Plains', color: '#E5DEC9', descZh: '视野开阔，适于机械化纵深机动' },
  forest: { nameZh: '森林', nameEn: 'Forest', color: '#6F8260', descZh: '林密隐蔽，利于步兵依托阵地防御' },
  hills: { nameZh: '丘陵', nameEn: 'Hills', color: '#B59E7A', descZh: '起伏缓坡，制高点易守难攻' },
  mountain: { nameZh: '高山', nameEn: 'Mountain', color: '#6E5A4B', descZh: '险峻天堑，重装备通行严重受阻' },
  marsh: { nameZh: '沼泽', nameEn: 'Marsh', color: '#6B7D78', descZh: '泥泞水网，装甲推进与补给吃紧' },
  urban: { nameZh: '都市', nameEn: 'Urban', color: '#A65E52', descZh: '工业铁路枢纽，巷战消耗极高' },
  desert: { nameZh: '荒漠', nameEn: 'Desert', color: '#D8C394', descZh: '干旱戈壁，补给线极度依赖沿岸公路' },
  sea: { nameZh: '海域', nameEn: 'Sea Zone', color: '#2B3D4F', descZh: '海上交通与舰队巡弋战区' },
};

/** Exact low-saturation mineral palette from docs/ART_BIBLE.md §2.2 */
export const COUNTRIES_1936: Record<string, CountryInfo> = {
  GER: { tag: 'GER', nameZh: '德意志国', nameEn: 'Germany', shortZh: '德意志', color: '#4A555E', faction: 'axis', capitalZh: '柏林', ideologyZh: '威权集权' },
  GBR: { tag: 'GBR', nameZh: '大不列颠', nameEn: 'United Kingdom', shortZh: '大不列颠', color: '#B86B6B', faction: 'allies', capitalZh: '伦敦', ideologyZh: '议会立宪' },
  FRA: { tag: 'FRA', nameZh: '法兰西共和国', nameEn: 'France', shortZh: '法兰西', color: '#4B6B94', faction: 'allies', capitalZh: '巴黎', ideologyZh: '议会共和' },
  SOV: { tag: 'SOV', nameZh: '苏维埃联盟', nameEn: 'Soviet Union', shortZh: '苏维埃联盟', color: '#963E3A', faction: 'comintern', capitalZh: '莫斯科', ideologyZh: '苏维埃联邦' },
  ITA: { tag: 'ITA', nameZh: '意大利王国', nameEn: 'Italy', shortZh: '意大利', color: '#5D7A52', faction: 'axis', capitalZh: '罗马', ideologyZh: '法团威权' },
  POL: { tag: 'POL', nameZh: '波兰共和国', nameEn: 'Poland', shortZh: '波兰', color: '#A86478', faction: 'neutral', capitalZh: '华沙', ideologyZh: '军政威权' },
  DNZ: { tag: 'DNZ', nameZh: '但泽自由市', nameEn: 'Free City of Danzig', shortZh: '但泽', color: '#C7B28E', faction: 'neutral', capitalZh: '但泽', ideologyZh: '国联托管自由市' },
  SPR: { tag: 'SPR', nameZh: '西班牙共和国', nameEn: 'Spanish Republic', shortZh: '西班牙', color: '#C48A47', faction: 'neutral', capitalZh: '马德里', ideologyZh: '议会共和' },
  CZE: { tag: 'CZE', nameZh: '捷克斯洛伐克', nameEn: 'Czechoslovakia', shortZh: '捷克斯洛伐克', color: '#4E7A7D', faction: 'neutral', capitalZh: '布拉格', ideologyZh: '议会共和' },
  AUS: { tag: 'AUS', nameZh: '奥地利联邦', nameEn: 'Austria', shortZh: '奥地利', color: '#C8BDB0', faction: 'neutral', capitalZh: '维也纳', ideologyZh: '保守法团' },
  HUN: { tag: 'HUN', nameZh: '匈牙利王国', nameEn: 'Hungary', shortZh: '匈牙利', color: '#8F6B58', faction: 'neutral', capitalZh: '布达佩斯', ideologyZh: '摄政王国' },
  ROM: { tag: 'ROM', nameZh: '罗马尼亚王国', nameEn: 'Romania', shortZh: '罗马尼亚', color: '#B89C4E', faction: 'neutral', capitalZh: '布加勒斯特', ideologyZh: '君主立宪' },
  YUG: { tag: 'YUG', nameZh: '南斯拉夫王国', nameEn: 'Yugoslavia', shortZh: '南斯拉夫', color: '#5B688A', faction: 'neutral', capitalZh: '贝尔格莱德', ideologyZh: '君主威权' },
  BUL: { tag: 'BUL', nameZh: '保加利亚王国', nameEn: 'Bulgaria', shortZh: '保加利亚', color: '#687D5B', faction: 'neutral', capitalZh: '索非亚', ideologyZh: '君主威权' },
  GRE: { tag: 'GRE', nameZh: '希腊王国', nameEn: 'Greece', shortZh: '希腊', color: '#5D8AA8', faction: 'neutral', capitalZh: '雅典', ideologyZh: '君主立宪' },
  TUR: { tag: 'TUR', nameZh: '土耳其共和国', nameEn: 'Turkey', shortZh: '土耳其', color: '#5A877A', faction: 'neutral', capitalZh: '安卡拉', ideologyZh: '民族共和' },
  FIN: { tag: 'FIN', nameZh: '芬兰共和国', nameEn: 'Finland', shortZh: '芬兰', color: '#CAD4DC', faction: 'neutral', capitalZh: '赫尔辛基', ideologyZh: '议会共和' },
  SWE: { tag: 'SWE', nameZh: '瑞典王国', nameEn: 'Sweden', shortZh: '瑞典', color: '#3E6B89', faction: 'neutral', capitalZh: '斯德哥尔摩', ideologyZh: '议会立宪' },
  NOR: { tag: 'NOR', nameZh: '挪威王国', nameEn: 'Norway', shortZh: '挪威', color: '#8A5A64', faction: 'neutral', capitalZh: '奥斯陆', ideologyZh: '议会立宪' },
  DEN: { tag: 'DEN', nameZh: '丹麦王国', nameEn: 'Denmark', shortZh: '丹麦', color: '#B05B52', faction: 'neutral', capitalZh: '哥本哈根', ideologyZh: '议会立宪' },
  ISL: { tag: 'ISL', nameZh: '冰岛王国', nameEn: 'Iceland', shortZh: '冰岛', color: '#7D99AB', faction: 'neutral', capitalZh: '雷克雅未克', ideologyZh: '共主立宪' },
  HOL: { tag: 'HOL', nameZh: '荷兰王国', nameEn: 'Netherlands', shortZh: '荷兰', color: '#C87D4B', faction: 'neutral', capitalZh: '阿姆斯特丹', ideologyZh: '议会立宪' },
  BEL: { tag: 'BEL', nameZh: '比利时王国', nameEn: 'Belgium', shortZh: '比利时', color: '#A89256', faction: 'neutral', capitalZh: '布鲁塞尔', ideologyZh: '议会立宪' },
  LUX: { tag: 'LUX', nameZh: '卢森堡大公国', nameEn: 'Luxembourg', shortZh: '卢森堡', color: '#7CA2B8', faction: 'neutral', capitalZh: '卢森堡', ideologyZh: '议会立宪' },
  SWI: { tag: 'SWI', nameZh: '瑞士联邦', nameEn: 'Switzerland', shortZh: '瑞士', color: '#A84642', faction: 'neutral', capitalZh: '伯尔尼', ideologyZh: '永久中立联邦' },
  POR: { tag: 'POR', nameZh: '葡萄牙共和国', nameEn: 'Portugal', shortZh: '葡萄牙', color: '#4E7861', faction: 'neutral', capitalZh: '里斯本', ideologyZh: '保守威权' },
  IRE: { tag: 'IRE', nameZh: '爱尔兰自由邦', nameEn: 'Irish Free State', shortZh: '爱尔兰', color: '#5E8A66', faction: 'neutral', capitalZh: '都柏林', ideologyZh: '议会自治领' },
  LIT: { tag: 'LIT', nameZh: '立陶宛共和国', nameEn: 'Lithuania', shortZh: '立陶宛', color: '#9E8B5C', faction: 'neutral', capitalZh: '考纳斯', ideologyZh: '民族威权' },
  LAT: { tag: 'LAT', nameZh: '拉脱维亚共和国', nameEn: 'Latvia', shortZh: '拉脱维亚', color: '#7D4E52', faction: 'neutral', capitalZh: '里加', ideologyZh: '民族威权' },
  EST: { tag: 'EST', nameZh: '爱沙尼亚共和国', nameEn: 'Estonia', shortZh: '爱沙尼亚', color: '#5C7A8E', faction: 'neutral', capitalZh: '塔林', ideologyZh: '民族威权' },
  ALB: { tag: 'ALB', nameZh: '阿尔巴尼亚王国', nameEn: 'Albania', shortZh: '阿尔巴尼亚', color: '#7A4448', faction: 'neutral', capitalZh: '地拉那', ideologyZh: '君主威权' },
  IRQ: { tag: 'IRQ', nameZh: '伊拉克王国', nameEn: 'Iraq', shortZh: '伊拉克', color: '#9E9078', faction: 'neutral', capitalZh: '巴格达', ideologyZh: '君主立宪', isEdge: true },
  IRN: { tag: 'IRN', nameZh: '伊朗帝国', nameEn: 'Iran', shortZh: '伊朗', color: '#8C9B84', faction: 'neutral', capitalZh: '德黑兰', ideologyZh: '君主威权', isEdge: true },
  SAU: { tag: 'SAU', nameZh: '沙特阿拉伯', nameEn: 'Saudi Arabia', shortZh: '沙特', color: '#A3987E', faction: 'neutral', capitalZh: '利雅得', ideologyZh: '君主制', isEdge: true },
  EDG: { tag: 'EDG', nameZh: '域外边疆', nameEn: 'Frontier Territory', shortZh: '域外', color: '#C5BCAA', faction: 'neutral', capitalZh: '—', ideologyZh: '图幅边缘区', isEdge: true },
  SEA: { tag: 'SEA', nameZh: '公海战区', nameEn: 'Sea Zone', shortZh: '海域', color: '#2B3D4F', faction: 'neutral', capitalZh: '—', ideologyZh: '海域' },
};

export function getCountryInfo(tag: string): CountryInfo {
  return COUNTRIES_1936[tag] ?? {
    tag,
    nameZh: tag,
    nameEn: tag,
    shortZh: tag,
    color: '#B8B0A0',
    faction: 'neutral',
    capitalZh: '—',
    ideologyZh: '未标注',
  };
}
