# 외부 API 실측 검증 기록

PLAN.md 6장에서 "⚠️ 확인 필요"로 표시한 항목의 실측 결과를 기록한다.
재현 방법: `.env.local`에 키를 넣고 `npm run verify:api` 실행 → 원시 응답은 `scripts/.cache/`(커밋 제외)에 저장된다.

## 상태 요약 (1일차, 2026-11-04)

| 항목 | 상태 | 비고 |
|---|---|---|
| 프록시 `/api/health` | ✅ 동작 | 키 존재 여부만 반환, 키 값 미노출(단위 테스트) |
| 카카오 주소·키워드 검색 | ✅ 동작 | 아래 상세 |
| V-World 지오코더·검색 | ❌ `INVALID_KEY` | 키 재확인 필요 (아래) |
| V-World `LT_C_BLDGINFO` | ❌ `INVALID_KEY` | GeoJSON 경로, 지오메트리 타입, ID 필드, `height` 누락 비율 미확인 |

## 카카오 로컬 실측 (2026-11-04)

- REST API 키 + `Authorization: KakaoAK` 헤더로 정상 응답. 웹 플랫폼 도메인 등록 없이 서버 호출 가능.
- 응답 형식이 공식 문서와 일치: `documents[].x/y`는 문자열, 키워드 검색은 `place_name`·`category_name`·`road_address_name` 포함.
- 단지명 검색("잠실엘스", "해운대 마린시티", "세종 한솔동 첫마을")은 주소 검색 결과가 0건이고 키워드 검색으로만 찾아진다 → 병렬 호출 설계가 맞다.
- 키워드 결과에 "잠실엘스아파트 서문"(카테고리 `교통,수송 > 입출구`)처럼 출입구 POI가 섞인다. 아파트 카테고리를 앞에 정렬하는 현재 방식으로 첫 후보는 단지 자체가 된다.

## V-World 실측 (2026-11-04)

- 지오코더·2D 데이터 모두 `INVALID_KEY`("등록되지 않은 인증키입니다").
- 입력된 키 형식이 `8-4-4-4-11`자리로, 일반적인 UUID 형식(`8-4-4-4-12`)보다 마지막 묶음이 한 글자 짧다 → 복사 누락 가능성. 발급 직후라 승인·활성화 대기일 가능성도 있다.
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
