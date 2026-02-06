/**
 * NASA POWER API 일사량 배치 수집 스크립트
 *
 * 데이터 소스: NASA POWER - Hourly ALLSKY_SFC_SW_DWN (GHI)
 * URL: https://power.larc.nasa.gov/api/temporal/hourly/point
 *
 * 저장 테이블: raw_irradiance
 *
 * 용도:
 * - 일사량 데이터 배치 수집 (2001년~현재, NASA POWER API 제공 범위)
 * - generation-trend.ts 시군구 추정 함수에서 사용하는 일사량 비율 데이터 제공
 * - 이미 수집된 지역+연도는 자동 스킵
 *
 * 사용법:
 *   npx tsx scripts/collect-irradiance-nasa.ts          # 기본: 2024~2025
 *   npx tsx scripts/collect-irradiance-nasa.ts 2024      # 특정 연도
 *   npx tsx scripts/collect-irradiance-nasa.ts 2019 2025 # 연도 범위
 */

import { PrismaClient } from '@prisma/client'
import {
  logProgress,
  logSuccess,
  logError,
  logInfo,
  logWarning,
  sleep,
  fetchWithRetry,
} from './utils/helpers'

const prisma = new PrismaClient()

const NASA_POWER_URL = 'https://power.larc.nasa.gov/api/temporal/hourly/point'
const REGION_PARALLEL_SIZE = 15
const DB_BATCH_SIZE = 500

interface NasaPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>
    }
  }
}

/**
 * DB에서 모든 regions 조회
 */
async function getRegions() {
  const regions = await prisma.region.findMany({
    select: { id: true, name: true, lat: true, lon: true },
  })

  return regions
    .filter((r) => r.lat && r.lon)
    .map((r) => ({
      id: r.id,
      name: r.name,
      lat: Number(r.lat),
      lon: Number(r.lon),
    }))
}

/**
 * NASA POWER API에서 특정 지역/연도의 시간별 일사량 데이터 조회
 */
async function fetchNasaHourly(
  lat: number,
  lon: number,
  year: number
): Promise<Record<string, number> | null> {
  const start = `${year}0101`
  const end = `${year}1231`

  const params = new URLSearchParams({
    start,
    end,
    latitude: lat.toString(),
    longitude: lon.toString(),
    community: 'RE',
    parameters: 'ALLSKY_SFC_SW_DWN',
    format: 'json',
    'time-standard': 'utc',
  })

  const url = `${NASA_POWER_URL}?${params}`

  try {
    const response = await fetchWithRetry(url, { signal: AbortSignal.timeout(60000) }, 3, 2000)

    if (!response.ok) {
      logError(`NASA API HTTP 오류`, `${response.status} ${response.statusText} (lat=${lat}, lon=${lon}, year=${year})`)
      return null
    }

    const data: NasaPowerResponse = await response.json()
    return data.properties.parameter.ALLSKY_SFC_SW_DWN
  } catch (error) {
    logError(`NASA API 호출 실패 (lat=${lat}, lon=${lon}, year=${year})`, error)
    return null
  }
}

/**
 * NASA 응답 키(YYYYMMDDhh)를 파싱하여 UTC Date 생성
 */
function parseNasaDatetimeKey(key: string): Date | null {
  if (key.length < 10) return null

  const y = parseInt(key.substring(0, 4), 10)
  const m = parseInt(key.substring(4, 6), 10)
  const d = parseInt(key.substring(6, 8), 10)
  const h = parseInt(key.substring(8, 10), 10)

  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h)) return null
  if (m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23) return null

  return new Date(Date.UTC(y, m - 1, d, h, 0, 0))
}

/**
 * 특정 region + 연도의 데이터가 이미 충분히 수집되었는지 확인
 */
async function isAlreadyCollected(regionId: bigint, year: number): Promise<boolean> {
  const count = await prisma.rawIrradiance.count({
    where: {
      regionId,
      datetime: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  })
  // 1년 = 8760시간 (윤년 8784), 8000 이상이면 수집 완료로 간주
  return count >= 8000
}

/**
 * 특정 region + 연도의 일사량 데이터를 수집하여 DB에 저장
 */
async function collectRegionYear(
  region: { id: bigint; name: string; lat: number; lon: number },
  year: number
): Promise<{ saved: number; skipped: number }> {
  // 이미 수집된 지역은 스킵
  if (await isAlreadyCollected(region.id, year)) {
    return { saved: -1, skipped: 0 }
  }

  const hourlyData = await fetchNasaHourly(region.lat, region.lon, year)
  if (!hourlyData) return { saved: 0, skipped: 0 }

  const records: Array<{ regionId: bigint; datetime: Date; ghi: number }> = []
  let skipped = 0

  for (const [key, value] of Object.entries(hourlyData)) {
    // 유효값 필터: 음수나 -999 등은 무효
    if (value < 0) {
      skipped++
      continue
    }

    const datetime = parseNasaDatetimeKey(key)
    if (!datetime) {
      skipped++
      continue
    }

    // Wh/m² → kW/m² 변환
    const ghiKw = value / 1000

    records.push({
      regionId: region.id,
      datetime,
      ghi: ghiKw,
    })
  }

  // 배치 DB 저장 (100개씩)
  let saved = 0
  for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
    const batch = records.slice(i, i + DB_BATCH_SIZE)
    try {
      await prisma.$transaction(
        batch.map((record) =>
          prisma.rawIrradiance.upsert({
            where: {
              regionId_datetime: {
                regionId: record.regionId,
                datetime: record.datetime,
              },
            },
            update: { ghi: record.ghi },
            create: record,
          })
        )
      )
      saved += batch.length
    } catch (error) {
      logError(`DB 저장 실패 (${region.name}, ${year})`, error)
    }
  }

  return { saved, skipped }
}

/**
 * 메인 수집 로직
 */
async function main() {
  const args = process.argv.slice(2)

  let startYear: number
  let endYear: number

  if (args.length >= 2) {
    startYear = parseInt(args[0], 10)
    endYear = parseInt(args[1], 10)
  } else if (args.length === 1) {
    startYear = parseInt(args[0], 10)
    endYear = startYear
  } else {
    startYear = 2024
    endYear = 2025
  }

  if (isNaN(startYear) || isNaN(endYear) || startYear < 2001 || endYear > 2030) {
    logError('인자 오류', `유효한 연도 범위를 입력하세요 (2001~2030). 입력값: ${args.join(' ')}`)
    process.exit(1)
  }

  if (startYear > endYear) {
    logError('인자 오류', `시작 연도(${startYear})가 종료 연도(${endYear})보다 큽니다.`)
    process.exit(1)
  }

  logInfo(`🌞 NASA POWER API 일사량 데이터 수집 시작`)
  logInfo(`수집 기간: ${startYear}년 ~ ${endYear}년`)

  const regions = await getRegions()
  logInfo(`대상 지역: ${regions.length}개`)

  if (regions.length === 0) {
    logWarning('수집할 지역이 없습니다.')
    return
  }

  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
  const totalTasks = regions.length * years.length
  let completedTasks = 0
  let totalSaved = 0
  let totalSkipped = 0

  for (const year of years) {
    logInfo(`--- ${year}년 수집 시작 ---`)

    // region을 5개씩 병렬 처리
    for (let i = 0; i < regions.length; i += REGION_PARALLEL_SIZE) {
      const batch = regions.slice(i, i + REGION_PARALLEL_SIZE)

      const results = await Promise.all(
        batch.map((region) => collectRegionYear(region, year))
      )

      for (let j = 0; j < batch.length; j++) {
        const region = batch[j]
        const result = results[j]
        completedTasks++

        if (result.saved === -1) {
          logProgress(completedTasks, totalTasks, `${region.name} ${year}년: 이미 수집됨, 스킵`)
        } else {
          totalSaved += result.saved
          totalSkipped += result.skipped
          logProgress(
            completedTasks,
            totalTasks,
            `${region.name} ${year}년: ${result.saved}건 저장, ${result.skipped}건 스킵`
          )
        }
      }

      // 요청 간 200ms 대기 (rate limiting)
      if (i + REGION_PARALLEL_SIZE < regions.length) {
        await sleep(200)
      }
    }
  }

  logSuccess(`수집 완료: 총 ${totalSaved}건 저장, ${totalSkipped}건 스킵`)
}

main()
  .catch((e) => logError('메인 실행 오류', e))
  .finally(() => prisma.$disconnect())
