-- =============================================
-- 기존 테이블 삭제 (발전량 관련만)
-- =============================================

DROP TABLE IF EXISTS "irradiance" CASCADE;
DROP TABLE IF EXISTS "power_generation_daily" CASCADE;
DROP TABLE IF EXISTS "power_generation" CASCADE;
DROP TABLE IF EXISTS "region_master" CASCADE;

-- =============================================
-- 새 테이블 생성
-- =============================================

-- 지역 마스터 (계층 구조: 광역시도 + 시군구)
CREATE TABLE "regions" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "parent_id" BIGINT,
    "lat" DECIMAL(10,7),
    "lon" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- 발전량 원시 데이터
CREATE TABLE "raw_generation" (
    "id" BIGSERIAL NOT NULL,
    "region_id" BIGINT NOT NULL,
    "trade_date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "generation_kwh" DECIMAL(15,4) NOT NULL,
    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_generation_pkey" PRIMARY KEY ("id")
);

-- 일사량 원시 데이터
CREATE TABLE "raw_irradiance" (
    "id" BIGSERIAL NOT NULL,
    "region_id" BIGINT NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "ghi" DECIMAL(10,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_irradiance_pkey" PRIMARY KEY ("id")
);

-- 일별 집계
CREATE TABLE "agg_daily" (
    "region_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "total_kwh" DECIMAL(15,4) NOT NULL,
    "avg_kwh" DECIMAL(15,4) NOT NULL,
    "max_kwh" DECIMAL(15,4) NOT NULL,
    "max_hour" SMALLINT,
    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agg_daily_pkey" PRIMARY KEY ("region_id","date")
);

-- 주별 집계
CREATE TABLE "agg_weekly" (
    "region_id" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "week_no" SMALLINT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_kwh" DECIMAL(15,4) NOT NULL,
    "avg_kwh" DECIMAL(15,4) NOT NULL,
    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agg_weekly_pkey" PRIMARY KEY ("region_id","year","week_no")
);

-- 월별 집계
CREATE TABLE "agg_monthly" (
    "region_id" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "total_kwh" DECIMAL(15,4) NOT NULL,
    "avg_kwh" DECIMAL(15,4) NOT NULL,
    "max_date" DATE,
    "max_kwh" DECIMAL(15,4),
    "season" VARCHAR(10),
    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agg_monthly_pkey" PRIMARY KEY ("region_id","year","month")
);

-- =============================================
-- 유니크 제약 조건
-- =============================================

CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");
CREATE UNIQUE INDEX "raw_generation_region_id_trade_date_hour_key" ON "raw_generation"("region_id", "trade_date", "hour");
CREATE UNIQUE INDEX "raw_irradiance_region_id_datetime_key" ON "raw_irradiance"("region_id", "datetime");

-- =============================================
-- 인덱스
-- =============================================

-- regions
CREATE INDEX "regions_type_idx" ON "regions"("type");
CREATE INDEX "regions_parent_id_idx" ON "regions"("parent_id");

-- raw_generation
CREATE INDEX "raw_generation_trade_date_idx" ON "raw_generation"("trade_date");
CREATE INDEX "raw_generation_is_estimated_idx" ON "raw_generation"("is_estimated");

-- raw_irradiance
CREATE INDEX "raw_irradiance_datetime_idx" ON "raw_irradiance"("datetime");

-- agg_daily
CREATE INDEX "agg_daily_date_idx" ON "agg_daily"("date");
CREATE INDEX "agg_daily_is_estimated_idx" ON "agg_daily"("is_estimated");

-- agg_weekly
CREATE INDEX "agg_weekly_year_week_no_idx" ON "agg_weekly"("year", "week_no");
CREATE INDEX "agg_weekly_is_estimated_idx" ON "agg_weekly"("is_estimated");

-- agg_monthly
CREATE INDEX "agg_monthly_year_month_idx" ON "agg_monthly"("year", "month");
CREATE INDEX "agg_monthly_season_idx" ON "agg_monthly"("season");
CREATE INDEX "agg_monthly_is_estimated_idx" ON "agg_monthly"("is_estimated");

-- =============================================
-- 외래 키
-- =============================================

ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "raw_generation" ADD CONSTRAINT "raw_generation_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "raw_irradiance" ADD CONSTRAINT "raw_irradiance_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agg_daily" ADD CONSTRAINT "agg_daily_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agg_weekly" ADD CONSTRAINT "agg_weekly_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agg_monthly" ADD CONSTRAINT "agg_monthly_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- 코멘트
-- =============================================

COMMENT ON TABLE "regions" IS '지역 마스터 (계층 구조: PROVINCE=광역시도, CITY=시군구)';
COMMENT ON TABLE "raw_generation" IS '발전량 원시 데이터 (is_estimated: false=실제, true=추정)';
COMMENT ON TABLE "raw_irradiance" IS '일사량 원시 데이터 (기상청 API)';
COMMENT ON TABLE "agg_daily" IS '일별 발전량 집계';
COMMENT ON TABLE "agg_weekly" IS '주별 발전량 집계';
COMMENT ON TABLE "agg_monthly" IS '월별 발전량 집계';
