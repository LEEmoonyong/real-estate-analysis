// [요구사항: 컴포넌트] 도움말 대화상자 — 키보드 단축키 목록, 시뮬레이션 한계 안내 (PLAN.md 18.3)
import { Modal } from './Modal';
import styles from './Modal.module.css';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Space'], action: '시각 재생 / 정지' },
  { keys: ['←', '→'], action: '시각 10분 이동' },
  { keys: ['Shift', '←/→'], action: '시각 1시간 이동' },
  { keys: ['1'], action: '분석 레이어: 일조 시간' },
  { keys: ['H'], action: '3D 히트맵 켜기 / 끄기' },
  { keys: ['F'], action: '선택한 세대·건물로 카메라 이동' },
  { keys: ['Esc'], action: '선택 해제' },
  { keys: ['/'], action: '검색창으로 이동' },
  { keys: ['?'], action: '이 도움말 열기' },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="키보드 단축키" onClose={onClose}>
      <dl className={styles.keys}>
        {SHORTCUTS.map((s) => (
          <div key={s.action} style={{ display: 'contents' }}>
            <dt>
              {s.keys.map((k) => (
                <kbd key={k} className={styles.kbd}>
                  {k}
                </kbd>
              ))}
            </dt>
            <dd>{s.action}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>검색창 등 글자를 입력하는 중에는 단축키가 동작하지 않습니다.</p>
    </Modal>
  );
}

const LIMITATIONS = [
  '지형 고저차는 반영하지 않습니다. 모든 건물이 같은 평지에 있다고 가정합니다.',
  '건물 높이는 데이터의 높이 또는 층수 × 층고(기본 2.9m)로 추정하며, 일부는 기본값입니다. 건물을 선택해 층수를 직접 보정할 수 있습니다.',
  '발코니·돌출부·옥탑·나무·담장은 반영하지 않고, 건물을 바닥 모양 그대로 세운 단순한 형태로 근사합니다.',
  '일조 판정에는 대기 굴절을 반영하지 않은 기하학적 태양 고도를 씁니다(보수적). 일출·일몰 시각만 표준 보정을 적용합니다.',
  '세대 위치와 호수는 외벽을 6m 간격으로 나눈 추정값이며 실제 평면·호수 체계와 다를 수 있습니다.',
  '일조 기준 판정(동지 09~15시 연속 2시간 또는 08~16시 총 4시간)은 참고용이며 법적 판단이 아닙니다.',
  '데이터 출처(V-World / OpenStreetMap / 샘플)에 따라 건물 모양·높이의 정확도가 다릅니다.',
];

export function LimitationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="시뮬레이션 한계" onClose={onClose}>
      <ul className={styles.list}>
        {LIMITATIONS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className={styles.note}>
        지도 데이터 © OpenStreetMap contributors (ODbL), 국토교통부 V-World. 태양 위치는 NOAA Solar Calculator 식을 직접
        구현했습니다.
      </p>
    </Modal>
  );
}
