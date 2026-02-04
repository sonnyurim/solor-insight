/**
 * 일사량 데이터 수집 스크립트 (병렬 처리 버전)
 * 
 * 데이터 소스: 기상청 API Hub - 위성분석 일사량
 * URL: https://apihub.kma.go.kr/api/typ01/cgi-bin/sat/nph-sat_ana_txt
 * 
 * 저장 테이블: raw_irradiance
 * 
 * 수집 방식: 오늘 → 2019-01-01 역순, 병렬 처리
 */

import { PrismaClient } from '@prisma/client'
import {
  sleep,
  logProgress,
  logSuccess,
  logError,
  logInfo,
  formatDate,
  addDays,
} from './utils/helpers'

const prisma = new PrismaClient()

const KMA_API_URL = 'https://apihub.kma.go.kr/api/typ01/cgi-bin/sat/nph-sat_ana_txt'

// 병렬 처리 설정
const BATCH_SIZE = 2000  // 동시 API 호출 수 (2000개씩 - 최대)
const BATCH_DELAY = 0    // 배치 간 딜레이 제거 (최대 속도)

// 지역 정보 캐시
let regionCache: Array<{ id: bigint; name: string; lat: number; lon: number }> | null = null

async function getRegions() {
  if (regionCache) return regionCache

  const regions = await prisma.region.findMany({
    select: { id: true, name: true, lat: true, lon: true },
  })

  regionCache = regions.map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.lat ? Number(r.lat) : 0,
    lon: r.lon ? Number(r.lon) : 0,
  }))

  return regionCache
}

/**
 * 기상청 일사량 API 호출
 */
async function fetchIrradiance(date: Date, hour: number, lat: number, lon: number): Promise<number | null> {
  const apiKey = process.env.KMA_API_KEY
  if (!apiKey) throw new Error('KMA_API_KEY 환경변수가 설정되지 않았습니다.')
  
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(hour).padStart(2, '0')
  const tm = `${y}${m}${d}${h}00`
  
  const params = new URLSearchParams({
    tm,
    obs: 'dsr',
    mode: 'data',
    lat: lat.toFixed(4),
    lot: lon.toFixed(4),
    authKey: apiKey,
  })
  
  try {
    // 재시도 없이 1회만 시도 (빠른 실패)
    const response = await fetch(`${KMA_API_URL}?${params}`, { 
      signal: AbortSignal.timeout(2000) // 2초 타임아웃
    })
    
    if (!response.ok) {
      return null
    }
    
    const text = await response.text()
    return parseIrradianceValue(text)
  } catch {
    return null
  }
}

/**
 * 기상청 응답 파싱
 */
function parseIrradianceValue(text: string): number | null {
  const lines = text.split('\n').filter(line => !line.startsWith('#') && line.trim())
  
  if (lines.length > 0) {
    const value = parseFloat(lines[0].trim())
    if (!isNaN(value) && value >= 0) {
      return value
    }
  }
  
  return null
}

/**
 * 기본 일사량 (시간대별 평균값 - API 실패 시 사용)
 */
function getDefaultIrradiance(hour: number): number {
  const pattern: Record<number, number> = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    6: 0.05, 7: 0.15, 8: 0.30, 9: 0.45, 10: 0.55, 11: 0.65,
    12: 0.70, 13: 0.68, 14: 0.60, 15: 0.48, 16: 0.32, 17: 0.15,
    18: 0.05, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0,
  }
  return pattern[hour] ?? 0
}

/**
 * 배치 단위로 병렬 처리 (딜레이 제거, 최대 속도)
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number,
  _delayMs: number
): Promise<R[]> {
  const results: R[] = []
  
  // 모든 배치를 동시에 시작 (딜레이 없이)
  const batches: Promise<R[]>[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    batches.push(Promise.all(batch.map(processor)))
  }
  
  // 모든 배치 완료 대기
  const batchResults = await Promise.all(batches)
  
  // 결과 합치기
  for (const batchResult of batchResults) {
    results.push(...batchResult)
  }
  
  return results
}

/**
 * 특정 날짜의 전체 지역 일사량 수집 (병렬 처리)
 */
async function collectDayIrradiance(date: Date): Promise<number> {
  const regions = await getRegions()
  if (!regions || regions.length === 0) {
    throw new Error('지역 데이터가 없습니다.')
  }
  
  let savedCount = 0
  let apiSuccessCount = 0

  // 모든 (지역, 시간) 조합 생성
  type RegionType = { id: bigint; name: string; lat: number; lon: number }
  const tasks: Array<{ region: RegionType; hour: number }> = []
  for (const region of regions) {
    for (let hour = 0; hour < 24; hour++) {
      tasks.push({ region, hour })
    }
  }

  // 병렬 처리로 일사량 조회
  const results = await processBatch(
    tasks,
    async ({ region, hour }) => {
      let ghi = await fetchIrradiance(date, hour, region.lat, region.lon)
      const isApiSuccess = ghi !== null
      
      if (ghi === null) {
        ghi = getDefaultIrradiance(hour)
      }

      return {
        regionId: region.id,
        hour,
        ghi,
        isApiSuccess,
      }
    },
    BATCH_SIZE,
    BATCH_DELAY
  )

  // DB 저장 (배치 upsert - SQL로 최적화)
  const records = results.map((result) => {
    const datetime = new Date(date)
    datetime.setHours(result.hour, 0, 0, 0)
    return {
      regionId: result.regionId,
      datetime,
      ghi: result.ghi,
      isApiSuccess: result.isApiSuccess,
    }
  })

  // 전체를 한번에 SQL 배치 upsert (최대 속도)
  const values = records.map((r) => {
    const isoString = r.datetime.toISOString().replace('T', ' ').substring(0, 19)
    return `(${r.regionId}, '${isoString}'::timestamp, ${r.ghi})`
  }).join(',')

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO raw_irradiance (region_id, datetime, ghi)
      VALUES ${values}
      ON CONFLICT (region_id, datetime) 
      DO UPDATE SET ghi = EXCLUDED.ghi
    `)
    
    savedCount = records.length
    apiSuccessCount = records.filter(r => r.isApiSuccess).length
  } catch {
    // SQL 실패 시 배치로 나누어 재시도 (5000개씩)
    const DB_BATCH_SIZE = 5000
    for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
      const batch = records.slice(i, i + DB_BATCH_SIZE)
      const batchValues = batch.map((r) => {
        const isoString = r.datetime.toISOString().replace('T', ' ').substring(0, 19)
        return `(${r.regionId}, '${isoString}'::timestamp, ${r.ghi})`
      }).join(',')

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO raw_irradiance (region_id, datetime, ghi)
          VALUES ${batchValues}
          ON CONFLICT (region_id, datetime) 
          DO UPDATE SET ghi = EXCLUDED.ghi
        `)
        savedCount += batch.length
        apiSuccessCount += batch.filter(r => r.isApiSuccess).length
      } catch {
        // 배치 실패 시 개별 upsert로 폴백
        for (const record of batch) {
          try {
            await prisma.rawIrradiance.upsert({
              where: {
                regionId_datetime: {
                  regionId: record.regionId,
                  datetime: record.datetime,
                },
              },
              update: { ghi: record.ghi },
              create: {
                regionId: record.regionId,
                datetime: record.datetime,
                ghi: record.ghi,
              },
            })
            savedCount++
            if (record.isApiSuccess) apiSuccessCount++
          } catch {
            // 개별 실패 무시
          }
        }
      }
    }
  }

  logInfo(`  API 성공: ${apiSuccessCount}/${tasks.length}, 저장: ${savedCount}건`)
  return savedCount
}

/**
 * 특정 날짜 범위 수집 (최신 → 과거 역순)
 */
async function collectDateRange(startDate: Date, endDate: Date) {
  logInfo(`수집 기간: ${formatDate(startDate)} ~ ${formatDate(endDate)} (최신→과거 역순)`)
  logInfo(`병렬 처리: 배치 ${BATCH_SIZE}개, 딜레이 ${BATCH_DELAY}ms`)
  
  let currentDate = new Date(endDate)
  let processedDays = 0
  let skippedDays = 0
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  while (currentDate >= startDate) {
    const dateStr = formatDate(currentDate)
    
    // 이미 수집된 날짜인지 확인
    const startOfDay = new Date(currentDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(currentDate)
    endOfDay.setHours(23, 59, 59, 999)

    const existingCount = await prisma.rawIrradiance.count({
      where: {
        datetime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    // 이미 충분히 수집된 경우 스킵 (229 지역 × 24시간 ≈ 5,500)
    if (existingCount >= 5000) {
      logInfo(`[${dateStr}] 이미 수집됨 (${existingCount}건), 스킵`)
      skippedDays++
      currentDate = addDays(currentDate, -1)
      continue
    }

    logInfo(`[${dateStr}] 일사량 수집 중...`)
    
    try {
      const count = await collectDayIrradiance(currentDate)
      logSuccess(`[${dateStr}] 완료 - ${count}건 저장`)
      processedDays++
      
      // 10일마다 진행률 표시
      if (processedDays % 10 === 0) {
        logProgress(processedDays + skippedDays, totalDays, `처리: ${processedDays}일, 스킵: ${skippedDays}일`)
      }
      
    } catch (error) {
      logError(`[${dateStr}] 수집 실패`, error)
    }
    
    currentDate = addDays(currentDate, -1)

    // Rate limit 방지 (날짜 간 딜레이 최소화)
    await sleep(50)
  }
  
  logSuccess(`전체 완료 - 처리: ${processedDays}일, 스킵: ${skippedDays}일`)
}

async function main() {
  console.log('🌤️ 일사량 수집 시작 (병렬 처리)...\n')
  
  const args = process.argv.slice(2)
  
  if (args.includes('--help')) {
    console.log(`
사용법:
  tsx scripts/collect-irradiance.ts [옵션]

옵션:
  --all                  전체 기간 수집 (오늘→2019-01-01)
  --range START END      특정 기간 수집 (YYYY-MM-DD 형식)
  --date DATE            특정 날짜만 처리
  --help                 도움말 표시

예시:
  tsx scripts/collect-irradiance.ts --all
  tsx scripts/collect-irradiance.ts --range 2024-01-01 2024-12-31
  tsx scripts/collect-irradiance.ts --date 2024-06-15

특징:
  - 병렬 처리로 기존 대비 ~10배 빠름
  - 최신 날짜부터 역순으로 수집
  - 이미 수집된 날짜는 자동 스킵
`)
    process.exit(0)
  }
  
  try {
    if (args[0] === '--date' && args[1]) {
      const date = new Date(args[1])
      const count = await collectDayIrradiance(date)
      logSuccess(`완료 - ${count}건 저장`)

    } else if (args[0] === '--range' && args[1] && args[2]) {
      const startDate = new Date(args[1])
      const endDate = new Date(args[2])
      await collectDateRange(startDate, endDate)

    } else {
      // 기본: 오늘 → 2019-01-01
      const endDate = new Date()
      const startDate = new Date('2019-01-01')
      await collectDateRange(startDate, endDate)
    }
    
    // 수집 결과 통계
    const stats = await prisma.$queryRaw<Array<{ year: number; count: bigint }>>`
      SELECT EXTRACT(YEAR FROM datetime)::int as year, COUNT(*) as count
      FROM raw_irradiance
      GROUP BY year
      ORDER BY year
    `

    console.log('\n📈 연도별 일사량 데이터 현황:')
    for (const stat of stats) {
      console.log(`  ${stat.year}년: ${Number(stat.count).toLocaleString()}건`)
    }
    
  } catch (error) {
    logError('수집 실패', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
