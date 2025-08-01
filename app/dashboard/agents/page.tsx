"use client";

import { useState, useEffect } from "react";
import {
  Users, Plus, MessageSquare, Brain, Bot, Trash2, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AgentChatSection from "@/components/AgentChatSection";
import { toast } from "sonner";
import { useUser, useAuth } from "@clerk/nextjs";

interface AgentSession {
  id: string;
  title: string;
  description?: string;
  agent_type: string;
  data_sources: Record<string, any>;
  created_at: string;
}

export default function AgentDashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchAgentStatus();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/sessions`, {
        headers: {
          "user-id": user?.id || "",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      toast.error("Failed to load chat sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAgentStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/agent-status`, {
        headers: {
          "user-id": user?.id || "",
          "Authorization": `Bearer ${token}`,
        },
      });
      const status = await response.json();
      setAgentStatus(status);
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "user-id": user?.id || "",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
        }
        toast.success("Session deleted successfully");
      } else {
        throw new Error("Failed to delete session");
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    }
  };

  const getDataSourceBadges = (dataSources: Record<string, any>) => {
    const badges = [];
    if (dataSources.pdf_id) badges.push(<Badge key="pdf" variant="outline">PDF</Badge>);
    return badges;
  };

  const getAgentTypeIcon = (agentType: string) => {
    switch (agentType) {
      case "document_agent":
        return <Bot className="w-4 h-4" />;
      case "coordinator":
        return <Brain className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  if (selectedSession || showNewChat) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950">
        <div className="p-4 border-b border-gray-800 bg-gray-900/80 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedSession(null);
                  setShowNewChat(false);
                }}
                className="mr-2 text-gray-300 hover:text-white"
              >
                ← Back to Sessions
              </Button>
              {/* <h1 className="text-xl font-semibold text-white">
                {selectedSession ? selectedSession.title : "New Agent Chat"}
              </h1> */}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <AgentChatSection
            sessionId={selectedSession?.id}
            agentType={(selectedSession?.agent_type as "document_agent" | "coordinator") || "document_agent"}
            pdfId={selectedSession?.data_sources?.pdf_id}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">PDF Document Agent</h1>
              <p className="text-gray-400">
                Chat with specialized AI agent for comprehensive PDF document analysis
              </p>
            </div>
          </div>
        </div>

        {/* Agent Status */}
        <div className="mb-6">
          <h3 className="font-medium text-white">Document Analysis Agent Status</h3>
          <p className="text-sm text-gray-400">
            {agentStatus?.status === "active"
              ? "Ready to analyze PDF documents"
              : "Initializing..."}
          </p>

          {agentStatus?.capabilities && (
            <div className="flex items-center space-x-2 mt-2">
              {agentStatus.capabilities.document_analysis && (
                <Badge variant="outline" className="bg-purple-900 text-purple-200 border-none">
                  Document Analysis
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Sessions Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-6 bg-gray-900/80 rounded-lg border border-gray-800 shadow-lg">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-800 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-800 rounded w-1/2 mb-4"></div>
                  <div className="flex space-x-2">
                    <div className="h-6 bg-gray-800 rounded w-12"></div>
                    <div className="h-6 bg-gray-800 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-700 to-blue-700 rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-lg">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              No Document Chats Yet
            </h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Start your first conversation with the PDF document analysis agent. Upload documents and get comprehensive insights.
            </p>
            <Button
              onClick={() => setShowNewChat(true)}
              className="bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-800 hover:to-blue-800 text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start Document Chat
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="p-6 bg-gray-900/80 rounded-lg border border-gray-800 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                onClick={() => setSelectedSession(session)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    {getAgentTypeIcon(session.agent_type)}
                    <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors drop-shadow">
                      {session.title}
                    </h3>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {session.description && (
                  <p className="text-sm text-gray-400 mb-3">{session.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {getDataSourceBadges(session.data_sources)}
                    {Object.keys(session.data_sources).length === 0 && (
                      <Badge variant="outline" className="bg-gray-800 text-gray-300 border-none">General Chat</Badge>
                    )}
                  </div>

                  <span className="text-xs text-gray-400">
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800">
                  <div className="flex items-center text-sm text-gray-400">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Agent Type: {session.agent_type.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
