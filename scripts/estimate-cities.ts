/**
 * 시군구 발전량 추정 스크립트
 * 
 * Phase 2: 광역시도 발전량 + 일사량 비율 → 시군구 발전량 추정
 * 
 * 공식: 시군구 발전량 = 상위 광역시도 발전량 × (시군구 일사량 / 광역시도 전체 일사량)
 * 
 * 저장 테이블: raw_generation (is_estimated = true)
 */

import { PrismaClient } from '@prisma/client'
import {
  formatDate,
  addDays,
  logProgress,
  logSuccess,
  logError,
  logInfo,
  logWarning,
} from './utils/helpers'

const prisma = new PrismaClient()

// 캐시
let provinceCache: Map<bigint, { id: bigint; name: string }> | null = null
let cityCache: Map<bigint, Array<{ id: bigint; name: string; parentId: bigint }>> | null = null

async function getProvinces(): Promise<Map<bigint, { id: bigint; name: string }>> {
  if (provinceCache) return provinceCache

  const provinces = await prisma.region.findMany({
    where: { type: 'PROVINCE' },
    select: { id: true, name: true },
  })

  provinceCache = new Map()
  for (const p of provinces) {
    provinceCache.set(p.id, p)
  }

  return provinceCache
}

async function getCitiesByProvince(): Promise<Map<bigint, Array<{ id: bigint; name: string; parentId: bigint }>>> {
  if (cityCache) return cityCache

  const cities = await prisma.region.findMany({
    where: { type: 'CITY', parentId: { not: null } },
    select: { id: true, name: true, parentId: true },
  })

  cityCache = new Map()
  for (const city of cities) {
    if (!city.parentId) continue
    
    if (!cityCache.has(city.parentId)) {
      cityCache.set(city.parentId, [])
    }
    cityCache.get(city.parentId)!.push({
      id: city.id,
      name: city.name,
      parentId: city.parentId,
    })
  }

  return cityCache
}

/**
 * 특정 날짜의 시군구 발전량 추정
 */
async function estimateCitiesForDate(date: Date): Promise<number> {
  const provinces = await getProvinces()
  const citiesByProvince = await getCitiesByProvince()

  let totalEstimated = 0

  for (const [provinceId] of provinces) {
    const cities = citiesByProvince.get(provinceId)
    if (!cities || cities.length === 0) continue

    // 광역시도 시간별 발전량 조회
    const provinceGeneration = await prisma.rawGeneration.findMany({
      where: {
        regionId: provinceId,
        tradeDate: date,
        isEstimated: false,
      },
      orderBy: { hour: 'asc' },
    })

    if (provinceGeneration.length === 0) {
      continue
    }

    // 광역시도 시간별 발전량 맵: { hour: generationKwh }
    const provinceGenMap = new Map<number, number>()
    for (const gen of provinceGeneration) {
      provinceGenMap.set(gen.hour, Number(gen.generationKwh))
    }

    // 광역시도 전체 시간별 일사량 조회 (광역시도 + 산하 시군구)
    const allRegionIds = [provinceId, ...cities.map(c => c.id)]
    
    const provinceIrradiance = await prisma.$queryRaw<Array<{ hour: number; total_ghi: number }>>`
      SELECT 
        EXTRACT(HOUR FROM datetime)::int as hour,
        SUM(ghi) as total_ghi
      FROM raw_irradiance
      WHERE region_id = ANY(${allRegionIds}::bigint[])
        AND DATE(datetime) = ${date}
      GROUP BY EXTRACT(HOUR FROM datetime)
    `

    // 광역시도 시간별 일사량 맵: { hour: totalGhi }
    const provinceGhiMap = new Map<number, number>()
    for (const ir of provinceIrradiance) {
      provinceGhiMap.set(ir.hour, Number(ir.total_ghi))
    }

    // 시군구별 추정
    for (const city of cities) {
      // 시군구 시간별 일사량 조회
      const cityIrradiance = await prisma.$queryRaw<Array<{ hour: number; ghi: number }>>`
        SELECT 
          EXTRACT(HOUR FROM datetime)::int as hour,
          ghi
        FROM raw_irradiance
        WHERE region_id = ${city.id}
          AND DATE(datetime) = ${date}
      `

      // 시군구 시간별 일사량 맵: { hour: ghi }
      const cityGhiMap = new Map<number, number>()
      for (const ir of cityIrradiance) {
        cityGhiMap.set(ir.hour, Number(ir.ghi))
      }

      // 시간별 추정
      const estimatedRecords: Array<{
        regionId: bigint
        tradeDate: Date
        hour: number
        generationKwh: number
        isEstimated: boolean
      }> = []

      for (let hour = 0; hour < 24; hour++) {
        const provinceGen = provinceGenMap.get(hour)
        const provinceGhi = provinceGhiMap.get(hour)
        const cityGhi = cityGhiMap.get(hour)

        // 필요한 데이터가 모두 있어야 함
        if (provinceGen === undefined || !provinceGhi || provinceGhi === 0) {
          continue
        }

        // 일사량 비율 계산 (시군구 / 광역시도 전체)
        const ratio = cityGhi !== undefined ? cityGhi / provinceGhi : 1 / cities.length

        // 이상 비율 체크 (200% 초과 → 균등 배분으로 대체)
        const safeRatio = ratio > 2.0 ? 1 / cities.length : ratio

        // 추정 발전량
        const estimatedGen = provinceGen * safeRatio

        estimatedRecords.push({
          regionId: city.id,
          tradeDate: date,
          hour,
          generationKwh: estimatedGen,
          isEstimated: true,
        })
      }

      // DB 저장
      for (const record of estimatedRecords) {
        try {
          await prisma.rawGeneration.upsert({
            where: {
              regionId_tradeDate_hour: {
                regionId: record.regionId,
                tradeDate: record.tradeDate,
                hour: record.hour,
              },
            },
            update: {
              generationKwh: record.generationKwh,
            },
            create: record,
          })
          totalEstimated++
        } catch {
          // 개별 실패 무시
        }
      }
    }
  }

  return totalEstimated
}

/**
 * 특정 날짜 범위 추정
 */
async function estimateDateRange(startDate: Date, endDate: Date) {
  logInfo(`추정 기간: ${formatDate(startDate)} ~ ${formatDate(endDate)} (최신→과거 역순)`)

  let currentDate = new Date(endDate)
  let processedDays = 0
  let totalEstimated = 0

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  while (currentDate >= startDate) {
    const dateStr = formatDate(currentDate)

    // 이미 추정된 날짜인지 확인
    const existingCount = await prisma.rawGeneration.count({
      where: {
        tradeDate: currentDate,
        isEstimated: true,
      },
    })

    // 충분히 추정된 경우 스킵 (212 시군구 × 24시간 ≈ 5,000)
    if (existingCount >= 4500) {
      logInfo(`[${dateStr}] 이미 추정됨 (${existingCount}건), 스킵`)
      currentDate = addDays(currentDate, -1)
      continue
    }

    // 광역시도 실제 데이터가 있는지 확인
    const actualCount = await prisma.rawGeneration.count({
      where: {
        tradeDate: currentDate,
        isEstimated: false,
      },
    })

    if (actualCount === 0) {
      logWarning(`[${dateStr}] 광역시도 실제 데이터 없음, 스킵`)
      currentDate = addDays(currentDate, -1)
      continue
    }

    logInfo(`[${dateStr}] 시군구 추정 중...`)

    try {
      const count = await estimateCitiesForDate(currentDate)
      totalEstimated += count
      processedDays++

      logSuccess(`[${dateStr}] 완료 - ${count}건 추정`)
      logProgress(processedDays, totalDays, `총 ${totalEstimated.toLocaleString()}건`)

    } catch (error) {
      logError(`[${dateStr}] 추정 실패`, error)
    }

    currentDate = addDays(currentDate, -1)
  }

  logSuccess(`전체 완료 - ${processedDays}일 처리, ${totalEstimated.toLocaleString()}건 추정`)
}

async function main() {
  console.log('🔄 시군구 발전량 추정 시작...\n')

  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    console.log(`
사용법:
  tsx scripts/estimate-cities.ts [옵션]

옵션:
  --all                  전체 기간 추정 (실제 데이터 있는 날짜)
  --range START END      특정 기간 추정 (YYYY-MM-DD 형식)
  --date DATE            특정 날짜만 추정
  --help                 도움말 표시

예시:
  tsx scripts/estimate-cities.ts --all
  tsx scripts/estimate-cities.ts --range 2024-01-01 2024-12-31
  tsx scripts/estimate-cities.ts --date 2024-06-15

전제조건:
  - raw_generation에 광역시도 실제 데이터 필요 (is_estimated = false)
  - raw_irradiance에 일사량 데이터 필요 (선택, 없으면 균등 배분)
`)
    process.exit(0)
  }

  try {
    if (args[0] === '--date' && args[1]) {
      const date = new Date(args[1])
      const count = await estimateCitiesForDate(date)
      logSuccess(`완료 - ${count}건 추정`)

    } else if (args[0] === '--range' && args[1] && args[2]) {
      const startDate = new Date(args[1])
      const endDate = new Date(args[2])
      await estimateDateRange(startDate, endDate)

    } else {
      // 기본: 실제 데이터가 있는 전체 기간
      const oldest = await prisma.rawGeneration.findFirst({
        where: { isEstimated: false },
        orderBy: { tradeDate: 'asc' },
        select: { tradeDate: true },
      })
      const newest = await prisma.rawGeneration.findFirst({
        where: { isEstimated: false },
        orderBy: { tradeDate: 'desc' },
        select: { tradeDate: true },
      })

      if (!oldest || !newest) {
        logWarning('광역시도 실제 데이터가 없습니다. 먼저 collect-generation.ts를 실행하세요.')
        process.exit(1)
      }

      await estimateDateRange(oldest.tradeDate, newest.tradeDate)
    }

    // 결과 통계
    const stats = await prisma.$queryRaw<Array<{ year: number; is_estimated: boolean; count: bigint }>>`
      SELECT 
        EXTRACT(YEAR FROM trade_date)::int as year,
        is_estimated,
        COUNT(*) as count
      FROM raw_generation
      GROUP BY year, is_estimated
      ORDER BY year, is_estimated
    `

    console.log('\n📈 연도별 발전량 데이터 현황:')
    for (const stat of stats) {
      const type = stat.is_estimated ? '추정' : '실제'
      console.log(`  ${stat.year}년 [${type}]: ${Number(stat.count).toLocaleString()}건`)
    }

  } catch (error) {
    logError('추정 실패', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
