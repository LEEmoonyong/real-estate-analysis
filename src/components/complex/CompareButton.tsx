// [요구사항: 컴포넌트] 단지 비교에 담기 버튼 — 최대 3곳, 담은 뒤에는 "비교 보기" 링크
// [요구사항: 이벤트 처리] onClick(비교 목록 넣기·빼기)
import { Link } from 'react-router-dom';
import { useCompare } from '../../contexts/CompareContext';
import { inCompare } from '../../data/storage/compare';
import { complexPath, type ComplexTarget } from '../../routes/complexKey';
import styles from './Complex.module.css';

interface CompareButtonProps {
  /** 이 단지를 다시 열 수 있는 대상 (실거래 단지 식별자가 붙어 있으면 비교 화면에서 같은 단지를 바로 찾는다) */
  target: ComplexTarget;
  name: string;
  id: string;
}

export function CompareButton({ target, name, id }: CompareButtonProps) {
  const { list, toggle } = useCompare();
  const on = inCompare(list, id);
  return (
    <>
      <button
        type="button"
        className={styles.watchButton}
        aria-pressed={on}
        onClick={() => toggle({ id, name, path: complexPath(target, 'price') })}
        title="최대 3곳까지 담아 나란히 비교합니다"
      >
        {on ? '✓ 비교에 담음' : '+ 비교에 담기'}
      </button>
      {list.length > 0 && (
        <Link to="/compare" className={styles.watchButton}>
          비교 보기 ({list.length})
        </Link>
      )}
    </>
  );
}
