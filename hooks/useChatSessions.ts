"use client";

import { fetchChatSessions, fetchFirstMessage, fetchMultiSourceChatSessions, fetchMultiSourceFirstMessage, fetchAgentChatSessions, fetchAgentFirstMessage } from "@/actions/chatSessions";
import { truncateText } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  feature_type: 'pdf' | 'csv' | 'web' | 'multi_source' | 'agent_chat';
  source_id?: string;
  created_at: string;
  updated_at?: string;
  firstMessage?: string;
  isActive?: boolean;
}

export function useChatSessions() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = user?.id;
      if (!userId) {
        throw new Error('User ID not available');
      }

      // Fetch PDF, multi-source, and agent chat sessions in parallel
      const [pdfData, multiSourceData, agentData] = await Promise.all([
        fetchChatSessions(userId),
        fetchMultiSourceChatSessions(userId),
        fetchAgentChatSessions(userId)
      ]);
      
      const allSessions: ChatSession[] = [];
      
      // Process PDF chat sessions
      if (pdfData.success && pdfData.data) {
        const pdfSessionsWithFirstMessage = await Promise.all(
          pdfData.data.map(async (session: ChatSession) => {
            try {
              const firstMsgData = await fetchFirstMessage(session.id, userId);
              const firstUserMessage = firstMsgData.data?.find((msg: any) => msg.role === 'user');
              
              return {
                ...session,
                firstMessage: firstUserMessage ? truncateText(firstUserMessage.message) : session.title
              };
            } catch {
              return {
                ...session,
                firstMessage: session.title
              };
            }
          })
        );
        allSessions.push(...pdfSessionsWithFirstMessage);
      }
      
      // Process multi-source chat sessions
      if (multiSourceData.sessions && multiSourceData.sessions.length > 0) {
        const multiSourceSessionsWithFirstMessage = await Promise.all(
          multiSourceData.sessions.map(async (session: any) => {
            try {
              const firstMsgData = await fetchMultiSourceFirstMessage(session.id, userId);
              const firstUserMessage = firstMsgData.messages?.find((msg: any) => msg.role === 'user');
              
              return {
                ...session,
                feature_type: 'multi_source' as const,
                source_id: 'multi-source', // Set a default source_id for multi-source chats
                firstMessage: firstUserMessage ? truncateText(firstUserMessage.message) : session.title
              };
            } catch {
              return {
                ...session,
                feature_type: 'multi_source' as const,
                source_id: 'multi-source',
                firstMessage: session.title
              };
            }
          })
        );
        allSessions.push(...multiSourceSessionsWithFirstMessage);
      }

      // Process agent chat sessions
      if (agentData.success && agentData.data && agentData.data.length > 0) {
        const agentSessionsWithFirstMessage = await Promise.all(
          agentData.data.map(async (session: any) => {
            try {
              const firstMsgData = await fetchAgentFirstMessage(session.id, userId);
              const firstUserMessage = firstMsgData.success && firstMsgData.data?.find((msg: any) => msg.role === 'user');
              
              return {
                ...session,
                feature_type: 'agent_chat' as const,
                source_id: 'agent', // Set a default source_id for agent chats
                firstMessage: firstUserMessage ? truncateText(firstUserMessage.message) : session.title
              };
            } catch {
              return {
                ...session,
                feature_type: 'agent_chat' as const,
                source_id: 'agent',
                firstMessage: session.title
              };
            }
          })
        );
        allSessions.push(...agentSessionsWithFirstMessage);
      }
      
      // Remove duplicates based on session ID
      const uniqueSessions = allSessions.filter((session, index, self) => 
        index === self.findIndex(s => s.id === session.id)
      );
      
      // Sort unique sessions by creation date (newest first)
      uniqueSessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setChatSessions(uniqueSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error in fetchSessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if user is available
    if (user?.id) {
      fetchSessions();
    }
  }, [user?.id]);

  return {
    chatSessions,
    loading,
    error,
    refetch: fetchSessions
  };
}