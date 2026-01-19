import { ChatContainer } from "@/components/chat/ChatContainer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solar Insight - 채팅",
  description: "태양광 발전 정보 챗봇",
};

export default function ChatPage() {
  return <ChatContainer />;
}
