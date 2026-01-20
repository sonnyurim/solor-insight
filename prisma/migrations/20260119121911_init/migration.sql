-- CreateTable
CREATE TABLE "sessions" (
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "conversation_id" BIGSERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "smp_prices_hourly" (
    "price_id" BIGSERIAL NOT NULL,
    "price_date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "price_value" DECIMAL(10,2) NOT NULL,
    "region_type" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "smp_prices_hourly_pkey" PRIMARY KEY ("price_id")
);

-- CreateTable
CREATE TABLE "smp_prices_daily" (
    "price_id" BIGSERIAL NOT NULL,
    "price_date" DATE NOT NULL,
    "max_price" DECIMAL(10,2) NOT NULL,
    "min_price" DECIMAL(10,2) NOT NULL,
    "avg_price" DECIMAL(10,2) NOT NULL,
    "region_type" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "smp_prices_daily_pkey" PRIMARY KEY ("price_id")
);

-- CreateTable
CREATE TABLE "smp_prices_monthly" (
    "price_id" BIGSERIAL NOT NULL,
    "price_month" DATE NOT NULL,
    "smp_land" DECIMAL(10,2) NOT NULL,
    "smp_jeju" DECIMAL(10,2) NOT NULL,
    "smp_total" DECIMAL(10,2) NOT NULL,
    "blmp" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "smp_prices_monthly_pkey" PRIMARY KEY ("price_id")
);

-- CreateIndex
CREATE INDEX "conversations_session_id_idx" ON "conversations"("session_id");

-- CreateIndex
CREATE INDEX "smp_prices_hourly_region_type_price_date_idx" ON "smp_prices_hourly"("region_type", "price_date");

-- CreateIndex
CREATE UNIQUE INDEX "smp_prices_hourly_price_date_hour_region_type_key" ON "smp_prices_hourly"("price_date", "hour", "region_type");

-- CreateIndex
CREATE INDEX "smp_prices_daily_region_type_price_date_idx" ON "smp_prices_daily"("region_type", "price_date");

-- CreateIndex
CREATE UNIQUE INDEX "smp_prices_daily_price_date_region_type_key" ON "smp_prices_daily"("price_date", "region_type");

-- CreateIndex
CREATE INDEX "smp_prices_monthly_price_month_idx" ON "smp_prices_monthly"("price_month");

-- CreateIndex
CREATE UNIQUE INDEX "smp_prices_monthly_price_month_key" ON "smp_prices_monthly"("price_month");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
