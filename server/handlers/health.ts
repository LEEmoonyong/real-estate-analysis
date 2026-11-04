import { json, type ServerEnv } from '../http.js';

/** 클라이언트가 실데이터 모드/샘플 모드를 결정하는 데 쓰는 상태 확인 */
export function handleHealth(env: ServerEnv): Response {
  return json({
    ok: true,
    kakao: Boolean(env.KAKAO_REST_API_KEY),
    vworld: Boolean(env.VWORLD_API_KEY),
    time: new Date().toISOString(),
  });
}
