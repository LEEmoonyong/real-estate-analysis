# 외부 API 실측 검증 기록

PLAN.md 6장에서 "⚠️ 확인 필요"로 표시한 항목의 실측 결과를 기록한다.
재현 방법: `.env.local`에 키를 넣고 `npm run verify:api` 실행 → 원시 응답은 `scripts/.cache/`(커밋 제외)에 저장된다.

## 상태 요약 (1일차, 2026-11-04)

| 항목 | 상태 | 비고 |
|---|---|---|
| 프록시 `/api/health` | ✅ 동작 | 키 존재 여부만 반환, 키 값 미노출(단위 테스트) |
| 카카오 주소·키워드 검색 | ⏳ 키 발급 대기 | 코드는 공식 문서 형식대로 구현 완료 |
| V-World 지오코더·검색 | ⏳ 키 발급 대기 | 검색 API의 `response` 래퍼 유무는 두 형태 모두 처리하도록 구현 |
| V-World `LT_C_BLDGINFO` | ⏳ 키 발급 대기 | GeoJSON 경로, 지오메트리 타입, ID 필드, `height` 누락 비율 미확인 |
| OSM Overpass | ✅ 동작 (불안정) | 아래 상세 |
| 태양 위치 기준값 | ✅ 수집 | NOAA 웹 계산기 대신 **NASA/JPL Horizons API** 사용 (아래) |

## OSM Overpass 실측

반경 400m, `way["building"]` + `relation["building"]["type"="multipolygon"]`, `out tags geom`.

| 미러 | 결과 (2026-11-04 02시경 KST) |
|---|---|
| `overpass-api.de` | 502 / 504 (과부하) |
| `overpass.private.coffee` | 60초 무응답 |
| `maps.mail.ru` | 200, 약 26초 |

- **CORS**: OPTIONS 요청에 `Access-Control-*` 헤더가 오지 않았다 → 프록시 경유 결정 유지.
- **결론**: Overpass는 대체 소스로만 쓰고, 채점·시연용 경로는 반드시 샘플 JSON으로 보장한다. 프록시는 마지막 성공 미러를 먼저 시도한다. 클라이언트에는 "OSM 응답 대기 중(최대 30초)" 안내가 필요하다(4일차 반영).

| 샘플 후보 | 건물 수 | `building=apartments` | 층수 태그 | 동 번호 |
|---|---|---|---|---|
| 서울 잠실 (37.5115, 127.0830) | 625 | 221 | 아파트 69/221 (`building:levels`·`height`) | `name` 태그에 "163", "102" 같은 동 번호가 들어 있음 |
| 부산 마린시티 (35.1567, 129.1450) | 49 | 33 | 49/49 (`height` 35) | "102동" 형태 1건 |
| 세종 한솔동 (36.4795, 127.2560) | — | — | — | 모든 미러 실패, 2일차 재시도 |

→ 잠실은 층수 누락이 많아 샘플에 시연용 층수 보정값이 필요하다(`heightSource`로 구분, README에 명시).

## 태양 위치 기준값 (JPL Horizons)

PLAN.md 9.1의 "NOAA 웹 계산기 기준값"은 **NASA/JPL Horizons API**로 대체했다.
NOAA 식을 독립적으로 검증하려면 다른 방식으로 계산된 기준이 필요하다. Horizons는 DE441 천체력 기반의 고정밀 값을 키 없이 제공한다.

- 요청: `COMMAND='10'`(태양), `CENTER='coord@399'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`(겉보기 방위각·고도), `APPARENT='AIRLESS'`(굴절 미적용)
- 범위: 서울·부산·제주 × 2026-03-20 / 06-21 / 09-23 / 12-22 × KST 06~18시 정각
- 일출·일몰: 1분 간격 고도에서 기하 고도 −0.833° 교차 시각(NOAA 관례와 같은 정의)
- 결과 파일: `src/test/fixtures/sun-reference.json` (생성: `npx tsx scripts/fetch-sun-reference.ts`)
- 기본 확인: 서울 하지 일출 05:11·일몰 19:56, 동지 07:43·17:17 → 천문연 공표값과 일치
