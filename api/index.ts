// Vercel 서버리스 함수 진입점 (Web 표준 fetch 핸들러).
// vercel.json rewrites로 /api/* 요청이 모두 이 함수로 들어온다.
import { routeApi } from '../server/router';

export default {
  fetch(request: Request): Promise<Response> {
    return routeApi(request, {
      KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY,
      VWORLD_API_KEY: process.env.VWORLD_API_KEY,
      VWORLD_DOMAIN: process.env.VWORLD_DOMAIN,
    });
  },
};
