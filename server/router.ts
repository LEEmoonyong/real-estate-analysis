// /api/* 라우터 — Vercel 함수(api/index.ts)와 Vite dev 미들웨어(devApiPlugin.ts)가 공유한다.
import { handleGeocode } from './handlers/geocode';
import { handleHealth } from './handlers/health';
import { handleOverpassBuildings } from './handlers/overpassBuildings';
import { handleVworldBuildings } from './handlers/vworldBuildings';
import { ApiError, errorResponse, type ServerEnv } from './http';

export async function routeApi(request: Request, env: ServerEnv): Promise<Response> {
  try {
    if (request.method !== 'GET') throw new ApiError('BAD_REQUEST', 'GET만 지원합니다.', 405);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    switch (path) {
      case '/api/health':
        return handleHealth(env);
      case '/api/geocode':
        return await handleGeocode(url.searchParams, env);
      case '/api/buildings/vworld':
        return await handleVworldBuildings(url.searchParams, env);
      case '/api/buildings/osm':
        return await handleOverpassBuildings(url.searchParams);
      default:
        throw new ApiError('NOT_FOUND', `알 수 없는 경로: ${path}`, 404);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
