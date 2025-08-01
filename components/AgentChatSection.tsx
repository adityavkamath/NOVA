"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Bot, 
  Copy, 
  Send, 
  FileText, 
  Square,
  Upload,
  MessageSquare 
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

interface SourceInfo {
  title: string;
  content_preview: string;
  page?: number;
  relevance_score: number;
  type?: string;
  url?: string;
}

interface AgentMessage {
  id: string;
  type: "user" | "ai_agent" | "system";
  content: string;
  timestamp: Date;
  sources?: SourceInfo[];
  isStreaming?: boolean;
  isLoading?: boolean;
  agentType?: string;
  thinking?: string;
}

interface StreamChunk {
  content?: string;
  sources?: SourceInfo[];
  thinking?: string;
  error?: string;
}

interface AgentSession {
  id: string;
  title: string;
  description?: string;
  agent_type: string;
  data_sources: Record<string, any>;
  created_at: string;
}

interface AgentChatSectionProps {
  pdfId?: string;
  sessionId?: string;
  agentType?: "document_agent" | "coordinator";
}

export default function AgentChatSection({
  pdfId,
  sessionId,
  agentType = "document_agent"
}: AgentChatSectionProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<AgentSession | null>(null);
  const [pdfIdState, setPdfIdState] = useState<string | undefined>(pdfId);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch agent status on component mount
  useEffect(() => {
    fetchAgentStatus();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load all messages for a session when sessionId changes and is valid
  useEffect(() => {
    if (!sessionId || sessionId === "" || sessionId === "null" || sessionId === "undefined") {
      return;
    }
    if (!user?.id) {
      return;
    }
    loadSession(sessionId);
  }, [sessionId, user?.id]);

  // Keep state in sync with props if they change
  useEffect(() => { setPdfIdState(pdfId); }, [pdfId]);

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/agent-status`, {
        headers: {
          "user-id": user?.id || "",
        },
      });
      const status = await response.json();
      setAgentStatus(status);
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    }
  };

  // Helper to sort messages by timestamp ascending
  const sortMessagesByTimestamp = (msgs: AgentMessage[]) => {
    return msgs.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  // Helper to validate UUID
  const isValidUuid = (id: string | undefined) => {
    if (!id || id === "null" || id === "undefined" || id === "") return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);
  };

  // Load all messages for a session
  const loadSession = async (sessionId: string) => {
    if (!isValidUuid(sessionId)) {
      setMessages([]);
      return;
    }
    try {
      const messagesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/sessions/${sessionId}/messages`, {
        headers: {
          "user-id": user?.id || "",
        },
      });
      if (!messagesResponse.ok) {
        throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
      }
      const sessionMessages = await messagesResponse.json();
      const formattedMessages: AgentMessage[] = sessionMessages.map((msg: any) => ({
        id: msg.id,
        type: msg.role === "user" ? "user" : "ai_agent",
        content: msg.message,
        timestamp: new Date(msg.created_at),
        sources: msg.sources ? JSON.parse(msg.sources) : undefined
      }));
      const sortedMessages = sortMessagesByTimestamp(formattedMessages);
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Failed to load session:", error);
    }
  };

  const createSession = async (): Promise<string | null> => {
    try {
      const dataSources: Record<string, any> = {};
      if (pdfId) dataSources.pdf_id = pdfId;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/create-agent-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": user?.id || "",
        },
        body: JSON.stringify({
          title: `PDF Analysis - ${new Date().toLocaleString()}`,
          description: "PDF document analysis session",
          agent_type: agentType,
          data_sources: dataSources
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const sessionData = await response.json();
      setCurrentSession(sessionData);
      return sessionData.id;
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create chat session");
      return null;
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Create session if not exists
    let sessionIdToUse = currentSession?.id;
    if (!sessionIdToUse) {
      const newSessionId = await createSession();
      if (!newSessionId) {
        setIsLoading(false);
        return;
      }
      sessionIdToUse = newSessionId;
    }

    // Create AI message placeholder
    const aiMessage: AgentMessage = {
      id: (Date.now() + 1).toString(),
      type: "ai_agent",
      content: "",
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages((prev) => [...prev, aiMessage]);

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": user?.id || "",
        },
        body: JSON.stringify({
          query: inputValue,
          session_id: sessionIdToUse,
          pdf_id: pdfIdState,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response reader available");
      }

      let accumulatedContent = "";
      // Removed currentSources and currentThinking variables as they're not needed

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamChunk = JSON.parse(line.slice(6));
              
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.content) {
                accumulatedContent += data.content;
              }

              // Ignore sources and thinking data per user request
              // if (data.sources) {
              //   currentSources = data.sources;
              // }

              // if (data.thinking) {
              //   currentThinking = data.thinking;
              // }

              // Update the AI message - only content, no thinking or sources
              setMessages((prev) => prev.map((msg) => 
                msg.id === aiMessage.id 
                  ? {
                      ...msg,
                      content: accumulatedContent,
                      isStreaming: true
                    }
                  : msg
              ));
            } catch (parseError) {
              console.error('Failed to parse chunk:', parseError);
            }
          }
        }
      }

      // Mark as complete
      setMessages((prev) => prev.map((msg) => 
        msg.id === aiMessage.id 
          ? { ...msg, isStreaming: false, thinking: undefined }
          : msg
      ));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info("Request cancelled");
      } else {
        console.error('Chat error:', error);
        toast.error("Failed to send message");
        
        setMessages((prev) => prev.map((msg) => 
          msg.id === aiMessage.id 
            ? { 
                ...msg, 
                content: "Sorry, I encountered an error processing your request. Please try again.",
                isStreaming: false,
                thinking: undefined
              }
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      toast.info("Generation stopped");
    }
  };

  // PDF Upload Handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/pdf/upload-pdf`, {
        method: "POST",
        headers: { "user-id": user?.id || "" },
        body: formData,
      });
      if (!res.ok) throw new Error("PDF upload failed");
      const data = await res.json();
      setPdfIdState(data.data?.id || data.pdf_id || data.id || data.uuid);
      toast.success("PDF uploaded successfully!");
    } catch (err) {
      console.error("PDF upload error:", err);
      toast.error(`PDF upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 border border-gray-800 rounded-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-purple-700 to-blue-700 rounded-lg shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white drop-shadow">PDF Document Agent</h2>
            <p className="text-xs text-gray-400">
              {agentStatus?.status === "active" 
                ? "Document analysis agent ready"
                : "Initializing agent..."
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            agentStatus?.status === "active" ? "bg-green-500" : "bg-yellow-500"
          }`} />
          <UserButton />
        </div>
      </div>

      {/* Data Sources Info */}
      {pdfIdState && (
        <div className="p-3 bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-800">
          <div className="flex items-center space-x-2 text-sm text-blue-200">
            <FileText className="w-4 h-4" />
            <span>Document Ready:</span>
            <Badge variant="outline" className="bg-purple-900 text-purple-200 border-none">PDF Document</Badge>
          </div>
        </div>
      )}

      {/* PDF Upload */}
      <div className="border-b border-gray-800 p-4 bg-gray-900/80">
        <div className="flex items-center space-x-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">PDF Document</label>
            <label className="inline-flex items-center px-3 py-2 bg-purple-700 text-white rounded cursor-pointer hover:bg-purple-800 transition shadow-lg">
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
              <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploading} className="hidden" />
            </label>
            {pdfIdState && <Badge variant="outline" className="ml-2 bg-green-700 text-white border-none">PDF Ready</Badge>}
          </div>
        </div>
        <div className="text-sm text-gray-400">
          <p>
            <strong>📄 Document Analysis:</strong> Upload PDF documents for comprehensive analysis, Q&A, and insights.
            {pdfIdState && " Your document is ready for analysis."}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-700 to-blue-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                PDF Document Analysis
              </h3>
              <p className="text-gray-400 mb-4 max-w-md mx-auto">
                Upload a PDF document and ask questions about its content. I can analyze, summarize, and extract key information from your documents.
              </p>
              {!pdfIdState && (
                <p className="text-sm text-purple-400">
                  Start by uploading a PDF document above.
                </p>
              )}
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-3xl ${
                  message.type === "user" 
                    ? "bg-gradient-to-r from-blue-700 to-purple-700 text-white ml-12" 
                    : "bg-gray-800 border border-gray-700 mr-12"
                } rounded-lg p-4 shadow-lg`}>
                  {message.type === "ai_agent" && (
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium text-purple-400">Document Agent</span>
                      {message.isStreaming && (
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-white whitespace-pre-wrap">
                    {message.content || (message.isStreaming ? (
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-32 bg-gray-700" />
                      </div>
                    ) : "")}
                  </div>

                  
                  {message.type === "ai_agent" && message.content && !message.isStreaming && (
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(message.content)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/80">
        <div className="flex space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={pdfIdState ? "Ask a question about your PDF document..." : "Upload a PDF document first to start analyzing..."}
            disabled={isLoading || !pdfIdState}
            className="flex-1 p-3 bg-gray-800 text-white border border-gray-700 rounded-lg resize-none focus:border-purple-500 focus:outline-none placeholder-gray-500 shadow-inner"
            rows={3}
          />
          <div className="flex flex-col space-y-2">
            {isLoading ? (
              <Button
                onClick={stopGeneration}
                variant="outline"
                className="px-4 py-3 bg-red-700 hover:bg-red-800 border-red-600 text-white shadow-lg"
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={sendMessage}
                disabled={!inputValue.trim() || !pdfIdState}
                className="px-4 py-3 bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-800 hover:to-blue-800 text-white shadow-lg disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
