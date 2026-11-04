// [요구사항: 컴포넌트] 즐겨찾기 목록 (PLAN.md 단계 B5)
// [요구사항: 상태관리] useState — 이름 편집 중인 항목 editingId, 입력값 draftName
// [요구사항: 이벤트 처리] onClick(추가·이동·편집·삭제), onKeyDown(Enter 저장 / Esc 취소), onBlur(저장)
import { useState, type KeyboardEvent } from 'react';
import { useFavorites, useFavoritesActions } from '../../contexts/FavoritesContext';
import { useToast } from '../../contexts/ToastContext';
import type { Place } from '../../domain/types';
import styles from './Favorites.module.css';

export interface NavigateTarget extends Place {
  sampleId?: string;
}

interface FavoritesPanelProps {
  /** 지금 보고 있는 장소 (없으면 추가 버튼 비활성) */
  current: NavigateTarget | null;
  onNavigate: (target: NavigateTarget) => void;
}

export function FavoritesPanel({ current, onNavigate }: FavoritesPanelProps) {
  const { favorites } = useFavorites();
  const { addFavorite, renameFavorite, removeFavorite } = useFavoritesActions();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const handleAdd = () => {
    if (!current) return;
    const added = addFavorite({
      name: current.name,
      lat: current.lat,
      lng: current.lng,
      ...(current.address ? { address: current.address } : {}),
      ...(current.sampleId ? { sampleId: current.sampleId } : {}),
    });
    showToast({ message: added ? `즐겨찾기에 추가했습니다 — ${current.name}` : '이미 즐겨찾기에 있는 장소입니다.' });
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
  };

  const commitEdit = () => {
    if (editingId) renameFavorite(editingId, draftName);
    setEditingId(null);
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // 전역 Esc(선택 해제)로 번지지 않게
      setEditingId(null);
    }
  };

  return (
    <div className={styles.root}>
      <button type="button" className={styles.addButton} onClick={handleAdd} disabled={!current}>
        ★ 현재 위치 추가
      </button>
      {favorites.length === 0 ? (
        <p className={styles.muted}>자주 보는 단지를 ★로 저장해 두면 한 번에 이동할 수 있습니다.</p>
      ) : (
        <ul className={styles.list} aria-label="즐겨찾기">
          {favorites.map((f) => (
            <li key={f.id} className={styles.item}>
              {editingId === f.id ? (
                <input
                  className={styles.editInput}
                  value={draftName}
                  aria-label={`'${f.name}' 새 이름 (Enter 저장, Esc 취소)`}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={commitEdit}
                />
              ) : (
                <button
                  type="button"
                  className={styles.itemButton}
                  onClick={() => onNavigate(f)}
                  title={f.address ?? f.name}
                >
                  <span className={styles.itemName}>{f.name}</span>
                  {f.sampleId && <span className={styles.badge}>샘플</span>}
                </button>
              )}
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`'${f.name}' 이름 변경`}
                onClick={() => startEdit(f.id, f.name)}
                disabled={editingId === f.id}
              >
                ✎
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`'${f.name}' 삭제`}
                onClick={() => removeFavorite(f.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
