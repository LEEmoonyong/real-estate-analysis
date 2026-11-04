// [요구사항: 컴포넌트] 참고 기준 충족 배지 + 조건별 부족 시간
import type { CriteriaEvaluation } from '../../domain/sunlight/criteria';
import type { SunlightCriteria } from '../../domain/types';
import { formatMinute } from '../../domain/time/kst';
import styles from './UnitDetail.module.css';

interface CriteriaBadgeProps {
  evaluation: CriteriaEvaluation;
  criteria: SunlightCriteria;
}

const hours = (min: number) => (min % 60 === 0 ? `${min / 60}시간` : `${Math.floor(min / 60)}시간 ${min % 60}분`);

export function CriteriaBadge({ evaluation, criteria }: CriteriaBadgeProps) {
  return (
    <div className={styles.criteria}>
      <span className={`${styles.badge} ${evaluation.meets ? styles.ok : styles.ng}`}>
        {evaluation.meets ? '참고 기준 충족' : '참고 기준 미충족'}
      </span>
      <ul className={styles.conditions}>
        <li>
          {evaluation.continuousOk ? '✔' : '✘'} {formatMinute(criteria.continuousStartMin)}~
          {formatMinute(criteria.continuousEndMin)} 연속 {hours(criteria.continuousRequiredMin)}
          {!evaluation.continuousOk && <em> ({hours(evaluation.continuousShortfallMin)} 부족)</em>}
        </li>
        <li>
          {evaluation.totalOk ? '✔' : '✘'} {formatMinute(criteria.totalStartMin)}~{formatMinute(criteria.totalEndMin)}{' '}
          총 {hours(criteria.totalRequiredMin)}
          {!evaluation.totalOk && <em> ({hours(evaluation.totalShortfallMin)} 부족)</em>}
        </li>
      </ul>
    </div>
  );
}
