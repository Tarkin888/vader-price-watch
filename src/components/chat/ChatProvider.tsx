import React, { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  message_type: string;
  metadata: any;
}

interface ChatContextType {
  sessionId: string | null;
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  unreadCount: number;
  setIsOpen: (open: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  resetSession: () => void;
  retryLast: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpenRaw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isOpenRef = React.useRef(false);

  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenRaw(open);
    isOpenRef.current = open;
    if (open) setUnreadCount(0);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      message_type: "TEXT",
      metadata: {},
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { sessionId, message: text, context: { page: window.location.pathname } },
      });

      if (error) throw error;

      if (data?.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      if (data?.message) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          ...data.message,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (!isOpenRef.current) setUnreadCount((c) => c + 1);
      }
    } catch (e) {
      console.error("Chat error:", e);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Connection lost. Check your internet and try again.",
        message_type: "ERROR",
        metadata: {},
      };
      setMessages((prev) => [...prev, errorMsg]);
      if (!isOpenRef.current) setUnreadCount((c) => c + 1);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const resetSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setUnreadCount(0);
  }, []);

  const retryLast = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Remove the last error message
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.message_type === "ERROR") return prev.slice(0, -1);
      return prev;
    });
    await sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  return (
    <ChatContext.Provider
      value={{ sessionId, messages, isOpen, isLoading, unreadCount, setIsOpen, sendMessage, resetSession, retryLast }}
    >
      {children}
    </ChatContext.Provider>
  );
}
