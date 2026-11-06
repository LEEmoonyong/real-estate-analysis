// 세대 생활 환경 점수 (확장 X5) — 일조·향·개방감·층·입지를 100점으로 합친 "참고용" 점수
// 값이 없는 항목(천공률 미계산, 주변 시설 미조회)은 빼고 남은 항목 만점으로 환산한다.

export interface UnitScoreInput {
  /** 08~16시 총 일조 [분] (동지 기준 권장) */
  windowTotalMinutes: number;
  /** 09~15시 최대 연속 일조 [분] */
  windowMaxContinuous: number;
  /** 참고 기준 충족 */
  meetsCriteria: boolean;
  /** 창 방향 방위각 [°] 북=0, 남=180 */
  azimuthDeg: number;
  floor: number;
  topFloor: number;
  /** 천공률 (없으면 null) */
  svf: number | null;
  /** 가장 가까운 초등학교·지하철역 [m] (없으면 null) */
  elementaryM: number | null;
  subwayM: number | null;
}

export interface ScoreItem {
  id: 'sun' | 'criteria' | 'orientation' | 'sky' | 'floor' | 'location';
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface UnitScore {
  total: number;
  grade: 'A' | 'B' | 'C' | 'D';
  items: ScoreItem[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 가까울수록 1 — near 이하 1, far 이상 0, 사이는 선형 */
const closeness = (d: number, near: number, far: number) => clamp01((far - d) / (far - near));

export function unitScore(input: UnitScoreInput): UnitScore {
  const items: ScoreItem[] = [];
  const hours = (m: number) => `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;

  items.push({
    id: 'sun',
    label: '일조 시간',
    max: 35,
    score: 35 * clamp01(input.windowTotalMinutes / 480),
    detail: `08~16시 ${hours(input.windowTotalMinutes)} / 8시간`,
  });
  items.push({
    id: 'criteria',
    label: '일조 기준',
    max: 10,
    score: input.meetsCriteria ? 10 : 5 * clamp01(input.windowMaxContinuous / 120),
    detail: input.meetsCriteria ? '참고 기준 충족' : `미충족 (연속 ${hours(input.windowMaxContinuous)})`,
  });
  // 향: 남향 만점, 동·서향 절반, 북향 0 (방위각 차의 코사인)
  const off = ((input.azimuthDeg - 180 + 540) % 360) - 180;
  items.push({
    id: 'orientation',
    label: '향',
    max: 15,
    score: 15 * ((1 + Math.cos((off * Math.PI) / 180)) / 2),
    detail: `정남에서 ${Math.round(Math.abs(off))}°`,
  });
  if (input.svf !== null) {
    const openness = clamp01(input.svf / 0.5);
    items.push({
      id: 'sky',
      label: '개방감',
      max: 15,
      score: 15 * openness,
      detail: `하늘 개방도 ${Math.round(openness * 100)}%`,
    });
  }
  // 층: 전체의 절반 높이까지 오를수록 가점, 그 위는 만점, 최상층은 소폭 감점(누수·단열 부담 관례)
  const rel = input.topFloor > 0 ? input.floor / input.topFloor : 0;
  items.push({
    id: 'floor',
    label: '층',
    max: 10,
    score: input.floor >= input.topFloor && input.topFloor > 1 ? 8 : 10 * clamp01(rel / 0.5),
    detail: `${input.floor}층 / ${input.topFloor}층`,
  });
  if (input.elementaryM !== null || input.subwayM !== null) {
    const school = input.elementaryM === null ? 0 : closeness(input.elementaryM, 300, 1500);
    const subway = input.subwayM === null ? 0 : closeness(input.subwayM, 500, 2000);
    items.push({
      id: 'location',
      label: '입지',
      max: 15,
      score: 7.5 * school + 7.5 * subway,
      detail: [
        input.elementaryM !== null ? `초등학교 ${Math.round(input.elementaryM)}m` : '초등학교 1.5km 밖',
        input.subwayM !== null ? `지하철 ${Math.round(input.subwayM)}m` : '지하철 2km 밖',
      ].join(' · '),
    });
  }
  const max = items.reduce((s, i) => s + i.max, 0);
  const total = Math.round((items.reduce((s, i) => s + i.score, 0) / max) * 100);
  const grade = total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';
  return { total, grade, items: items.map((i) => ({ ...i, score: Math.round(i.score * 10) / 10 })) };
}
