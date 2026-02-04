/**
 * 발전량 집계 스크립트
 * 
 * Phase 3: raw_generation → agg_daily → agg_weekly → agg_monthly
 * 
 * 집계 흐름:
 * 1. 일별 집계 (agg_daily)
 * 2. 주별 집계 (agg_weekly) - 일별 집계 기반
 * 3. 월별 집계 (agg_monthly) - 일별 집계 기반
 */

import { PrismaClient } from '@prisma/client'
import {
  formatDate,
  addDays,
  logProgress,
  logSuccess,
  logError,
  logInfo,
} from './utils/helpers'

const prisma = new PrismaClient()

/**
 * 계절 판별
 */
function getSeason(month: number): string {
  if ([3, 4, 5].includes(month)) return 'SPRING'
  if ([6, 7, 8].includes(month)) return 'SUMMER'
  if ([9, 10, 11].includes(month)) return 'FALL'
  return 'WINTER'
}

/**
 * ISO 주차 계산
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

/**
 * 주의 시작일(월요일)과 종료일(일요일) 계산
 */
function getWeekDates(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  return { start: monday, end: sunday }
}

// ==================== 일별 집계 ====================

async function aggregateDaily(date: Date): Promise<number> {
  // raw_generation에서 해당 날짜의 시간별 데이터 집계
  const dailyData = await prisma.$queryRaw<Array<{
    region_id: bigint
    is_estimated: boolean
    total_kwh: number
    avg_kwh: number
    max_kwh: number
    max_hour: number | null
  }>>`
    WITH hourly AS (
      SELECT 
        region_id,
        is_estimated,
        hour,
        generation_kwh
      FROM raw_generation
      WHERE trade_date = ${date}
    ),
    aggregated AS (
      SELECT 
        region_id,
        is_estimated,
        SUM(generation_kwh) as total_kwh,
        AVG(generation_kwh) as avg_kwh,
        MAX(generation_kwh) as max_kwh
      FROM hourly
      GROUP BY region_id, is_estimated
    ),
    peak AS (
      SELECT DISTINCT ON (region_id, is_estimated)
        region_id,
        is_estimated,
        hour as max_hour
      FROM hourly
      ORDER BY region_id, is_estimated, generation_kwh DESC
    )
    SELECT 
      a.region_id,
      a.is_estimated,
      a.total_kwh,
      a.avg_kwh,
      a.max_kwh,
      p.max_hour
    FROM aggregated a
    LEFT JOIN peak p ON a.region_id = p.region_id AND a.is_estimated = p.is_estimated
  `

  if (dailyData.length === 0) return 0

  let savedCount = 0

  for (const data of dailyData) {
    try {
      await prisma.aggDaily.upsert({
        where: {
          regionId_date: {
            regionId: data.region_id,
            date,
          },
        },
        update: {
          totalKwh: data.total_kwh,
          avgKwh: data.avg_kwh,
          maxKwh: data.max_kwh,
          maxHour: data.max_hour,
          isEstimated: data.is_estimated,
        },
        create: {
          regionId: data.region_id,
          date,
          totalKwh: data.total_kwh,
          avgKwh: data.avg_kwh,
          maxKwh: data.max_kwh,
          maxHour: data.max_hour,
          isEstimated: data.is_estimated,
        },
      })
      savedCount++
    } catch {
      // 개별 실패 무시
    }
  }

  return savedCount
}

// ==================== 주별 집계 ====================

async function aggregateWeekly(year: number, week: number): Promise<number> {
  const { start, end } = getWeekDates(year, week)

  // agg_daily에서 해당 주의 데이터 집계
  const weeklyData = await prisma.$queryRaw<Array<{
    region_id: bigint
    is_estimated: boolean
    total_kwh: number
    avg_kwh: number
  }>>`
    SELECT 
      region_id,
      is_estimated,
      SUM(total_kwh) as total_kwh,
      AVG(total_kwh) as avg_kwh
    FROM agg_daily
    WHERE date >= ${start} AND date <= ${end}
    GROUP BY region_id, is_estimated
  `

  if (weeklyData.length === 0) return 0

  let savedCount = 0

  for (const data of weeklyData) {
    try {
      await prisma.aggWeekly.upsert({
        where: {
          regionId_year_weekNo: {
            regionId: data.region_id,
            year,
            weekNo: week,
          },
        },
        update: {
          startDate: start,
          endDate: end,
          totalKwh: data.total_kwh,
          avgKwh: data.avg_kwh,
          isEstimated: data.is_estimated,
        },
        create: {
          regionId: data.region_id,
          year,
          weekNo: week,
          startDate: start,
          endDate: end,
          totalKwh: data.total_kwh,
          avgKwh: data.avg_kwh,
          isEstimated: data.is_estimated,
        },
      })
      savedCount++
    } catch {
      // 개별 실패 무시
    }
  }

  return savedCount
}

// ==================== 월별 집계 ====================

async function aggregateMonthly(year: number, month: number): Promise<number> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // 해당 월의 마지막 날

  // agg_daily에서 해당 월의 데이터 집계
  const monthlyData = await prisma.$queryRaw<Array<{
    region_id: bigint
    is_estimated: boolean
    total_kwh: number
    avg_kwh: number
    max_date: Date | null
    max_kwh: number | null
  }>>`
    WITH daily AS (
      SELECT 
        region_id,
        is_estimated,
        date,
        total_kwh
      FROM agg_daily
      WHERE date >= ${startDate} AND date <= ${endDate}
    ),
    aggregated AS (
      SELECT 
        region_id,
        is_estimated,
        SUM(total_kwh) as total_kwh,
        AVG(total_kwh) as avg_kwh,
        MAX(total_kwh) as max_kwh
      FROM daily
      GROUP BY region_id, is_estimated
    ),
    max_day AS (
      SELECT DISTINCT ON (region_id, is_estimated)
        region_id,
        is_estimated,
        date as max_date
      FROM daily
      ORDER BY region_id, is_estimated, total_kwh DESC
    )
    SELECT 
      a.region_id,
      a.is_estimated,
      a.total_kwh,
      a.avg_kwh,
      m.max_date,
      a.max_kwh
    FROM aggregated a
    LEFT JOIN max_day m ON a.region_id = m.region_id AND a.is_estimated = m.is_estimated
  `

  if (monthlyData.length === 0) return 0

  const season = getSeason(month)
  let savedCount = 0

  for (const data of monthlyData) {
    try {
      await prisma.aggMonthly.upsert({
        where: {
          regionId_year_month: {
            regionId: data.region_id,
            year,
            month,
          },
        },
        update: {
          totalKwh: data.total_kwh,
          avgKwh: data.avg_kwh,
          maxDate: data.max_date,
          maxKwh: data.max_kwh,
          season,
          isEstimated: data.is_estimated,
        },
        create: {
          regionId: data.region_id,
          year,
          month,
          totalKwh: data.total_kwh,
          avgKwh: data.avg_kwh,
          maxDate: data.max_date,
          maxKwh: data.max_kwh,
          season,
          isEstimated: data.is_estimated,
        },
      })
      savedCount++
    } catch {
      // 개별 실패 무시
    }
  }

  return savedCount
}

// ==================== 전체 집계 ====================

async function aggregateAll() {
  // 1. 일별 집계
  logInfo('📅 일별 집계 시작...')

  const dates = await prisma.$queryRaw<Array<{ trade_date: Date }>>`
    SELECT DISTINCT trade_date FROM raw_generation ORDER BY trade_date
  `

  let dailyCount = 0
  for (let i = 0; i < dates.length; i++) {
    const count = await aggregateDaily(dates[i].trade_date)
    dailyCount += count

    if ((i + 1) % 30 === 0 || i === dates.length - 1) {
      logProgress(i + 1, dates.length, `일별 집계: ${dailyCount.toLocaleString()}건`)
    }
  }
  logSuccess(`일별 집계 완료: ${dailyCount.toLocaleString()}건`)

  // 2. 주별 집계
  logInfo('\n📆 주별 집계 시작...')

  const weeks = await prisma.$queryRaw<Array<{ year: number; week: number }>>`
    SELECT DISTINCT 
      EXTRACT(ISOYEAR FROM date)::int as year,
      EXTRACT(WEEK FROM date)::int as week
    FROM agg_daily
    ORDER BY year, week
  `

  let weeklyCount = 0
  for (let i = 0; i < weeks.length; i++) {
    const count = await aggregateWeekly(weeks[i].year, weeks[i].week)
    weeklyCount += count

    if ((i + 1) % 10 === 0 || i === weeks.length - 1) {
      logProgress(i + 1, weeks.length, `주별 집계: ${weeklyCount.toLocaleString()}건`)
    }
  }
  logSuccess(`주별 집계 완료: ${weeklyCount.toLocaleString()}건`)

  // 3. 월별 집계
  logInfo('\n📊 월별 집계 시작...')

  const months = await prisma.$queryRaw<Array<{ year: number; month: number }>>`
    SELECT DISTINCT 
      EXTRACT(YEAR FROM date)::int as year,
      EXTRACT(MONTH FROM date)::int as month
    FROM agg_daily
    ORDER BY year, month
  `

  let monthlyCount = 0
  for (let i = 0; i < months.length; i++) {
    const count = await aggregateMonthly(months[i].year, months[i].month)
    monthlyCount += count

    if ((i + 1) % 3 === 0 || i === months.length - 1) {
      logProgress(i + 1, months.length, `월별 집계: ${monthlyCount.toLocaleString()}건`)
    }
  }
  logSuccess(`월별 집계 완료: ${monthlyCount.toLocaleString()}건`)

  return { dailyCount, weeklyCount, monthlyCount }
}

async function aggregateDateRange(startDate: Date, endDate: Date) {
  logInfo(`집계 기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}`)

  // 일별 집계
  let currentDate = new Date(startDate)
  let dailyCount = 0

  while (currentDate <= endDate) {
    const count = await aggregateDaily(currentDate)
    dailyCount += count
    currentDate = addDays(currentDate, 1)
  }
  logSuccess(`일별 집계 완료: ${dailyCount.toLocaleString()}건`)

  // 주별/월별 집계
  const processedWeeks = new Set<string>()
  const processedMonths = new Set<string>()

  currentDate = new Date(startDate)
  let weeklyCount = 0
  let monthlyCount = 0

  while (currentDate <= endDate) {
    // 주별
    const { year, week } = getISOWeek(currentDate)
    const weekKey = `${year}-${week}`
    if (!processedWeeks.has(weekKey)) {
      const count = await aggregateWeekly(year, week)
      weeklyCount += count
      processedWeeks.add(weekKey)
    }

    // 월별
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth() + 1
    const monthKey = `${y}-${m}`
    if (!processedMonths.has(monthKey)) {
      const count = await aggregateMonthly(y, m)
      monthlyCount += count
      processedMonths.add(monthKey)
    }

    currentDate = addDays(currentDate, 1)
  }

  logSuccess(`주별 집계 완료: ${weeklyCount.toLocaleString()}건`)
  logSuccess(`월별 집계 완료: ${monthlyCount.toLocaleString()}건`)

  return { dailyCount, weeklyCount, monthlyCount }
}

async function main() {
  console.log('📊 발전량 집계 시작...\n')

  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    console.log(`
사용법:
  tsx scripts/aggregate.ts [옵션]

옵션:
  --all                  전체 기간 집계
  --range START END      특정 기간 집계 (YYYY-MM-DD 형식)
  --daily DATE           특정 날짜 일별 집계만
  --weekly YEAR WEEK     특정 주 주별 집계만
  --monthly YEAR MONTH   특정 월 월별 집계만
  --help                 도움말 표시

예시:
  tsx scripts/aggregate.ts --all
  tsx scripts/aggregate.ts --range 2024-01-01 2024-12-31
  tsx scripts/aggregate.ts --daily 2024-06-15
  tsx scripts/aggregate.ts --weekly 2024 25
  tsx scripts/aggregate.ts --monthly 2024 6

전제조건:
  - raw_generation에 데이터 필요
`)
    process.exit(0)
  }

  try {
    if (args[0] === '--daily' && args[1]) {
      const date = new Date(args[1])
      const count = await aggregateDaily(date)
      logSuccess(`일별 집계 완료 - ${count}건`)

    } else if (args[0] === '--weekly' && args[1] && args[2]) {
      const year = parseInt(args[1])
      const week = parseInt(args[2])
      const count = await aggregateWeekly(year, week)
      logSuccess(`주별 집계 완료 - ${count}건`)

    } else if (args[0] === '--monthly' && args[1] && args[2]) {
      const year = parseInt(args[1])
      const month = parseInt(args[2])
      const count = await aggregateMonthly(year, month)
      logSuccess(`월별 집계 완료 - ${count}건`)

    } else if (args[0] === '--range' && args[1] && args[2]) {
      const startDate = new Date(args[1])
      const endDate = new Date(args[2])
      await aggregateDateRange(startDate, endDate)

    } else {
      await aggregateAll()
    }

    // 최종 통계
    const dailyStats = await prisma.aggDaily.count()
    const weeklyStats = await prisma.aggWeekly.count()
    const monthlyStats = await prisma.aggMonthly.count()

    console.log('\n📈 집계 테이블 현황:')
    console.log(`  agg_daily: ${dailyStats.toLocaleString()}건`)
    console.log(`  agg_weekly: ${weeklyStats.toLocaleString()}건`)
    console.log(`  agg_monthly: ${monthlyStats.toLocaleString()}건`)

  } catch (error) {
    logError('집계 실패', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
