"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 높이 조절 (최대 3줄, 약 96px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = 96;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-shrink-0 border-t border-border bg-white px-4 py-2"
    >
      <div className="flex items-end gap-3">
        {/* 입력 필드 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-[24px] bg-surface border-0 px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-solar-orange/30 disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto scrollbar-hide"
          />
        </div>

        {/* 전송 버튼 */}
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="flex-shrink-0 w-10 h-10 mb-0.5 rounded-full bg-solar-orange hover:bg-solar-orange/90 disabled:bg-surface disabled:text-text-muted text-white transition-colors flex items-center justify-center disabled:cursor-not-allowed"
          aria-label="전송"
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
