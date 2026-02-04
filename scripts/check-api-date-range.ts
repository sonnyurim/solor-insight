/**
 * 공공데이터포털 API가 제공하는 발전량 데이터 기간 확인
 */

import { PrismaClient } from '@prisma/client'
import { fetchWithRetry } from './utils/helpers'

const prisma = new PrismaClient()
const API_URL = 'https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr'

async function checkApiDateRange() {
  // Prisma가 .env를 로드하므로 환경변수 사용 가능
  const apiKey = process.env.DATA_GO_KR_API_KEY
  if (!apiKey) {
    console.error('❌ DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.')
    console.error('   .env 파일에 DATA_GO_KR_API_KEY가 있는지 확인하세요.')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log('🔍 API 데이터 기간 확인 중...\n')

  // 1. 전체 데이터 수 확인
  const totalParams = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: '1',
    numOfRows: '1',
    dataType: 'JSON',
  })

  try {
    const totalResponse = await fetchWithRetry(`${API_URL}?${totalParams}`)
    const totalData = await totalResponse.json()
    const totalCount = parseInt(totalData?.response?.body?.totalCount ?? '0', 10)
    
    console.log(`📊 전체 데이터 수: ${totalCount.toLocaleString()}건\n`)

    if (totalCount === 0) {
      console.log('❌ 데이터가 없습니다.')
      return
    }

    // 2. 첫 페이지 (최신 데이터)
    const firstPageParams = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: '1',
      numOfRows: '100',
      dataType: 'JSON',
    })

    const firstResponse = await fetchWithRetry(`${API_URL}?${firstPageParams}`)
    const firstData = await firstResponse.json()
    const firstItems = firstData?.response?.body?.items?.item
    const firstArray = Array.isArray(firstItems) ? firstItems : (firstItems ? [firstItems] : [])

    if (firstArray.length > 0) {
      const latestDate = firstArray[0].tradeYmd
      console.log(`📅 최신 데이터: ${latestDate} (${formatDate(latestDate)})`)
    }

    // 3. 마지막 페이지 (가장 오래된 데이터)
    const totalPages = Math.ceil(totalCount / 1000)
    const lastPageParams = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: String(totalPages),
      numOfRows: '100',
      dataType: 'JSON',
    })

    const lastResponse = await fetchWithRetry(`${API_URL}?${lastPageParams}`)
    const lastData = await lastResponse.json()
    const lastItems = lastData?.response?.body?.items?.item
    const lastArray = Array.isArray(lastItems) ? lastItems : (lastItems ? [lastItems] : [])

    if (lastArray.length > 0) {
      const oldestDate = lastArray[lastArray.length - 1].tradeYmd
      console.log(`📅 가장 오래된 데이터: ${oldestDate} (${formatDate(oldestDate)})`)
    }

    // 4. 특정 날짜 확인 (2024-02-04)
    console.log('\n🔍 특정 날짜 확인: 2024-02-04')
    const checkDate = '20240204'
    const checkParams = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: '1',
      numOfRows: '100',
      dataType: 'JSON',
      startDate: checkDate,
      endDate: checkDate,
    })

    try {
      const checkResponse = await fetchWithRetry(`${API_URL}?${checkParams}`)
      const checkData = await checkResponse.json()
      const checkItems = checkData?.response?.body?.items?.item
      const checkArray = Array.isArray(checkItems) ? checkItems : (checkItems ? [checkItems] : [])
      
      if (checkArray.length > 0) {
        console.log(`  ✅ 2024-02-04 데이터 존재: ${checkArray.length}건`)
      } else {
        console.log(`  ❌ 2024-02-04 데이터 없음`)
      }
    } catch (error) {
      console.log(`  ⚠️  확인 실패: ${error}`)
    }

    // 5. 연도별 데이터 수 확인
    console.log('\n📈 연도별 데이터 분포 확인 중...')
    
    const yearCounts: Record<string, number> = {}
    let checkedPages = 0
    const maxPagesToCheck = Math.min(totalPages, 10) // 처음 10페이지만 샘플링

    for (let page = 1; page <= maxPagesToCheck; page++) {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        pageNo: String(page),
        numOfRows: '1000',
        dataType: 'JSON',
      })

      const response = await fetchWithRetry(`${API_URL}?${params}`)
      const data = await response.json()
      const items = data?.response?.body?.items?.item
      const itemArray = Array.isArray(items) ? items : (items ? [items] : [])

      for (const item of itemArray) {
        const year = item.tradeYmd.substring(0, 4)
        yearCounts[year] = (yearCounts[year] || 0) + 1
      }

      checkedPages++
    }

    console.log('\n📊 샘플링 결과 (처음 10페이지):')
    const sortedYears = Object.keys(yearCounts).sort()
    for (const year of sortedYears) {
      console.log(`  ${year}년: ${yearCounts[year].toLocaleString()}건 (샘플)`)
    }

    console.log(`\n💡 전체 ${totalPages}페이지 중 ${checkedPages}페이지만 샘플링했습니다.`)
    console.log(`   실제 연도별 분포는 전체 수집 후 확인 가능합니다.`)

  } catch (error) {
    console.error('❌ API 확인 실패:', error)
    throw error
  }
}

function formatDate(dateStr: string): string {
  // YYYYMMDD -> YYYY-MM-DD
  if (dateStr.length === 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
  }
  return dateStr
}

checkApiDateRange()
  .then(() => {
    console.log('\n✅ 확인 완료')
    return prisma.$disconnect()
  })
  .then(() => {
    process.exit(0)
  })
  .catch((e) => {
    console.error('❌ 실패:', e)
    prisma.$disconnect()
    process.exit(1)
  })
