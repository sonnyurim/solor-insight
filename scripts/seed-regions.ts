/**
 * 지역 마스터 시드 스크립트
 * 
 * 17개 광역시도 + 212개 시군구 = 229개 지역
 * 계층 구조: PROVINCE (광역시도) → CITY (시군구)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 광역시도 데이터 (17개)
const PROVINCES = [
  { name: '서울특별시', lat: 37.5665, lon: 126.9780 },
  { name: '부산광역시', lat: 35.1796, lon: 129.0756 },
  { name: '대구광역시', lat: 35.8714, lon: 128.6014 },
  { name: '인천광역시', lat: 37.4563, lon: 126.7052 },
  { name: '광주광역시', lat: 35.1595, lon: 126.8526 },
  { name: '대전광역시', lat: 36.3504, lon: 127.3845 },
  { name: '울산광역시', lat: 35.5384, lon: 129.3114 },
  { name: '세종특별자치시', lat: 36.4800, lon: 127.2890 },
  { name: '경기도', lat: 37.4138, lon: 127.5183 },
  { name: '강원특별자치도', lat: 37.8228, lon: 128.1555 },
  { name: '충청북도', lat: 36.6357, lon: 127.4917 },
  { name: '충청남도', lat: 36.5184, lon: 126.8000 },
  { name: '전북특별자치도', lat: 35.8203, lon: 127.1089 },
  { name: '전라남도', lat: 34.8679, lon: 126.9910 },
  { name: '경상북도', lat: 36.4919, lon: 128.8889 },
  { name: '경상남도', lat: 35.4606, lon: 128.2132 },
  { name: '제주특별자치도', lat: 33.4890, lon: 126.4983 },
]

// 시군구 데이터 (광역시도별)
const CITIES: Record<string, Array<{ name: string; lat: number; lon: number }>> = {
  '서울특별시': [
    { name: '종로구', lat: 37.5735, lon: 126.9790 },
    { name: '중구', lat: 37.5641, lon: 126.9979 },
    { name: '용산구', lat: 37.5384, lon: 126.9654 },
    { name: '성동구', lat: 37.5634, lon: 127.0369 },
    { name: '광진구', lat: 37.5385, lon: 127.0823 },
    { name: '동대문구', lat: 37.5744, lon: 127.0396 },
    { name: '중랑구', lat: 37.6063, lon: 127.0928 },
    { name: '성북구', lat: 37.5894, lon: 127.0167 },
    { name: '강북구', lat: 37.6397, lon: 127.0255 },
    { name: '도봉구', lat: 37.6688, lon: 127.0472 },
    { name: '노원구', lat: 37.6543, lon: 127.0568 },
    { name: '은평구', lat: 37.6027, lon: 126.9291 },
    { name: '서대문구', lat: 37.5791, lon: 126.9368 },
    { name: '마포구', lat: 37.5638, lon: 126.9084 },
    { name: '양천구', lat: 37.5172, lon: 126.8665 },
    { name: '강서구', lat: 37.5510, lon: 126.8495 },
    { name: '구로구', lat: 37.4954, lon: 126.8874 },
    { name: '금천구', lat: 37.4519, lon: 126.9020 },
    { name: '영등포구', lat: 37.5264, lon: 126.8963 },
    { name: '동작구', lat: 37.5124, lon: 126.9393 },
    { name: '관악구', lat: 37.4784, lon: 126.9516 },
    { name: '서초구', lat: 37.4837, lon: 127.0324 },
    { name: '강남구', lat: 37.5172, lon: 127.0473 },
    { name: '송파구', lat: 37.5145, lon: 127.1060 },
    { name: '강동구', lat: 37.5301, lon: 127.1238 },
  ],
  '부산광역시': [
    { name: '중구', lat: 35.1060, lon: 129.0324 },
    { name: '서구', lat: 35.0982, lon: 129.0244 },
    { name: '동구', lat: 35.1295, lon: 129.0455 },
    { name: '영도구', lat: 35.0912, lon: 129.0678 },
    { name: '부산진구', lat: 35.1631, lon: 129.0534 },
    { name: '동래구', lat: 35.1980, lon: 129.0838 },
    { name: '남구', lat: 35.1365, lon: 129.0849 },
    { name: '북구', lat: 35.1972, lon: 128.9903 },
    { name: '해운대구', lat: 35.1631, lon: 129.1635 },
    { name: '사하구', lat: 35.1046, lon: 128.9748 },
    { name: '금정구', lat: 35.2431, lon: 129.0924 },
    { name: '강서구', lat: 35.2121, lon: 128.9807 },
    { name: '연제구', lat: 35.1762, lon: 129.0798 },
    { name: '수영구', lat: 35.1457, lon: 129.1133 },
    { name: '사상구', lat: 35.1526, lon: 128.9914 },
    { name: '기장군', lat: 35.2445, lon: 129.2222 },
  ],
  '대구광역시': [
    { name: '중구', lat: 35.8690, lon: 128.6062 },
    { name: '동구', lat: 35.8867, lon: 128.6356 },
    { name: '서구', lat: 35.8718, lon: 128.5592 },
    { name: '남구', lat: 35.8460, lon: 128.5975 },
    { name: '북구', lat: 35.8858, lon: 128.5828 },
    { name: '수성구', lat: 35.8584, lon: 128.6308 },
    { name: '달서구', lat: 35.8299, lon: 128.5327 },
    { name: '달성군', lat: 35.7746, lon: 128.4313 },
    { name: '군위군', lat: 36.2429, lon: 128.5728 },
  ],
  '인천광역시': [
    { name: '중구', lat: 37.4738, lon: 126.6217 },
    { name: '동구', lat: 37.4737, lon: 126.6432 },
    { name: '미추홀구', lat: 37.4639, lon: 126.6503 },
    { name: '연수구', lat: 37.4101, lon: 126.6784 },
    { name: '남동구', lat: 37.4471, lon: 126.7312 },
    { name: '부평구', lat: 37.5076, lon: 126.7219 },
    { name: '계양구', lat: 37.5372, lon: 126.7376 },
    { name: '서구', lat: 37.5456, lon: 126.6760 },
    { name: '강화군', lat: 37.7468, lon: 126.4877 },
    { name: '옹진군', lat: 37.4466, lon: 126.6366 },
  ],
  '광주광역시': [
    { name: '동구', lat: 35.1462, lon: 126.9231 },
    { name: '서구', lat: 35.1520, lon: 126.8901 },
    { name: '남구', lat: 35.1329, lon: 126.9026 },
    { name: '북구', lat: 35.1743, lon: 126.9120 },
    { name: '광산구', lat: 35.1396, lon: 126.7936 },
  ],
  '대전광역시': [
    { name: '동구', lat: 36.3121, lon: 127.4549 },
    { name: '중구', lat: 36.3254, lon: 127.4214 },
    { name: '서구', lat: 36.3551, lon: 127.3837 },
    { name: '유성구', lat: 36.3622, lon: 127.3561 },
    { name: '대덕구', lat: 36.3465, lon: 127.4155 },
  ],
  '울산광역시': [
    { name: '중구', lat: 35.5664, lon: 129.3324 },
    { name: '남구', lat: 35.5444, lon: 129.3303 },
    { name: '동구', lat: 35.5050, lon: 129.4163 },
    { name: '북구', lat: 35.5825, lon: 129.3612 },
    { name: '울주군', lat: 35.5224, lon: 129.0994 },
  ],
  '세종특별자치시': [
    { name: '세종시', lat: 36.4800, lon: 127.2890 },
  ],
  '경기도': [
    { name: '수원시', lat: 37.2636, lon: 127.0286 },
    { name: '성남시', lat: 37.4201, lon: 127.1265 },
    { name: '의정부시', lat: 37.7381, lon: 127.0337 },
    { name: '안양시', lat: 37.3943, lon: 126.9568 },
    { name: '부천시', lat: 37.5034, lon: 126.7660 },
    { name: '광명시', lat: 37.4786, lon: 126.8644 },
    { name: '평택시', lat: 36.9921, lon: 127.1126 },
    { name: '동두천시', lat: 37.9034, lon: 127.0604 },
    { name: '안산시', lat: 37.3219, lon: 126.8311 },
    { name: '고양시', lat: 37.6584, lon: 126.8320 },
    { name: '과천시', lat: 37.4292, lon: 126.9876 },
    { name: '구리시', lat: 37.5943, lon: 127.1296 },
    { name: '남양주시', lat: 37.6360, lon: 127.2165 },
    { name: '오산시', lat: 37.1498, lon: 127.0697 },
    { name: '시흥시', lat: 37.3800, lon: 126.8031 },
    { name: '군포시', lat: 37.3616, lon: 126.9352 },
    { name: '의왕시', lat: 37.3445, lon: 126.9687 },
    { name: '하남시', lat: 37.5393, lon: 127.2147 },
    { name: '용인시', lat: 37.2410, lon: 127.1775 },
    { name: '파주시', lat: 37.7599, lon: 126.7800 },
    { name: '이천시', lat: 37.2720, lon: 127.4348 },
    { name: '안성시', lat: 37.0078, lon: 127.2797 },
    { name: '김포시', lat: 37.6152, lon: 126.7156 },
    { name: '화성시', lat: 37.1995, lon: 126.8312 },
    { name: '광주시', lat: 37.4095, lon: 127.2555 },
    { name: '양주시', lat: 37.7853, lon: 127.0456 },
    { name: '포천시', lat: 37.8949, lon: 127.2003 },
    { name: '여주시', lat: 37.2982, lon: 127.6373 },
    { name: '연천군', lat: 38.0966, lon: 127.0745 },
    { name: '가평군', lat: 37.8315, lon: 127.5095 },
    { name: '양평군', lat: 37.4917, lon: 127.4872 },
  ],
  '강원특별자치도': [
    { name: '춘천시', lat: 37.8813, lon: 127.7298 },
    { name: '원주시', lat: 37.3422, lon: 127.9202 },
    { name: '강릉시', lat: 37.7519, lon: 128.8760 },
    { name: '동해시', lat: 37.5246, lon: 129.1143 },
    { name: '태백시', lat: 37.1640, lon: 128.9859 },
    { name: '속초시', lat: 38.2071, lon: 128.5918 },
    { name: '삼척시', lat: 37.4500, lon: 129.1651 },
    { name: '홍천군', lat: 37.6970, lon: 127.8887 },
    { name: '횡성군', lat: 37.4914, lon: 127.9850 },
    { name: '영월군', lat: 37.1838, lon: 128.4617 },
    { name: '평창군', lat: 37.3707, lon: 128.3904 },
    { name: '정선군', lat: 37.3808, lon: 128.6608 },
    { name: '철원군', lat: 38.1468, lon: 127.3133 },
    { name: '화천군', lat: 38.1062, lon: 127.7081 },
    { name: '양구군', lat: 38.1102, lon: 127.9896 },
    { name: '인제군', lat: 38.0695, lon: 128.1706 },
    { name: '고성군', lat: 38.3802, lon: 128.4679 },
    { name: '양양군', lat: 38.0753, lon: 128.6189 },
  ],
  '충청북도': [
    { name: '청주시', lat: 36.6424, lon: 127.4890 },
    { name: '충주시', lat: 36.9910, lon: 127.9259 },
    { name: '제천시', lat: 37.1326, lon: 128.1910 },
    { name: '보은군', lat: 36.4895, lon: 127.7295 },
    { name: '옥천군', lat: 36.3063, lon: 127.5714 },
    { name: '영동군', lat: 36.1750, lon: 127.7833 },
    { name: '증평군', lat: 36.7854, lon: 127.5816 },
    { name: '진천군', lat: 36.8554, lon: 127.4356 },
    { name: '괴산군', lat: 36.8154, lon: 127.7869 },
    { name: '음성군', lat: 36.9401, lon: 127.6904 },
    { name: '단양군', lat: 36.9845, lon: 128.3655 },
  ],
  '충청남도': [
    { name: '천안시', lat: 36.8151, lon: 127.1139 },
    { name: '공주시', lat: 36.4466, lon: 127.1192 },
    { name: '보령시', lat: 36.3334, lon: 126.6128 },
    { name: '아산시', lat: 36.7898, lon: 127.0018 },
    { name: '서산시', lat: 36.7846, lon: 126.4503 },
    { name: '논산시', lat: 36.1872, lon: 127.0988 },
    { name: '계룡시', lat: 36.2745, lon: 127.2486 },
    { name: '당진시', lat: 36.8896, lon: 126.6296 },
    { name: '금산군', lat: 36.1086, lon: 127.4880 },
    { name: '부여군', lat: 36.2756, lon: 126.9098 },
    { name: '서천군', lat: 36.0803, lon: 126.6916 },
    { name: '청양군', lat: 36.4592, lon: 126.8022 },
    { name: '홍성군', lat: 36.6009, lon: 126.6607 },
    { name: '예산군', lat: 36.6826, lon: 126.8498 },
    { name: '태안군', lat: 36.7456, lon: 126.2977 },
  ],
  '전북특별자치도': [
    { name: '전주시', lat: 35.8242, lon: 127.1480 },
    { name: '군산시', lat: 35.9676, lon: 126.7368 },
    { name: '익산시', lat: 35.9483, lon: 126.9576 },
    { name: '정읍시', lat: 35.5699, lon: 126.8559 },
    { name: '남원시', lat: 35.4164, lon: 127.3903 },
    { name: '김제시', lat: 35.8037, lon: 126.8809 },
    { name: '완주군', lat: 35.8452, lon: 127.1481 },
    { name: '진안군', lat: 35.7918, lon: 127.4248 },
    { name: '무주군', lat: 36.0070, lon: 127.6606 },
    { name: '장수군', lat: 35.6476, lon: 127.5213 },
    { name: '임실군', lat: 35.6178, lon: 127.2891 },
    { name: '순창군', lat: 35.3743, lon: 127.1374 },
    { name: '고창군', lat: 35.4358, lon: 126.7019 },
    { name: '부안군', lat: 35.7316, lon: 126.7330 },
  ],
  '전라남도': [
    { name: '목포시', lat: 34.8118, lon: 126.3922 },
    { name: '여수시', lat: 34.7604, lon: 127.6622 },
    { name: '순천시', lat: 34.9506, lon: 127.4872 },
    { name: '나주시', lat: 35.0155, lon: 126.7108 },
    { name: '광양시', lat: 34.9407, lon: 127.6959 },
    { name: '담양군', lat: 35.3213, lon: 126.9881 },
    { name: '곡성군', lat: 35.2821, lon: 127.2922 },
    { name: '구례군', lat: 35.2026, lon: 127.4628 },
    { name: '고흥군', lat: 34.6114, lon: 127.2755 },
    { name: '보성군', lat: 34.7714, lon: 127.0797 },
    { name: '화순군', lat: 35.0644, lon: 126.9869 },
    { name: '장흥군', lat: 34.6816, lon: 126.9068 },
    { name: '강진군', lat: 34.6419, lon: 126.7672 },
    { name: '해남군', lat: 34.5734, lon: 126.5993 },
    { name: '영암군', lat: 34.8001, lon: 126.6967 },
    { name: '무안군', lat: 34.9906, lon: 126.4815 },
    { name: '함평군', lat: 35.0655, lon: 126.5168 },
    { name: '영광군', lat: 35.2772, lon: 126.5121 },
    { name: '장성군', lat: 35.3019, lon: 126.7847 },
    { name: '완도군', lat: 34.3109, lon: 126.7543 },
    { name: '진도군', lat: 34.4869, lon: 126.2634 },
    { name: '신안군', lat: 34.8268, lon: 126.1072 },
  ],
  '경상북도': [
    { name: '포항시', lat: 36.0190, lon: 129.3435 },
    { name: '경주시', lat: 35.8562, lon: 129.2248 },
    { name: '김천시', lat: 36.1398, lon: 128.1136 },
    { name: '안동시', lat: 36.5684, lon: 128.7296 },
    { name: '구미시', lat: 36.1196, lon: 128.3446 },
    { name: '영주시', lat: 36.8057, lon: 128.6240 },
    { name: '영천시', lat: 35.9733, lon: 128.9385 },
    { name: '상주시', lat: 36.4109, lon: 128.1591 },
    { name: '문경시', lat: 36.5866, lon: 128.1867 },
    { name: '경산시', lat: 35.8251, lon: 128.7414 },
    { name: '의성군', lat: 36.3527, lon: 128.6970 },
    { name: '청송군', lat: 36.4362, lon: 129.0570 },
    { name: '영양군', lat: 36.6667, lon: 129.1124 },
    { name: '영덕군', lat: 36.4151, lon: 129.3660 },
    { name: '청도군', lat: 35.6473, lon: 128.7340 },
    { name: '고령군', lat: 35.7261, lon: 128.2628 },
    { name: '성주군', lat: 35.9191, lon: 128.2830 },
    { name: '칠곡군', lat: 35.9955, lon: 128.4016 },
    { name: '예천군', lat: 36.6578, lon: 128.4526 },
    { name: '봉화군', lat: 36.8930, lon: 128.7325 },
    { name: '울진군', lat: 36.9931, lon: 129.4002 },
    { name: '울릉군', lat: 37.4845, lon: 130.9058 },
  ],
  '경상남도': [
    { name: '창원시', lat: 35.2280, lon: 128.6811 },
    { name: '진주시', lat: 35.1798, lon: 128.1076 },
    { name: '통영시', lat: 34.8544, lon: 128.4331 },
    { name: '사천시', lat: 35.0037, lon: 128.0642 },
    { name: '김해시', lat: 35.2285, lon: 128.8894 },
    { name: '밀양시', lat: 35.5037, lon: 128.7464 },
    { name: '거제시', lat: 34.8806, lon: 128.6211 },
    { name: '양산시', lat: 35.3350, lon: 129.0372 },
    { name: '의령군', lat: 35.3222, lon: 128.2616 },
    { name: '함안군', lat: 35.2727, lon: 128.4065 },
    { name: '창녕군', lat: 35.5446, lon: 128.4927 },
    { name: '고성군', lat: 34.9727, lon: 128.3225 },
    { name: '남해군', lat: 34.8375, lon: 127.8924 },
    { name: '하동군', lat: 35.0671, lon: 127.7514 },
    { name: '산청군', lat: 35.4155, lon: 127.8734 },
    { name: '함양군', lat: 35.5202, lon: 127.7251 },
    { name: '거창군', lat: 35.6868, lon: 127.9094 },
    { name: '합천군', lat: 35.5666, lon: 128.1658 },
  ],
  '제주특별자치도': [
    { name: '제주시', lat: 33.4996, lon: 126.5312 },
    { name: '서귀포시', lat: 33.2541, lon: 126.5600 },
  ],
}

async function seedRegions() {
  console.log('🌱 지역 마스터 시드 시작...\n')

  // 1. 광역시도 삽입
  console.log('📍 광역시도 삽입 중...')
  const provinceMap = new Map<string, bigint>()

  for (const province of PROVINCES) {
    const created = await prisma.region.upsert({
      where: { name: province.name },
      update: {
        lat: province.lat,
        lon: province.lon,
      },
      create: {
        name: province.name,
        type: 'PROVINCE',
        lat: province.lat,
        lon: province.lon,
      },
    })
    provinceMap.set(province.name, created.id)
    console.log(`  ✅ ${province.name} (ID: ${created.id})`)
  }

  console.log(`\n📍 광역시도 ${PROVINCES.length}개 완료\n`)

  // 2. 시군구 삽입
  console.log('📍 시군구 삽입 중...')
  let cityCount = 0

  for (const [provinceName, cities] of Object.entries(CITIES)) {
    const parentId = provinceMap.get(provinceName)
    if (!parentId) {
      console.log(`  ⚠️ ${provinceName} 광역시도를 찾을 수 없음`)
      continue
    }

    for (const city of cities) {
      await prisma.region.upsert({
        where: { name: city.name },
        update: {
          parentId,
          lat: city.lat,
          lon: city.lon,
        },
        create: {
          name: city.name,
          type: 'CITY',
          parentId,
          lat: city.lat,
          lon: city.lon,
        },
      })
      cityCount++
    }
    console.log(`  ✅ ${provinceName}: ${cities.length}개 시군구`)
  }

  console.log(`\n📍 시군구 ${cityCount}개 완료`)

  // 3. 통계 출력
  const stats = await prisma.region.groupBy({
    by: ['type'],
    _count: { id: true },
  })

  console.log('\n📊 최종 통계:')
  for (const stat of stats) {
    console.log(`  ${stat.type}: ${stat._count.id}개`)
  }

  const total = await prisma.region.count()
  console.log(`  총: ${total}개`)
}

async function main() {
  try {
    await seedRegions()
    console.log('\n✅ 지역 마스터 시드 완료!')
  } catch (error) {
    console.error('❌ 시드 실패:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
