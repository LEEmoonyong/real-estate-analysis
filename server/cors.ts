// 로컬 실행 지원 CORS — 키 없이 로컬에서 실행한 앱(http://localhost:포트)이 배포 서버의 /api/*를 빌려 쓸 수 있게 한다.
// 허용 출처는 내 컴퓨터 주소(localhost·127.0.0.1·[::1])뿐이다. 다른 웹사이트가 브라우저에서 이 프록시를 쓰지 못하게 하려는 것.
// (같은 출처인 배포 사이트 자신은 CORS가 필요 없다.)

const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

export function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && LOOPBACK_ORIGIN.test(origin);
}

/** 허용된 출처의 요청이면 응답에 CORS 헤더를 붙인다 */
export function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Origin');
  if (isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 사전 요청(OPTIONS) 응답 — 단순 GET이라 보통은 오지 않지만 브라우저·확장 프로그램에 따라 올 수 있다 */
export function preflight(request: Request): Response {
  return withCors(request, new Response(null, { status: 204 }));
}
