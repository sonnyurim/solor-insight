"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Message,
  ClassificationResult,
  RevenueCalculationResult,
} from "@/lib/chat/types";
import { GUARDRAIL_MESSAGES } from "@/lib/chat/types";
import {
  classifyMessageApi,
  processCalculatorApi,
} from "@/lib/chat/actions";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Context 타입
interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  lastResult: ClassificationResult | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

// Context 생성
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider Props
interface ChatProviderProps {
  children: ReactNode;
}

/**
 * Chat Context Provider
 * 채팅 상태와 메시지 처리 로직을 관리
 */
export function ChatProvider({ children }: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ClassificationResult | null>(
    null
  );

  const sendMessage = useCallback(async (content: string) => {
    setError(null);

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Server Action 호출 - 의도 분류
      const result = await classifyMessageApi(content);
      setLastResult(result);

      // 봇 응답 메시지 생성
      let botMessage: Message;

      if (!result.success) {
        // 에러 발생
        setError(result.error || "알 수 없는 오류");
        botMessage = {
          id: generateId(),
          role: "assistant",
          content: "죄송합니다. 처리 중 오류가 발생했습니다.",
          timestamp: new Date(),
        };
      } else if (result.blocked) {
        // 차단됨
        const botContent =
          result.blockMessage || GUARDRAIL_MESSAGES[result.blockType!];
        botMessage = {
          id: generateId(),
          role: "assistant",
          content: botContent,
          timestamp: new Date(),
          blocked: true,
          blockType: result.blockType,
        };
      } else if (
        result.intents?.includes("CALCULATOR") &&
        result.intents.length === 1
      ) {
        // CALCULATOR 의도가 단독으로 확정된 경우 - 수익 계산 수행
        const calcResult = await processCalculatorApi(content);

        if (!calcResult.success) {
          // 계산 오류
          setError(calcResult.error || "계산 중 오류가 발생했습니다.");
          botMessage = {
            id: generateId(),
            role: "assistant",
            content: "죄송합니다. 계산 중 오류가 발생했습니다.",
            timestamp: new Date(),
            classification: {
              isMulti: false,
              intents: ["CALCULATOR"],
              confidence: result.confidence || "HIGH",
              scores: result.scores,
              reason: result.reason,
            },
          };
        } else if (calcResult.needsMoreInfo) {
          // 추가 정보 필요
          botMessage = {
            id: generateId(),
            role: "assistant",
            content: calcResult.followUpQuestion || "추가 정보가 필요합니다.",
            timestamp: new Date(),
            classification: {
              isMulti: false,
              intents: ["CALCULATOR"],
              confidence: result.confidence || "HIGH",
              scores: result.scores,
              reason: "필수 파라미터 누락",
            },
          };
        } else {
          // 계산 완료
          botMessage = {
            id: generateId(),
            role: "assistant",
            content: "예상 수익을 계산했습니다.",
            timestamp: new Date(),
            classification: {
              isMulti: false,
              intents: ["CALCULATOR"],
              confidence: result.confidence || "HIGH",
              scores: result.scores,
              reason: result.reason,
            },
            calculationResult: calcResult.result as RevenueCalculationResult,
          };
        }
      } else {
        // 기타 의도 - 기존 로직
        const intentNames = result.intents?.join(", ") || "GENERAL";
        const isMultiText = result.isMulti ? " (복합 의도)" : "";

        const botContent = `질문이 [${intentNames}]${isMultiText}로 분류되었습니다.\n\n${
          result.reason ? `📝 ${result.reason}` : ""
        }\n\n(응답 생성 기능은 추후 구현 예정입니다)`;

        botMessage = {
          id: generateId(),
          role: "assistant",
          content: botContent,
          timestamp: new Date(),
          classification: {
            isMulti: result.isMulti || false,
            intents: result.intents || ["GENERAL"],
            confidence: result.confidence || "LOW",
            scores: result.scores,
            reason: result.reason,
          },
        };
      }

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(errorMessage);

      // 에러 메시지 추가
      const errorBotMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "죄송합니다. 처리 중 오류가 발생했습니다.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setLastResult(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        error,
        lastResult,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

/**
 * Chat Context Hook
 * ChatProvider 내부에서만 사용 가능
 */
export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}
