// [요구사항: 컴포넌트] 검색 — 주소·단지명 입력과 후보 목록 (WAI-ARIA combobox 패턴)
// [요구사항: 상태관리] useState — 검색어, 목록 열림, 키보드 선택 위치
// [요구사항: 이벤트 처리] onChange(입력하면 잠시 뒤 연관 검색어), onSubmit, onKeyDown(↑↓ Enter Esc), onBlur, onClick
// [요구사항: Hooks] useEffect — 입력이 멈추면(디바운스) 검색, 타이머 정리
// 후보를 고르면 검색어를 비운다(다음 검색을 바로 입력할 수 있게).
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { GeoResult } from '../../data/geocode/geocodeClient';
import type { SampleIndexEntry } from '../../data/samples/sampleSchema';
import type { DataMode } from '../../hooks/useApiHealth';
import { useGeocode, type SearchCandidate } from '../../hooks/useGeocode';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  mode: DataMode;
  /** 검색 결과 선택 — provider는 최근 검색 기록용 */
  onPickPlace: (result: GeoResult, query: string, provider: 'kakao' | 'vworld') => void;
  /** query는 검색창에서 고른 경우에만 (샘플 버튼과 구별) */
  onPickSample: (sample: SampleIndexEntry, query?: string) => void;
}

/** 입력이 이만큼 멈추면 연관 검색어를 불러온다 [ms] — 글자마다 API를 부르지 않도록 */
const SUGGEST_DELAY_MS = 300;
const SUGGEST_MIN_CHARS = 2;

const candidateLabel = (c: SearchCandidate) => (c.type === 'place' ? c.result.label : c.sample.name);

export function SearchBar({ mode, onPickPlace, onPickSample }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const geo = useGeocode(mode);
  const { search, reset } = geo;
  // 사용자가 직접 입력한 경우에만 자동 검색 (후보를 골라 검색어를 비운 경우는 제외)
  const typedRef = useRef(false);

  // 타이핑만 해도 연관 검색어: 입력이 SUGGEST_DELAY_MS 동안 멈추면 검색하고 목록을 연다
  useEffect(() => {
    if (!typedRef.current) return;
    const q = query.trim();
    if (q.length < SUGGEST_MIN_CHARS) {
      reset();
      setIsOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void search(q);
      setIsOpen(true);
      setActiveIndex(-1);
    }, SUGGEST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, search, reset]);

  const pick = (candidate: SearchCandidate) => {
    if (candidate.type === 'place') {
      onPickPlace(candidate.result, query.trim(), geo.provider === 'vworld' ? 'vworld' : 'kakao');
    } else onPickSample(candidate.sample, query.trim());
    // 검색이 끝났으면 검색어와 후보를 비운다
    typedRef.current = false;
    setQuery('');
    reset();
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    typedRef.current = true;
    setQuery(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search(query);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = geo.candidates.length;
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (!isOpen || count === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      pick(geo.candidates[activeIndex]!);
    }
  };

  const showList = isOpen && geo.status !== 'idle';
  const placeholder =
    mode === 'sample' ? '샘플 지역 검색 (예: 잠실, 해운대, 세종)' : '아파트 단지명 또는 주소 (예: 잠실엘스)';

  return (
    <div className={styles.root} data-tour="search">
      <form role="search" className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor={`${listId}-input`} className={styles.srOnly}>
          아파트 단지명 또는 주소 검색
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          className={styles.input}
          type="search"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() !== '' && geo.candidates.length > 0 && setIsOpen(true)}
          // 목록 클릭이 blur보다 늦게 처리되므로 닫기를 한 프레임 늦춘다
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          data-shortcut="search"
        />
        <button type="submit" className={styles.submit} disabled={geo.status === 'loading'} aria-label="검색">
          {geo.status === 'loading' ? '…' : '검색'}
        </button>
      </form>

      {showList && (
        <div className={styles.dropdown}>
          {geo.status === 'loading' && <p className={styles.message}>검색 중…</p>}
          {geo.error && (
            <p className={styles.message} role="alert">
              {geo.error}
            </p>
          )}
          {geo.candidates.length > 0 && (
            <ul id={listId} role="listbox" aria-label="검색 결과" className={styles.list}>
              {geo.candidates.map((c, i) => (
                <li
                  key={c.type === 'place' ? `p-${c.result.lat}-${c.result.lng}-${c.result.label}` : `s-${c.sample.id}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={styles.option}
                  onMouseDown={(e) => e.preventDefault()} // 입력창 blur 방지
                  onClick={() => pick(c)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {c.type === 'sample' ? '★' : c.result.kind === 'place' ? '🏢' : '📍'}
                  </span>
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{candidateLabel(c)}</span>
                    <span className={styles.optionSub}>
                      {c.type === 'sample' ? '샘플 지역 (API 키 없이 사용)' : c.result.address}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
