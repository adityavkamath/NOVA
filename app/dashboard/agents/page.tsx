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

// Skeleton Loading Component
const SessionSkeleton = () => (
  <div className="p-6 rounded-lg border border-gray-800 shadow-lg"
       style={{
         background: 'rgba(31, 41, 55, 0.8)',
         backdropFilter: 'blur(10px)'
       }}>
    <div className="animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-32"></div>
        </div>
        <div className="h-4 w-4 bg-gray-700 rounded"></div>
      </div>
      <div className="h-3 bg-gray-700 rounded w-3/4 mb-4"></div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          <div className="h-6 bg-gray-700 rounded w-12"></div>
          <div className="h-6 bg-gray-700 rounded w-16"></div>
        </div>
        <div className="h-3 bg-gray-700 rounded w-16"></div>
      </div>
      <div className="pt-3 border-t border-gray-800">
        <div className="flex items-center">
          <div className="h-4 w-4 bg-gray-700 rounded mr-1"></div>
          <div className="h-3 bg-gray-700 rounded w-24"></div>
        </div>
      </div>
    </div>
  </div>
);

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/agents/sessions`, {
        headers: {
          "user-id": user?.id || "",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/agents/agent-status`, {
        headers: {
          "user-id": user?.id || "",
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const status = await response.json();
        setAgentStatus(status);
      } else {
        console.warn("Failed to fetch agent status:", response.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/agents/sessions/${sessionId}`, {
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    }
  };

  const getDataSourceBadges = (dataSources: Record<string, any>) => {
    const badges = [];
    if (dataSources.pdf_id) {
      badges.push(
        <Badge key="pdf" variant="outline" className="bg-red-900/30 text-red-200 border-red-700">
          <FileText className="w-3 h-3 mr-1" />
          PDF
        </Badge>
      );
    }
    if (dataSources.document_id) {
      badges.push(
        <Badge key="doc" variant="outline" className="bg-blue-900/30 text-blue-200 border-blue-700">
          <FileText className="w-3 h-3 mr-1" />
          Document
        </Badge>
      );
    }
    return badges;
  };

  const getAgentTypeIcon = (agentType: string) => {
    switch (agentType) {
      case "document_agent":
        return <Bot className="w-4 h-4 text-purple-400" />;
      case "coordinator":
        return <Brain className="w-4 h-4 text-blue-400" />;
      default:
        return <MessageSquare className="w-4 h-4 text-green-400" />;
    }
  };

  const formatAgentType = (agentType: string) => {
    return agentType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (selectedSession || showNewChat) {
    return (
      <div className="h-screen flex flex-col" 
           style={{
             background: 'linear-gradient(135deg, #1f2937 0%, #374151 50%, #0c0a09 100%)'
           }}>
        <div className="p-4 border-b border-gray-800 shadow-lg"
             style={{
               background: 'rgba(31, 41, 55, 0.8)',
               backdropFilter: 'blur(10px)'
             }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedSession(null);
                  setShowNewChat(false);
                }}
                className="mr-2 text-gray-300 hover:text-white hover:bg-gray-700"
              >
                ← Back to Sessions
              </Button>
              <h1 className="text-xl font-semibold text-white">
                {selectedSession ? selectedSession.title : "New Agent Chat"}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
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
    <div className="min-h-screen" 
         style={{
           background: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #374151 100%)'
         }}>
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
            <Button
              onClick={() => setShowNewChat(true)}
              className="text-white shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)'
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Agent Status */}
        <div className="mb-6 p-4 rounded-lg border border-gray-800"
             style={{
               background: 'rgba(31, 41, 55, 0.8)',
               backdropFilter: 'blur(10px)'
             }}>
          <h3 className="font-medium text-white mb-2">Document Analysis Agent Status</h3>
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${agentStatus?.status === "active" ? "bg-green-400" : "bg-yellow-400"}`}></div>
            <p className="text-sm text-gray-400">
              {agentStatus?.status === "active"
                ? "Ready to analyze PDF documents"
                : "Initializing..."}
            </p>
          </div>

          {agentStatus?.capabilities && (
            <div className="flex items-center space-x-2">
              {agentStatus.capabilities.document_analysis && (
                <Badge variant="outline" className="bg-purple-900/30 text-purple-200 border-purple-700">
                  Document Analysis
                </Badge>
              )}
              {agentStatus.capabilities.text_extraction && (
                <Badge variant="outline" className="bg-blue-900/30 text-blue-200 border-blue-700">
                  Text Extraction
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Sessions Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-lg"
                 style={{
                   background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)'
                 }}>
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
              className="text-white shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)'
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Start Document Chat
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Chat Sessions</h2>
              <p className="text-sm text-gray-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-6 rounded-lg border border-gray-800 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group hover:border-gray-700"
                  style={{
                    background: 'rgba(31, 41, 55, 0.8)',
                    backdropFilter: 'blur(10px)'
                  }}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {getAgentTypeIcon(session.agent_type)}
                      <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors drop-shadow truncate">
                        {session.title}
                      </h3>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this session?")) {
                          deleteSession(session.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-900/20 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {session.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{session.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1 flex-wrap gap-1">
                      {getDataSourceBadges(session.data_sources)}
                      {Object.keys(session.data_sources).length === 0 && (
                        <Badge variant="outline" className="bg-gray-800/50 text-gray-300 border-gray-600">
                          General Chat
                        </Badge>
                      )}
                    </div>

                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-800">
                    <div className="flex items-center text-sm text-gray-400">
                      <MessageSquare className="w-4 h-4 mr-1 flex-shrink-0" />
                      <span className="truncate">Agent: {formatAgentType(session.agent_type)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}