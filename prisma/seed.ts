import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'
import * as iconv from 'iconv-lite'

const prisma = new PrismaClient()

// CSV 파일 읽기 (EUC-KR 인코딩 지원)
function readCSV<T>(filename: string, encoding: string = 'utf-8'): T[] {
  const filePath = path.join(__dirname, 'data', filename)
  const buffer = fs.readFileSync(filePath)
  const content = encoding === 'utf-8' 
    ? buffer.toString('utf-8') 
    : iconv.decode(buffer, encoding)
  
  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })
  
  return result.data
}

// 시간별 SMP 데이터 타입
interface SmpHourlyData {
  priceDate: Date
  hour: number
  priceValue: number
  regionType: string
}

// 일별 SMP 데이터 타입
interface SmpDailyData {
  priceDate: Date
  maxPrice: number
  minPrice: number
  avgPrice: number
  regionType: string
}

// 월별 SMP 데이터 타입
interface SmpMonthlyData {
  priceMonth: Date
  smpLand: number
  smpJeju: number
  smpTotal: number
  blmp: number
}

// 시간별 SMP 시드 (파일명, 지역 타입, 인코딩을 받음)
async function seedSmpHourly(filename: string, regionType: string, encoding: string = 'utf-8') {
  console.log(`⏳ 시간별/일별 SMP 시드 시작 (${regionType})...`)
  
  const rows = readCSV<Record<string, unknown>>(filename, encoding)
  const hourlyRecords: SmpHourlyData[] = []
  const dailyRecords: SmpDailyData[] = []
  
  for (const row of rows) {
    const dateStr = row['기간'] as string
    if (!dateStr) continue
    
    const priceDate = new Date(dateStr.replace(/\//g, '-'))
    
    // 시간별 데이터
    for (let hour = 1; hour <= 24; hour++) {
      const hourKey = `${hour.toString().padStart(2, '0')}시`
      const priceValue = row[hourKey] as number | null
      
      if (priceValue != null && !isNaN(priceValue)) {
        hourlyRecords.push({
          priceDate,
          hour,
          priceValue,
          regionType,
        })
      }
    }
    
    // 일별 요약 데이터
    const maxPrice = row['최대'] as number | null
    const minPrice = row['최소'] as number | null
    const avgPrice = row['가중평균'] as number | null
    
    if (maxPrice != null && minPrice != null && avgPrice != null) {
      dailyRecords.push({
        priceDate,
        maxPrice,
        minPrice,
        avgPrice,
        regionType,
      })
    }
  }
  
  await prisma.smpPriceHourly.createMany({
    data: hourlyRecords,
    skipDuplicates: true,
  })
  console.log(`✅ 시간별 SMP (${regionType}) ${hourlyRecords.length}건 주입 완료`)
  
  await prisma.smpPriceDaily.createMany({
    data: dailyRecords,
    skipDuplicates: true,
  })
  console.log(`✅ 일별 SMP (${regionType}) ${dailyRecords.length}건 주입 완료`)
}

// 월별 SMP 시드
async function seedSmpMonthly() {
  console.log('⏳ 월별 SMP 시드 시작...')
  
  const rows = readCSV<Record<string, unknown>>('smp_monthly.csv')
  const records: SmpMonthlyData[] = []
  
  for (const row of rows) {
    const dateStr = row['기간'] as string
    if (!dateStr) continue
    
    const [year, month] = dateStr.split(/[\/\-]/)
    const priceMonth = new Date(`${year}-${month.padStart(2, '0')}-01`)
    
    const smpLand = row['SMP 육지'] as number | null
    const smpJeju = row['SMP 제주'] as number | null
    const smpTotal = row['SMP 통합'] as number | null
    const blmp = (row['BLMP'] as number | null) ?? 0
    
    if (smpLand != null && smpJeju != null && smpTotal != null) {
      records.push({
        priceMonth,
        smpLand,
        smpJeju,
        smpTotal,
        blmp,
      })
    }
  }
  
  await prisma.smpPriceMonthly.createMany({
    data: records,
    skipDuplicates: true,
  })
  
  console.log(`✅ 월별 SMP ${records.length}건 주입 완료`)
}

// 메인 함수
async function main() {
  console.log('🌱 시드 시작...\n')
  
  // 육지/제주 CSV 각각 시드 (모두 UTF-8)
  await seedSmpHourly('smp_hourly_land.csv', '육지')
  await seedSmpHourly('smp_hourly_jeju.csv', '제주')
  await seedSmpMonthly()
  
  console.log('\n✅ 모든 시드 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
