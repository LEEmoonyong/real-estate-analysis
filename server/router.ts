// /api/* 라우터 — Vercel 함수(api/index.ts)와 Vite dev 미들웨어(devApiPlugin.ts)가 공유한다.
import { handleDealPlaces } from './handlers/deals.js';
import { handleMortgageRates } from './handlers/finance.js';
import { handleGeocode } from './handlers/geocode.js';
import { handleNearby } from './handlers/nearby.js';
import { handleHealth } from './handlers/health.js';
import { handleOverpassBuildings } from './handlers/overpassBuildings.js';
import { handleVworldBuildings } from './handlers/vworldBuildings.js';
import {
  handleTradeComplexes,
  handleComplexInfo,
  handleComplexes,
  handleRegion,
  handleRents,
  handleTrades,
} from './handlers/realestate.js';
import { preflight, withCors } from './cors.js';
import { ApiError, errorResponse, type ServerEnv } from './http.js';

export async function routeApi(request: Request, env: ServerEnv): Promise<Response> {
  if (request.method === 'OPTIONS') return preflight(request);
  return withCors(request, await route(request, env));
}

async function route(request: Request, env: ServerEnv): Promise<Response> {
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
      case '/api/finance/mortgage-rates':
        return await handleMortgageRates(env);
      case '/api/nearby':
        return await handleNearby(url.searchParams, env);
      case '/api/region':
        return await handleRegion(url.searchParams, env);
      case '/api/realestate/trades':
        return await handleTrades(url.searchParams, env);
      case '/api/realestate/rents':
        return await handleRents(url.searchParams, env);
      case '/api/realestate/complexes':
        return await handleComplexes(url.searchParams, env);
      case '/api/realestate/trade-complexes':
        return await handleTradeComplexes(url.searchParams, env);
      case '/api/realestate/deal-places':
        return await handleDealPlaces(url.searchParams, env);
      case '/api/realestate/complex':
        return await handleComplexInfo(url.searchParams, env);
      case '/api/buildings/osm':
        return await handleOverpassBuildings(url.searchParams);
      default:
        throw new ApiError('NOT_FOUND', `알 수 없는 경로: ${path}`, 404);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
