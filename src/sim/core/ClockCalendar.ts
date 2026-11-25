/**
 * Deterministic 6-hour tick calendar (4 ticks/day: 晨/午/昏/夜) starting 1936-01-01.
 * Uses exact Gregorian month lengths (including 1936, 1940, 1944 leap years).
 */

export const TICKS_PER_DAY = 4;
export const BASE_YEAR = 1936;
export const YEAR_TICKS_365 = 365 * TICKS_PER_DAY; // 1460 ticks

export type SimSpeed = 0 | 1 | 2 | 3 | 4;

/** Real-time ms per 6-hour tick per DESIGN_carbon.md §4.1. */
export const SPEED_INTERVAL_MS: Record<SimSpeed, number> = {
  0: 0,
  1: 800,
  2: 350,
  3: 120,
  4: 25,
};

export interface SimDateParts {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
  slot: 0 | 1 | 2 | 3; // 0=00:00 晨, 1=06:00 午, 2=12:00 昏, 3=18:00 夜
  hour: number;  // 0, 6, 12, 18
  slotZh: string;
  slotShortZh: string;
  isNight: boolean;
}

const SLOT_META: ReadonlyArray<{ hour: number; zh: string; shortZh: string }> = [
  { hour: 0, zh: '拂晓', shortZh: '晨' },
  { hour: 6, zh: '正午', shortZh: '午' },
  { hour: 12, zh: '黄昏', shortZh: '昏' },
  { hour: 18, zh: '夜间', shortZh: '夜' },
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 30;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function tickToDate(tick: number): SimDateParts {
  const safeTick = Math.max(0, Math.trunc(tick));
  const totalDays = Math.floor(safeTick / TICKS_PER_DAY);
  const slot = (safeTick % TICKS_PER_DAY) as 0 | 1 | 2 | 3;

  let year = BASE_YEAR;
  let rem = totalDays;
  while (true) {
    const dy = daysInYear(year);
    if (rem < dy) break;
    rem -= dy;
    year += 1;
  }

  let month = 1;
  while (month <= 12) {
    const dm = daysInMonth(year, month);
    if (rem < dm) break;
    rem -= dm;
    month += 1;
  }

  const day = rem + 1;
  const sm = SLOT_META[slot]!;
  return {
    year,
    month,
    day,
    slot,
    hour: sm.hour,
    slotZh: sm.zh,
    slotShortZh: sm.shortZh,
    isNight: slot === 3,
  };
}

/** Convert YYYY-MM-DD (relative to 1936-01-01) to deterministic tick at 00:00. */
export function dateStringToTick(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  const day = Number.parseInt(m[3]!, 10);
  if (year < BASE_YEAR || year > 1950 || month < 1 || month > 12) return null;
  const maxD = daysInMonth(year, month);
  if (day < 1 || day > maxD) return null;

  let totalDays = 0;
  for (let y = BASE_YEAR; y < year; y++) totalDays += daysInYear(y);
  for (let mo = 1; mo < month; mo++) totalDays += daysInMonth(year, mo);
  totalDays += day - 1;
  return totalDays * TICKS_PER_DAY;
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export function formatDateIso(tick: number): string {
  const d = tickToDate(tick);
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

export function formatDateZh(tick: number): string {
  const d = tickToDate(tick);
  return `${d.year}年${pad2(d.month)}月${pad2(d.day)}日`;
}

export function formatClockTime(tick: number): string {
  const d = tickToDate(tick);
  return `${pad2(d.hour)}:00`;
}
