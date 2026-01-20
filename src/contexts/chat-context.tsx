"use client";

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import type { Message, ClassificationResult } from "@/lib/chat/types";

// ==================== 상태 타입 ====================

/**
 * 채팅 상태
 */
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  lastResult: ClassificationResult | null;
}

// ==================== 액션 타입 ====================

/**
 * 채팅 액션 (SRP: 상태 변경만 정의)
 */
export type ChatAction =
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_LAST_RESULT"; payload: ClassificationResult | null }
  | { type: "CLEAR_ALL" };

// ==================== 초기 상태 ====================

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  lastResult: null,
};

// ==================== 리듀서 ====================

/**
 * 채팅 리듀서 (SRP: 상태 변경 로직만 담당)
 */
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "SET_LAST_RESULT":
      return {
        ...state,
        lastResult: action.payload,
      };
    case "CLEAR_ALL":
      return initialState;
    default:
      return state;
  }
}

// ==================== Context 타입 ====================

/**
 * Context 타입 (상태 + dispatch만 제공)
 */
interface ChatContextType {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
}

// ==================== Context 생성 ====================

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// ==================== Provider ====================

interface ChatProviderProps {
  children: ReactNode;
}

/**
 * Chat Context Provider
 * SRP: 상태 관리만 담당 (비즈니스 로직은 Hook으로 분리)
 */
export function ChatProvider({ children }: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

// ==================== Hook ====================

/**
 * Chat Context Hook (raw)
 * 상태와 dispatch만 반환
 */
export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}

// ==================== 유틸리티 ====================

/**
 * 고유 ID 생성
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 사용자 메시지 생성 헬퍼
 */
export function createUserMessage(content: string): Message {
  return {
    id: generateMessageId(),
    role: "user",
    content,
    timestamp: new Date(),
  };
}

/**
 * 봇 메시지 생성 헬퍼
 */
export function createBotMessage(
  content: string,
  options?: Partial<Omit<Message, "id" | "role" | "timestamp">>
): Message {
  return {
    id: generateMessageId(),
    role: "assistant",
    content,
    timestamp: new Date(),
    ...options,
  };
}
