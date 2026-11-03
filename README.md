# ☀ 전국 단위 3D 아파트 단지 일조량 시뮬레이터

> 개발 중 (1일차). 최종 README 구성은 [PLAN.md 17장](PLAN.md)을 따른다.

## 빠른 실행 (API 키 없이)

```bash
npm install
npm run dev
```

API 키가 없으면 앱이 자동으로 **샘플 모드**로 동작한다. Node.js 22.12 이상이 필요하다.

## 실데이터 실행 (선택)

`.env.example`을 `.env.local`로 복사해 카카오 REST API 키와 V-World 인증키를 넣는다.
키는 서버 프록시(`server/`)에서만 읽으며 클라이언트 번들에는 포함되지 않는다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (`/api/*` 프록시 포함) |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm test` | 단위 테스트 |
| `npm run test:tz` | 다른 시간대(뉴욕)에서 단위 테스트 — 계산이 실행 PC 시간대와 무관한지 확인 |
| `npm run lint` | ESLint |
| `npm run verify:api` | 외부 API 실측 검증 ([docs/api-verification.md](docs/api-verification.md)) |
