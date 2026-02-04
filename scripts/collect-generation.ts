/**
 * 광역시도별 시간별 태양광 발전량 수집 스크립트
 * 
 * 데이터 소스: 공공데이터포털 - 지역별 시간별 태양광 발전량
 * URL: https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr
 * 
 * 저장 테이블: raw_generation (is_estimated = false)
 * 
 * 수집 방식: 오늘 → 2019-01-01 역순
 */

import { PrismaClient } from '@prisma/client'
import {
  fetchWithRetry,
  sleep,
  logProgress,
  logSuccess,
  logError,
  logInfo,
  logWarning,
  formatDate,
  addDays,
} from './utils/helpers'

const prisma = new PrismaClient()

const API_URL = 'https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr'

// API 응답 지역명 → DB regions.name 매핑
const REGION_NAME_MAPPING: Record<string, string> = {
  '서울': '서울특별시',
  '서울시': '서울특별시',
  '서울특별시': '서울특별시',
  '부산': '부산광역시',
  '부산시': '부산광역시',
  '부산광역시': '부산광역시',
  '대구': '대구광역시',
  '대구시': '대구광역시',
  '대구광역시': '대구광역시',
  '인천': '인천광역시',
  '인천시': '인천광역시',
  '인천광역시': '인천광역시',
  '광주': '광주광역시',
  '광주시': '광주광역시',
  '광주광역시': '광주광역시',
  '대전': '대전광역시',
  '대전시': '대전광역시',
  '대전광역시': '대전광역시',
  '울산': '울산광역시',
  '울산시': '울산광역시',
  '울산광역시': '울산광역시',
  '세종': '세종특별자치시',
  '세종시': '세종특별자치시',
  '세종특별자치시': '세종특별자치시',
  '경기': '경기도',
  '경기도': '경기도',
  '강원': '강원특별자치도',
  '강원도': '강원특별자치도',
  '강원특별자치도': '강원특별자치도',
  '충북': '충청북도',
  '충청북도': '충청북도',
  '충남': '충청남도',
  '충청남도': '충청남도',
  '전북': '전북특별자치도',
  '전북특별자치도': '전북특별자치도',
  '전라북도': '전북특별자치도',
  '전남': '전라남도',
  '전라남도': '전라남도',
  '경북': '경상북도',
  '경상북도': '경상북도',
  '경남': '경상남도',
  '경상남도': '경상남도',
  '제주': '제주특별자치도',
  '제주도': '제주특별자치도',
  '제주특별자치도': '제주특별자치도',
}

interface ApiResponseItem {
  tradeYmd: string    // YYYYMMDD
  tradeNo: string     // 1~24 (시간)
  regionNm: string    // 지역명 (강원도, 서울특별시 등)
  amgo: number        // 발전량 (kWh)
  rn: number          // row number
}

// 지역명 → region_id 캐시
let regionIdCache: Map<string, bigint> | null = null

async function getRegionIdMap(): Promise<Map<string, bigint>> {
  if (regionIdCache) return regionIdCache

  const regions = await prisma.region.findMany({
    where: { type: 'PROVINCE' },
    select: { id: true, name: true },
  })

  regionIdCache = new Map()
  for (const region of regions) {
    regionIdCache.set(region.name, region.id)
  }

  return regionIdCache
}

/**
 * 연속으로 데이터 없는 날짜 수 확인
 */
async function checkConsecutiveNoData(date: Date, startDate: Date): Promise<number> {
  let count = 0
  let checkDate = new Date(date)
  
  while (checkDate >= startDate && count < 30) {
    const existingCount = await prisma.rawGeneration.count({
      where: {
        tradeDate: checkDate,
        isEstimated: false,
      },
    })
    
    if (existingCount === 0) {
      count++
      checkDate = addDays(checkDate, -1)
    } else {
      break
    }
  }
  
  return count
}

/**
 * 특정 날짜의 발전량 데이터 조회
 */
async function fetchDayData(date: Date): Promise<ApiResponseItem[]> {
  const apiKey = process.env.DATA_GO_KR_API_KEY
  if (!apiKey) throw new Error('DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.')

  const dateStr = formatDate(date).replace(/-/g, '') // YYYYMMDD

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: '1',
    numOfRows: '1000', // 17지역 × 24시간 = 408건
    dataType: 'JSON',
    startDate: dateStr,
    endDate: dateStr,
  })

  const response = await fetchWithRetry(`${API_URL}?${params}`)

  if (!response.ok) {
    throw new Error(`API 응답 오류: ${response.status}`)
  }

  const data = await response.json()
  const items = data?.response?.body?.items?.item

  if (!items) return []
  return Array.isArray(items) ? items : [items]
}

async function saveGenerationData(items: ApiResponseItem[]): Promise<number> {
  const regionIdMap = await getRegionIdMap()
  const records: Array<{
    regionId: bigint
    tradeDate: Date
    hour: number
    generationKwh: number
    isEstimated: boolean
  }> = []

  for (const item of items) {
    // 지역명 정규화
    const normalizedName = REGION_NAME_MAPPING[item.regionNm]
    if (!normalizedName) {
      logWarning(`알 수 없는 지역: ${item.regionNm}`)
      continue
    }

    const regionId = regionIdMap.get(normalizedName)
    if (!regionId) {
      logWarning(`DB에 없는 광역시도: ${normalizedName}`)
      continue
    }

    // 날짜 파싱
    const year = parseInt(item.tradeYmd.substring(0, 4))
    const month = parseInt(item.tradeYmd.substring(4, 6))
    const day = parseInt(item.tradeYmd.substring(6, 8))
    const hour = parseInt(item.tradeNo) - 1  // tradeNo는 1~24, hour는 0~23

    const tradeDate = new Date(year, month - 1, day)
    const generationKwh = item.amgo || 0

    records.push({
      regionId,
      tradeDate,
      hour,
      generationKwh,
      isEstimated: false,  // 광역시도 실제 데이터
    })
  }

  if (records.length === 0) return 0

  // 배치 삽입 (중복 시 업데이트)
  let savedCount = 0
  for (const record of records) {
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
      savedCount++
    } catch (error) {
      // 개별 레코드 실패 시 로그만
      logWarning(`레코드 저장 실패: ${error}`)
    }
  }

  return savedCount
}

/**
 * 날짜 범위 수집 (최신 → 과거 역순)
 */
async function collectDateRange(startDate: Date, endDate: Date) {
  logInfo(`수집 기간: ${formatDate(startDate)} ~ ${formatDate(endDate)} (최신→과거 역순)`)

  let currentDate = new Date(endDate)
  let processedDays = 0
  let skippedDays = 0
  let totalSaved = 0

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  while (currentDate >= startDate) {
    const dateStr = formatDate(currentDate)

    // 이미 수집된 날짜인지 확인 (17지역 × 24시간 = 408건)
    const existingCount = await prisma.rawGeneration.count({
      where: {
        tradeDate: currentDate,
        isEstimated: false,
      },
    })

    if (existingCount >= 400) {
      logInfo(`[${dateStr}] 이미 수집됨 (${existingCount}건), 스킵`)
      skippedDays++
      currentDate = addDays(currentDate, -1)
      continue
    }

    try {
      const items = await fetchDayData(currentDate)
      
      if (items.length === 0) {
        // 연속으로 데이터 없는 날이 7일 이상이면 해당 기간은 데이터 없음으로 간주
        const noDataDays = await checkConsecutiveNoData(currentDate, startDate)
        if (noDataDays >= 7) {
          logInfo(`[${dateStr}] 연속 ${noDataDays}일 데이터 없음 - 이전 기간은 API에서 제공하지 않을 수 있습니다`)
          // 더 이상 과거로 가지 않고 종료
          break
        }
        logWarning(`[${dateStr}] 데이터 없음`)
        currentDate = addDays(currentDate, -1)
        continue
      }

      const saved = await saveGenerationData(items)
      totalSaved += saved
      processedDays++

      logSuccess(`[${dateStr}] ${saved}건 저장`)

      // 진행률 (30일마다)
      if (processedDays % 30 === 0) {
        logProgress(processedDays + skippedDays, totalDays, `처리: ${processedDays}일, 스킵: ${skippedDays}일, 저장: ${totalSaved.toLocaleString()}건`)
      }

      // Rate limit 방지
      await sleep(100)

    } catch (error) {
      logError(`[${dateStr}] 수집 실패`, error)
      await sleep(1000)
    }

    currentDate = addDays(currentDate, -1)
  }

  logSuccess(`전체 완료 - 처리: ${processedDays}일, 스킵: ${skippedDays}일, 저장: ${totalSaved.toLocaleString()}건`)
}

async function main() {
  console.log('📊 태양광 발전량 수집 시작...\n')

  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    console.log(`
사용법:
  tsx scripts/collect-generation.ts [옵션]

옵션:
  --all                전체 데이터 수집 (오늘 → 2019-01-01)
  --range START END    특정 기간 수집 (YYYY-MM-DD 형식, 최신→과거 역순)
  --help               도움말 표시

예시:
  tsx scripts/collect-generation.ts --all
  tsx scripts/collect-generation.ts --range 2024-01-01 2024-12-31
`)
    process.exit(0)
  }

  try {
    if (args[0] === '--range' && args[1] && args[2]) {
      const start = new Date(args[1])
      const end = new Date(args[2])
      await collectDateRange(start, end)
    } else {
      // 기본: 오늘 → 2019-01-01
      const endDate = new Date()
      const startDate = new Date('2019-01-01')
      await collectDateRange(startDate, endDate)
    }

    // 수집 결과 통계
    const stats = await prisma.$queryRaw<Array<{ year: number; count: bigint }>>`
      SELECT EXTRACT(YEAR FROM trade_date)::int as year, COUNT(*) as count
      FROM raw_generation
      WHERE is_estimated = false
      GROUP BY year
      ORDER BY year
    `

    console.log('\n📈 연도별 수집 현황 (실제 데이터):')
    for (const stat of stats) {
      console.log(`  ${stat.year}년: ${Number(stat.count).toLocaleString()}건`)
    }

  } catch (error) {
    logError('발전량 수집 실패', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
