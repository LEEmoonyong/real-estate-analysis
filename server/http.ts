// 프록시 공통 유틸: 타임아웃·재시도·표준 에러 응답
// [요구사항: 데이터 처리] 외부 API 호출은 모두 이 계층을 거친다.

export type ApiErrorCode = 'NO_KEY' | 'BAD_REQUEST' | 'UPSTREAM' | 'TIMEOUT' | 'NOT_FOUND' | 'QUOTA';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/** 서버 환경변수 (VITE_ 접두사 없음 → 클라이언트 번들에 포함되지 않음) */
export interface ServerEnv {
  KAKAO_REST_API_KEY?: string | undefined;
  VWORLD_API_KEY?: string | undefined;
  VWORLD_DOMAIN?: string | undefined;
}

export const USER_AGENT = 'SunlightSimulator/0.1 (university React project)';

export function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  headers['Cache-Control'] = cacheSeconds > 0 ? `public, s-maxage=${cacheSeconds}` : 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ ok: false, code: err.code, message: err.message }, err.status);
  }
  const message = err instanceof Error ? err.message : String(err);
  return json({ ok: false, code: 'UPSTREAM', message }, 502);
}

/** 타임아웃과 재시도(기본 1회)를 포함한 fetch. 4xx는 재시도하지 않는다. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 8000, retries = 1 }: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429) throw new ApiError('QUOTA', '업스트림 요청 한도 초과(429)', 503);
      if (res.status >= 500) throw new ApiError('UPSTREAM', `업스트림 오류 ${res.status}`);
      return res;
    } catch (err) {
      lastError =
        err instanceof DOMException && err.name === 'TimeoutError'
          ? new ApiError('TIMEOUT', `업스트림 응답 시간 초과(${timeoutMs}ms)`, 504)
          : err;
      if (err instanceof ApiError && err.code === 'QUOTA') break;
    }
  }
  throw lastError;
}

export function requireNumber(params: URLSearchParams, name: string, min: number, max: number): number {
  const raw = params.get(name);
  const value = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ApiError('BAD_REQUEST', `${name}는 ${min}~${max} 범위의 숫자여야 합니다.`, 400);
  }
  return value;
}

/** 대한민국 영역 대략적 bbox (경도 124~132, 위도 33~39) */
export function parseCenter(params: URLSearchParams): { lat: number; lng: number; radius: number } {
  return {
    lat: requireNumber(params, 'lat', 33, 39),
    lng: requireNumber(params, 'lng', 124, 132),
    radius: requireNumber(params, 'r', 50, 500),
  };
}
