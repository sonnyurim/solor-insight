/**
 * 데이터 수집 공통 유틸리티 함수
 */

// ============================================
// 날짜 관련 헬퍼
// ============================================

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDateTime(date: Date, hour: number): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(hour).padStart(2, '0')
  return `${y}${m}${d}${h}00`
}

export function getYesterday(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ============================================
// 시간/계절 관련 헬퍼
// ============================================

export function formatHourRange(hour: number): string {
  const start = String(hour).padStart(2, '0')
  const end = String((hour + 1) % 24).padStart(2, '0')
  return `${start}~${end}시`
}

export function getWeekOfYear(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

export function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

export function getSeasonKr(month: number): string {
  if (month >= 3 && month <= 5) return '봄'
  if (month >= 6 && month <= 8) return '여름'
  if (month >= 9 && month <= 11) return '가을'
  return '겨울'
}

export function getDayName(dayOfWeek: number): string {
  const names = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return names[dayOfWeek]
}

export function getMonthName(month: number): string {
  return `${month}월`
}

// ============================================
// API 관련 헬퍼
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries = 3, 
  delay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
      
      if (response.status === 429) {
        // Rate limit - wait longer
        await sleep(delay * (i + 1) * 2)
        continue
      }
      
      if (i === retries - 1) return response
    } catch (error) {
      if (i === retries - 1) throw error
      await sleep(delay * (i + 1))
    }
  }
  throw new Error('Max retries exceeded')
}

// ============================================
// 발전량 계산 관련 헬퍼
// ============================================

export interface DateTimeFields {
  measurementDatetime: Date
  year: number
  month: number
  monthName: string
  day: number
  hour: number
  hourRange: string
  weekOfYear: number
  quarter: number
  season: string
  seasonKr: string
  dayOfWeek: number
  dayName: string
  isWeekend: boolean
}

export function buildDateTimeFields(date: Date, hour: number): DateTimeFields {
  const d = new Date(date)
  d.setHours(hour, 0, 0, 0)
  
  const month = d.getMonth() + 1
  const dayOfWeek = d.getDay()
  
  return {
    measurementDatetime: d,
    year: d.getFullYear(),
    month,
    monthName: getMonthName(month),
    day: d.getDate(),
    hour,
    hourRange: formatHourRange(hour),
    weekOfYear: getWeekOfYear(d),
    quarter: Math.ceil(month / 3),
    season: getSeason(month),
    seasonKr: getSeasonKr(month),
    dayOfWeek,
    dayName: getDayName(dayOfWeek),
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  }
}

// ============================================
// 좌표 변환 (위경도 → 기상청 격자)
// ============================================

const RE = 6371.00877     // 지구 반경(km)
const GRID = 5.0          // 격자 간격(km)
const SLAT1 = 30.0        // 표준 위도 1
const SLAT2 = 60.0        // 표준 위도 2
const OLON = 126.0        // 기준점 경도
const OLAT = 38.0         // 기준점 위도
const XO = 210 / GRID     // 기준점 X좌표
const YO = 675 / GRID     // 기준점 Y좌표

export function latLonToGrid(lat: number, lon: number): { gridX: number; gridY: number } {
  const DEGRAD = Math.PI / 180.0
  
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD
  const slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD
  const olat = OLAT * DEGRAD
  
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = re * sf / Math.pow(ro, sn)
  
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = re * sf / Math.pow(ra, sn)
  let theta = lon * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn
  
  const gridX = Math.floor(ra * Math.sin(theta) + XO + 0.5)
  const gridY = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
  
  return { gridX, gridY }
}

// ============================================
// 로깅 헬퍼
// ============================================

export function logProgress(current: number, total: number, message?: string): void {
  if (total <= 0) {
    console.log(`[진행중] ${current} - ${message ?? ''}`)
  } else {
    const percent = ((current / total) * 100).toFixed(1)
    console.log(`[${percent}%] ${current}/${total}${message ? ` - ${message}` : ''}`)
  }
}

export function logError(context: string, error: unknown): void {
  console.error(`❌ [${context}]`, error instanceof Error ? error.message : error)
}

export function logSuccess(message: string): void {
  console.log(`✅ ${message}`)
}

export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`)
}

export function logWarning(message: string): void {
  console.warn(`⚠️  ${message}`)
}
