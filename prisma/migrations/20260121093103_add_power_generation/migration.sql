-- CreateTable
CREATE TABLE "region_master" (
    "sigungu_code" VARCHAR(10) NOT NULL,
    "sigungu_name" VARCHAR(50) NOT NULL,
    "sido_code" VARCHAR(10) NOT NULL,
    "sido_name" VARCHAR(50) NOT NULL,
    "installed_capacity_mw" DECIMAL(10,3),
    "facility_count" INTEGER,
    "capacity_updated_at" TIMESTAMP(3),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "grid_y" SMALLINT,
    "grid_x" SMALLINT,
    "grid_calculated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "region_master_pkey" PRIMARY KEY ("sigungu_code")
);

-- CreateTable
CREATE TABLE "power_generation" (
    "id" BIGSERIAL NOT NULL,
    "measurement_datetime" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "month_name" VARCHAR(10) NOT NULL,
    "day" SMALLINT NOT NULL,
    "hour" SMALLINT NOT NULL,
    "hour_range" VARCHAR(10) NOT NULL,
    "week_of_year" SMALLINT NOT NULL,
    "quarter" SMALLINT NOT NULL,
    "season" VARCHAR(10) NOT NULL,
    "season_kr" VARCHAR(10) NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "day_name" VARCHAR(10) NOT NULL,
    "is_weekend" BOOLEAN NOT NULL DEFAULT false,
    "sigungu_code" VARCHAR(10) NOT NULL,
    "sigungu_name" VARCHAR(50) NOT NULL,
    "sido_name" VARCHAR(50) NOT NULL,
    "power_mw" DECIMAL(10,3) NOT NULL,
    "power_kwh" DECIMAL(13,3) NOT NULL,
    "data_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "power_generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "power_generation_daily" (
    "id" BIGSERIAL NOT NULL,
    "date" DATE NOT NULL,
    "sigungu_code" VARCHAR(10) NOT NULL,
    "sigungu_name" VARCHAR(50),
    "sido_name" VARCHAR(50),
    "total_generation" DECIMAL(10,3),
    "avg_generation" DECIMAL(10,3),
    "max_generation" DECIMAL(10,3),
    "min_generation" DECIMAL(10,3),
    "peak_hour" SMALLINT,
    "data_count" SMALLINT NOT NULL DEFAULT 24,
    "data_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "power_generation_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "region_master_sigungu_name_key" ON "region_master"("sigungu_name");

-- CreateIndex
CREATE INDEX "region_master_sido_code_idx" ON "region_master"("sido_code");

-- CreateIndex
CREATE INDEX "region_master_sido_name_idx" ON "region_master"("sido_name");

-- CreateIndex
CREATE INDEX "region_master_latitude_longitude_idx" ON "region_master"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "region_master_grid_y_grid_x_idx" ON "region_master"("grid_y", "grid_x");

-- CreateIndex
CREATE INDEX "power_generation_sigungu_name_season_kr_year_idx" ON "power_generation"("sigungu_name", "season_kr", "year");

-- CreateIndex
CREATE INDEX "power_generation_sido_name_year_month_idx" ON "power_generation"("sido_name", "year", "month");

-- CreateIndex
CREATE INDEX "power_generation_data_type_idx" ON "power_generation"("data_type");

-- CreateIndex
CREATE INDEX "power_generation_hour_idx" ON "power_generation"("hour");

-- CreateIndex
CREATE INDEX "power_generation_measurement_datetime_idx" ON "power_generation"("measurement_datetime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "power_generation_measurement_datetime_sigungu_code_key" ON "power_generation"("measurement_datetime", "sigungu_code");

-- CreateIndex
CREATE INDEX "power_generation_daily_date_idx" ON "power_generation_daily"("date" DESC);

-- CreateIndex
CREATE INDEX "power_generation_daily_sigungu_code_date_idx" ON "power_generation_daily"("sigungu_code", "date" DESC);

-- CreateIndex
CREATE INDEX "power_generation_daily_sigungu_name_date_idx" ON "power_generation_daily"("sigungu_name", "date");

-- CreateIndex
CREATE INDEX "power_generation_daily_sido_name_date_idx" ON "power_generation_daily"("sido_name", "date");

-- CreateIndex
CREATE INDEX "power_generation_daily_data_type_idx" ON "power_generation_daily"("data_type");

-- CreateIndex
CREATE UNIQUE INDEX "power_generation_daily_date_sigungu_code_key" ON "power_generation_daily"("date", "sigungu_code");

-- AddForeignKey
ALTER TABLE "power_generation" ADD CONSTRAINT "power_generation_sigungu_code_fkey" FOREIGN KEY ("sigungu_code") REFERENCES "region_master"("sigungu_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_generation_daily" ADD CONSTRAINT "power_generation_daily_sigungu_code_fkey" FOREIGN KEY ("sigungu_code") REFERENCES "region_master"("sigungu_code") ON DELETE RESTRICT ON UPDATE CASCADE;
