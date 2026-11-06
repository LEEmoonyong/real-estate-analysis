// 프록시(/api/*) 호출 공통 처리 — 서버의 표준 에러 형식 { ok:false, code, message }를 예외로 바꾼다
// 요청 전에 데이터 경로(같은 서버 / 배포 서버 / 샘플 스냅샷)가 정해지기를 기다린다.
import { REMOTE_API_BASE } from '../config/constants';
import { checkApiHealth } from './apiHealth';
import { snapshotResponse } from './marketSnapshot';
export type ApiErrorCode = 'NO_KEY' | 'BAD_REQUEST' | 'UPSTREAM' | 'TIMEOUT' | 'NOT_FOUND' | 'QUOTA' | 'NETWORK';

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * /api/* 요청을 보낼 서버. 기본은 같은 출처(''), 로컬에 키가 없으면 배포 서버 주소로 바꾼다(useApiHealth).
 */
let apiBase = '';

export function setApiBase(base: string): void {
  apiBase = base;
}

export function apiUrl(path: string): string {
  return path.startsWith('/api/') ? apiBase + path : path;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (url.startsWith('/api/')) {
    const health = await checkApiHealth();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    apiBase = health.route === 'remote' ? REMOTE_API_BASE : '';
    // 샘플 모드: 실데이터 서버가 없으니 저장해 둔 샘플 응답으로 대신한다
    if (health.mode === 'sample') {
      const saved = await snapshotResponse(url);
      if (saved === undefined)
        throw new ApiClientError('NOT_FOUND', '샘플 모드에서는 샘플 지역 3곳의 저장 자료만 볼 수 있습니다.');
      return saved as T;
    }
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(url), signal ? { signal } : {});
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiClientError('NETWORK', '데이터 서버에 연결할 수 없습니다.');
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError('UPSTREAM', `응답을 해석할 수 없습니다 (${res.status}).`);
  }
  const b = body as { ok?: boolean; code?: ApiErrorCode; message?: string };
  if (!res.ok || b.ok === false) {
    throw new ApiClientError(b.code ?? 'UPSTREAM', b.message ?? `요청 실패 (${res.status})`);
  }
  return body as T;
}
