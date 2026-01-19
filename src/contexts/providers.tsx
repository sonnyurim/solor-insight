"use client";

import type { ReactNode } from "react";
import { ChatProvider } from "./chat-context";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 모든 Context Provider를 통합
 *
 * 새로운 Provider 추가 시 이 컴포넌트만 수정
 */
export function Providers({ children }: ProvidersProps) {
  return <ChatProvider>{children}</ChatProvider>;
}
