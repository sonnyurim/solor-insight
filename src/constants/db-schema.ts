/**
 * DB 스키마 정의
 * LLM에 제공하여 SQL 생성 시 참조하도록 함
 */
export const DB_SCHEMA = `
## 테이블: regions (지역 마스터)
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | BIGINT | PK |
| name | VARCHAR(100) | 지역명 (서울특별시, 고흥군 등) |
| type | VARCHAR(20) | PROVINCE (광역시도) / CITY (시군구) |
| parent_id | BIGINT | 상위 지역 ID (시군구인 경우 광역시도 ID) |
| lat | DECIMAL(10,7) | 위도 |
| lon | DECIMAL(10,7) | 경도 |

## 테이블: raw_generation (시간별 발전량)
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | BIGINT | PK |
| region_id | BIGINT | 지역 ID (FK → regions.id) |
| trade_date | DATE | 거래일자 |
| hour | SMALLINT | 시간 (0-23) |
| generation_kwh | DECIMAL(15,4) | 발전량 (kWh) |
| is_estimated | BOOLEAN | 추정 여부 (false=실제, true=추정) |

## 테이블: agg_daily (일별 집계)
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| region_id | BIGINT | 지역 ID (PK) |
| date | DATE | 날짜 (PK) |
| total_kwh | DECIMAL(15,4) | 일 총 발전량 (kWh) |
| avg_kwh | DECIMAL(15,4) | 일 평균 발전량 (kWh) |
| max_kwh | DECIMAL(15,4) | 일 최대 발전량 (kWh) |
| max_hour | SMALLINT | 피크 시간 |
| is_estimated | BOOLEAN | 추정 여부 |

## 테이블: agg_weekly (주별 집계)
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| region_id | BIGINT | 지역 ID (PK) |
| year | INT | 연도 (PK) |
| week_no | SMALLINT | 주차 (PK) |
| start_date | DATE | 주 시작일 |
| end_date | DATE | 주 종료일 |
| total_kwh | DECIMAL(15,4) | 주 총 발전량 (kWh) |
| avg_kwh | DECIMAL(15,4) | 주 평균 발전량 (kWh) |
| is_estimated | BOOLEAN | 추정 여부 |

## 테이블: agg_monthly (월별 집계)
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| region_id | BIGINT | 지역 ID (PK) |
| year | INT | 연도 (PK) |
| month | SMALLINT | 월 (PK) |
| total_kwh | DECIMAL(15,4) | 월 총 발전량 (kWh) |
| avg_kwh | DECIMAL(15,4) | 월 평균 발전량 (kWh) |
| max_date | DATE | 최대 발전일 |
| max_kwh | DECIMAL(15,4) | 최대 발전량 |
| season | VARCHAR(10) | 계절 (SPRING, SUMMER, FALL, WINTER) |
| is_estimated | BOOLEAN | 추정 여부 |

## 테이블 선택 규칙
- hourly 집계 → raw_generation
- daily 집계 → agg_daily (성능 최적화)
- weekly 집계 → agg_weekly (성능 최적화)
- monthly 집계 → agg_monthly (성능 최적화)

## 지역 유형에 따른 is_estimated 값
- 광역시도 (type='PROVINCE'): is_estimated = false (실제 데이터)
- 시군구 (type='CITY'): is_estimated = true (추정 데이터)

## 조인 패턴
발전량 조회 시 지역명으로 필터링:
\`\`\`sql
SELECT ... FROM raw_generation rg
JOIN regions r ON rg.region_id = r.id
WHERE r.name = '고흥군'
\`\`\`
`;
