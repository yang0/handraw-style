import raw from './styles.json';

export interface Style {
  number: string;
  group: string;
  reference: string;
  generation_name: string;
  traits: string;
}

export interface Group {
  letter: string;
  name: string;
  short: string;
  count: number;
  range: string;
}

export interface ContactSheet {
  letter: string;
  start: number;
  end: number;
  file: string;
}

export const styles: Style[] = raw as Style[];

/** 分组标签形如 "A 国际社论漫画 / 幽默手绘"，取开头的字母。 */
export function groupLetter(group: string): string {
  const m = group.trim().match(/^([A-Za-z])/);
  return m ? m[1].toUpperCase() : group.trim().charAt(0).toUpperCase();
}

/** 去掉开头字母后的组名，如 "国际社论漫画 / 幽默手绘"。 */
export function groupName(group: string): string {
  const letter = groupLetter(group);
  return group.trim().replace(new RegExp(`^${letter}[\\s:：.-]*`), '').trim() || group.trim();
}

const ranges: Record<string, [number, number]> = {
  A: [1, 35],
  B: [36, 54],
  C: [55, 82],
  D: [83, 123],
  E: [124, 154],
  F: [155, 200],
  G: [201, 216],
  H: [217, 267],
};

export const groups: Group[] = Object.entries(ranges).map(([letter, [start, end]]) => {
  const inGroup = styles.filter((s) => groupLetter(s.group) === letter);
  const sample = inGroup[0];
  return {
    letter,
    name: sample ? groupName(sample.group) : letter,
    short: sample ? groupName(sample.group).split('/')[0].trim() : letter,
    count: inGroup.length,
    range: `#${String(start).padStart(3, '0')}–#${String(end).padStart(3, '0')}`,
  };
});

/** 接触拼图画廊（与 gallery/index.html 中一致）。 */
export const contactSheets: ContactSheet[] = [
  { letter: 'A', start: 1, end: 16, file: 'A_001-016.png' },
  { letter: 'A', start: 17, end: 32, file: 'A_017-032.png' },
  { letter: 'A', start: 33, end: 35, file: 'A_033-035.png' },
  { letter: 'B', start: 36, end: 48, file: 'B_036-048.png' },
  { letter: 'B', start: 49, end: 54, file: 'B_049-054.png' },
  { letter: 'C', start: 55, end: 70, file: 'C_055-070.png' },
  { letter: 'C', start: 71, end: 82, file: 'C_071-082.png' },
  { letter: 'D', start: 83, end: 98, file: 'D_083-098.png' },
  { letter: 'D', start: 99, end: 114, file: 'D_099-114.png' },
  { letter: 'D', start: 115, end: 123, file: 'D_115-123.png' },
  { letter: 'E', start: 124, end: 139, file: 'E_124-139.png' },
  { letter: 'E', start: 140, end: 154, file: 'E_140-154.png' },
  { letter: 'F', start: 155, end: 170, file: 'F_155-170.png' },
  { letter: 'F', start: 171, end: 186, file: 'F_171-186.png' },
  { letter: 'F', start: 187, end: 200, file: 'F_187-200.png' },
  { letter: 'G', start: 201, end: 216, file: 'G_201-216.png' },
  { letter: 'H', start: 217, end: 232, file: 'H_217-232.png' },
  { letter: 'H', start: 233, end: 248, file: 'H_233-248.png' },
  { letter: 'H', start: 249, end: 264, file: 'H_249-264.png' },
  { letter: 'H', start: 265, end: 267, file: 'H_265-267.png' },
];

/** 单个编号所在的分桶（001–200 / 201–400）。 */
export function bucket(num: number): '001-200' | '201-400' {
  return num <= 200 ? '001-200' : '201-400';
}

/** 单个编号的缩略图路径（相对站点根，含 base）。 */
export function imagePath(number: string): string {
  const n = parseInt(number, 10);
  const pad = n.toString().padStart(3, '0');
  return `${import.meta.env.BASE_URL}images/individual/${bucket(n)}/${pad}.png`;
}

/** 某编号对应的接触拼图文件路径。 */
export function sheetFor(number: string): ContactSheet | undefined {
  const n = parseInt(number, 10);
  return contactSheets.find((s) => n >= s.start && n <= s.end);
}

/** 按编号排序并返回相邻上一条/下一条；循环首尾。 */
export function neighbors(number: string): { prev: Style | undefined; next: Style | undefined } {
  const sorted = [...styles].sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
  const idx = sorted.findIndex((s) => s.number === number);
  if (idx === -1) return { prev: undefined, next: undefined };
  return {
    prev: sorted[(idx - 1 + sorted.length) % sorted.length],
    next: sorted[(idx + 1) % sorted.length],
  };
}

export const totalCount = styles.length;