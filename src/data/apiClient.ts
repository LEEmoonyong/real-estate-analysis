// 프록시(/api/*) 호출 공통 처리 — 서버의 표준 에러 형식 { ok:false, code, message }를 예외로 바꾼다
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

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, signal ? { signal } : {});
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
