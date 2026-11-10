// [요구사항: Hooks] 커스텀 훅 — 단지 상세 머리글 제목. 모든 탭이 같은 이름을 쓰도록 한 곳에서 정한다.
//   좌표 장소: 주소(URL)에 담긴 이름 / 샘플 지역: 샘플 목록의 이름
import { useEffect, useState } from 'react';
import { loadSampleIndex } from '../data/samples/sampleClient';
import type { ComplexTarget } from '../routes/complexKey';

export function useComplexTitle(target: ComplexTarget): string {
  const sampleId = target.kind === 'sample' ? target.sampleId : null;
  const [sample, setSample] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!sampleId) return;
    let cancelled = false;
    void loadSampleIndex()
      .then((index) => {
        const s = index.find((e) => e.id === sampleId);
        if (!cancelled && s) setSample({ id: sampleId, name: s.name });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sampleId]);
  if (target.kind === 'geo') return target.name;
  return sample?.id === sampleId ? sample.name : '샘플 지역';
}
