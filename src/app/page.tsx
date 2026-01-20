import Link from "next/link";
import { SolarAvatar } from "@/components/common";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-solar-orange-light via-white to-solar-orange-light/50">
      {/* 컨테이너 */}
      <div className="flex flex-col items-center justify-center w-full max-w-[800px] px-6 py-12">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-10">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-solar-orange flex items-center justify-center shadow-xl">
              <SolarAvatar size="lg" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-3">
            솔라가이드
          </h1>
          <p className="text-base text-text-secondary">
            태양광 발전 사업 AI 챗봇
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
          <div className="bg-white rounded-2xl p-5 shadow-md border border-border">
            <div className="w-10 h-10 rounded-xl bg-solar-orange-light text-solar-orange flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">
              발전량 조회
            </h3>
            <p className="text-sm text-text-secondary">
              지역별, 월별 발전량 현황을 확인하세요
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-border">
            <div className="w-10 h-10 rounded-xl bg-solar-orange-light text-solar-orange flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">
              수익 계산
            </h3>
            <p className="text-sm text-text-secondary">
              REC, SMP 기반 예상 수익을 계산해 드립니다
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-border">
            <div className="w-10 h-10 rounded-xl bg-solar-orange-light text-solar-orange flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">
              AI 상담
            </h3>
            <p className="text-sm text-text-secondary">
              24시간 AI가 친절하게 안내해 드립니다
            </p>
          </div>
        </div>

        {/* CTA 버튼 */}
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-8 py-4 bg-solar-orange hover:bg-solar-orange/90 text-white font-bold rounded-full shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          상담 시작하기
        </Link>

        {/* 푸터 */}
        <footer className="mt-12 text-center">
          <p className="text-xs text-text-muted">
            © 솔라가이드 | 태양광 발전 AI 챗봇
          </p>
        </footer>
      </div>
    </div>
  );
}
