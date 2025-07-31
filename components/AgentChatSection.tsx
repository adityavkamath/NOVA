"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Loader2, Copy, Check, ExternalLink, Users, Zap, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserButton, useUser } from "@clerk/nextjs";
import { toast } from "sonner";

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
  csvId?: string;
  pdfId?: string;
  webId?: string;
  sessionId?: string;
  agentType?: "single_agent" | "multi_agent" | "coordinator";
}

export default function AgentChatSection({
  csvId,
  pdfId, 
  webId,
  sessionId,
  agentType = "multi_agent"
}: AgentChatSectionProps) {
  const { user } = useUser();
  console.log("[AgentChatSection] Rendered with props:", JSON.stringify({ csvId, pdfId, webId, sessionId, agentType }, null, 2));
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<AgentSession | null>(null);
  const [csvIdState, setCsvIdState] = useState<string | undefined>(csvId);
  const [pdfIdState, setPdfIdState] = useState<string | undefined>(pdfId);
  const [webIdState, setWebIdState] = useState<string | undefined>(webId);
  const [webUrl, setWebUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch agent status on component mount
  useEffect(() => {
    console.log("[AgentChatSection] useEffect: fetchAgentStatus");
    fetchAgentStatus();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    console.log("[AgentChatSection] useEffect: messages changed", JSON.stringify(messages, null, 2));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load all messages for a session when sessionId changes and is valid
  useEffect(() => {
    if (!sessionId || sessionId === "" || sessionId === "null" || sessionId === "undefined") {
      console.log("[AgentChatSection] DEBUG: ChatSection - Invalid sessionId:", sessionId, "csvId:", csvId, "pdfId:", pdfId);
      return;
    }
    if (!user?.id) {
      console.log("[AgentChatSection] DEBUG: ChatSection - Invalid userId, skipping message load:", user?.id);
      return;
    }
    console.log("[AgentChatSection] DEBUG: Loading messages for sessionId:", sessionId, "userId:", user?.id);
    loadSession(sessionId);
  }, [sessionId, user?.id]);

  // Only fetch PDF details if pdfId is valid UUID
  useEffect(() => {
    const isValidUuid = (id: string | undefined) => {
      if (!id || id === "null" || id === "undefined" || id === "") return false;
      // UUID v4 regex
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);
    };
    if (isValidUuid(pdfIdState)) {
      // fetchPdfDetails(pdfIdState);
    } else {
      // If not valid, set pdfIdState to undefined to prevent invalid API calls
      if (pdfIdState && (pdfIdState === "null" || pdfIdState === "undefined" || pdfIdState === "")) {
        setPdfIdState(undefined);
      }
      console.log("[AgentChatSection] Skipping PDF fetch, invalid pdfId:", pdfIdState);
    }
  }, [pdfIdState]);

  // Keep state in sync with props if they change
  useEffect(() => { setCsvIdState(csvId); }, [csvId]);
  useEffect(() => {
    console.log("[AgentChatSection] csvId changed:", csvId);
    setCsvIdState(csvId);
  }, [csvId]);
  useEffect(() => { setPdfIdState(pdfId); }, [pdfId]);
  useEffect(() => {
    console.log("[AgentChatSection] pdfId changed:", pdfId);
    setPdfIdState(pdfId);
  }, [pdfId]);
  useEffect(() => { setWebIdState(webId); }, [webId]);
  useEffect(() => {
    console.log("[AgentChatSection] webId changed:", webId);
    setWebIdState(webId);
  }, [webId]);

  const fetchAgentStatus = async () => {
    try {
      console.log("[AgentChatSection] fetchAgentStatus: user", user?.id);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/agent-status`, {
        headers: {
          "user-id": user?.id || "",
        },
      });
      const status = await response.json();
      console.log("[AgentChatSection] Agent status fetched:", status);
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
      console.log("[AgentChatSection] Skipping loadSession, invalid sessionId:", sessionId);
      setMessages([]);
      return;
    }
    try {
      console.log("[AgentChatSection] loadSession: sessionId", sessionId);
      // Only fetch messages for valid sessionId
      const messagesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/sessions/${sessionId}/messages`, {
        headers: {
          "user-id": user?.id || "",
        },
      });
      if (!messagesResponse.ok) {
        console.error("[AgentChatSection] Failed to fetch messages, status:", messagesResponse.status);
        toast.error("Failed to load chat messages");
        setMessages([]);
        return;
      }
      const sessionMessages = await messagesResponse.json();
      console.log("[AgentChatSection] Session messages fetched:", JSON.stringify(sessionMessages, null, 2));
      const formattedMessages: AgentMessage[] = sessionMessages.map((msg: any) => ({
        id: msg.id,
        type: msg.role === "user" ? "user" : "ai_agent",
        content: msg.message,
        timestamp: new Date(msg.created_at),
        sources: msg.sources ? JSON.parse(msg.sources) : undefined
      }));
      // Sort messages by timestamp ascending
      const sortedMessages = sortMessagesByTimestamp(formattedMessages);
      console.log("[AgentChatSection] Sorted messages:", JSON.stringify(sortedMessages, null, 2));
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Failed to load session:", error);
      toast.error("Failed to load chat session");
      setMessages([]);
    }
  };

  const createSession = async (): Promise<string | null> => {
    try {
    console.log("[AgentChatSection] createSession called");
      const dataSources: Record<string, any> = {};
      if (csvId) dataSources.csv_id = csvId;
      if (pdfId) dataSources.pdf_id = pdfId;
      if (webId) dataSources.web_id = webId;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/create-agent-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": user?.id || "",
        },
        body: JSON.stringify({
          title: `Agent Chat - ${new Date().toLocaleString()}`,
          description: "AutoGen powered chat session",
          agent_type: agentType,
          data_sources: dataSources
        }),
      });

      if (!response.ok) {
        console.error("[AgentChatSection] createSession: response not ok", response.status);
        throw new Error("Failed to create session");
      }

      const session = await response.json();
      console.log("[AgentChatSection] Session created:", session);
      setCurrentSession(session);
      return session.id;
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create chat session");
      return null;
    }
  };

  const sendMessage = async () => {
    console.log("[AgentChatSection] sendMessage called", { inputValue, isLoading });
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    };
    console.log("[AgentChatSection] User message:", JSON.stringify(userMessage, null, 2));

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
    console.log("[AgentChatSection] Using sessionId:", sessionIdToUse);

    // Create AI message placeholder
    const aiMessage: AgentMessage = {
      id: (Date.now() + 1).toString(),
      type: "ai_agent",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
      thinking: "Initializing agents..."
    };
    console.log("[AgentChatSection] AI message placeholder:", JSON.stringify(aiMessage, null, 2));

    setMessages((prev) => [...prev, aiMessage]);

    try {
      abortControllerRef.current = new AbortController();
      console.log("[AgentChatSection] Sending fetch to /api/agents/chat", JSON.stringify({
        query: inputValue,
        session_id: sessionIdToUse,
        csv_id: csvIdState,
        pdf_id: pdfIdState,
        web_id: webIdState,
        stream: true,
      }, null, 2));
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": user?.id || "",
        },
        body: JSON.stringify({
          query: inputValue,
          session_id: sessionIdToUse,
          csv_id: csvIdState,
          pdf_id: pdfIdState,
          web_id: webIdState,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        console.error("[AgentChatSection] Response not ok:", response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error("[AgentChatSection] No response body");
        throw new Error("No response body");
      }

      let fullContent = "";
      let sources: SourceInfo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        console.log("[AgentChatSection] Received chunk:", chunk);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            console.log("[AgentChatSection] Streaming line data:", data);
            if (data === "[DONE]") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessage.id
                    ? { ...msg, isStreaming: false, thinking: undefined }
                    : msg
                )
              );
              console.log("[AgentChatSection] Stream done.");
              continue;
            }

            try {
              const parsed: StreamChunk = JSON.parse(data);
              console.log("[AgentChatSection] Parsed stream chunk:", JSON.stringify(parsed, null, 2));
              if (parsed.sources) {
                sources = parsed.sources;
                console.log("[AgentChatSection] Updating sources:", JSON.stringify(sources, null, 2));
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessage.id ? { ...msg, sources } : msg
                  )
                );
              }

              if (parsed.thinking) {
                console.log("[AgentChatSection] Agent thinking:", parsed.thinking);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessage.id ? { ...msg, thinking: parsed.thinking } : msg
                  )
                );
              }

              if (parsed.content) {
                fullContent += parsed.content;
                console.log("[AgentChatSection] Streaming content:", fullContent);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessage.id
                      ? { ...msg, content: fullContent }
                      : msg
                  )
                );
              }

              if (parsed.error) {
                console.error("[AgentChatSection] Stream error:", parsed.error);
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              console.error("[AgentChatSection] Error parsing chunk:", parseError, data);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[AgentChatSection] Request was aborted");
      } else {
        console.error("[AgentChatSection] Error sending message:", error);
        toast.error("Failed to send message. Please try again.");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessage.id
              ? {
                  ...msg,
                  content: "Sorry, I encountered an error. Please try again.",
                  isStreaming: false,
                  thinking: undefined
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      console.log("[AgentChatSection] sendMessage finished");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getAgentIcon = (type?: string) => {
    switch (type) {
      case "data_analyst":
        return <Badge variant="secondary"><Brain className="w-3 h-3 mr-1" /> Data Analyst</Badge>;
      case "document_expert":
        return <Badge variant="secondary"><Bot className="w-3 h-3 mr-1" /> Document Expert</Badge>;
      case "web_research":
        return <Badge variant="secondary"><ExternalLink className="w-3 h-3 mr-1" /> Web Researcher</Badge>;
      case "coordinator":
        return <Badge variant="secondary"><Users className="w-3 h-3 mr-1" /> Coordinator</Badge>;
      default:
        return <Badge variant="secondary"><Zap className="w-3 h-3 mr-1" /> AI Agent</Badge>;
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

  // CSV Upload Handler
// CSV Upload Handler fix inside your AgentChatSection component

const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploading(true);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const res = await fetch(`${backendUrl}/api/csv/upload-csv`, {
      method: "POST",
      headers: {
        "user-id": user?.id || "",
        // DO NOT set Content-Type header for FormData!
      },
      body: formData,
    });

    if (!res.ok) {
      const errorMessage = await res.text();
      throw new Error(errorMessage || "CSV upload failed");
    }

    const data = await res.json();

    // Extract csv ID from multiple possible response paths
    const newCsvId = data.data?.id || data.csv_id || data.id || null;

    if (!newCsvId) throw new Error("Failed to get CSV ID from upload response");

    setCsvIdState(newCsvId);
    toast.success("CSV uploaded successfully!");
  } catch (err) {
    console.error("CSV upload error:", err);
    toast.error(`CSV upload failed: ${(err as Error).message}`);
  } finally {
    setUploading(false);
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
      toast.success("PDF uploaded!");
    } catch (err) {
      toast.error("PDF upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Web URL Handler
  const handleWebUrlSubmit = async () => {
    if (!webUrl.trim()) return;
    setUploading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/web/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-id": user?.id || "" },
        body: JSON.stringify({ url: webUrl }),
      });
      if (!res.ok) throw new Error("Web scrape failed");
      const data = await res.json();
      setWebIdState(data.web_id || data.id || data.uuid);
      toast.success("Web content added!");
      setWebUrl("");
    } catch (err) {
      toast.error("Web scrape failed");
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
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white drop-shadow">AutoGen Agents</h2>
            <p className="text-sm text-gray-400">
              {agentStatus?.status === "active" 
                ? `${agentStatus.available_agents?.length || 0} agents ready`
                : "Initializing agents..."
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
      {(csvIdState || pdfIdState || webIdState) && (
        <div className="p-3 bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-800">
          <div className="flex items-center space-x-2 text-sm text-blue-200">
            <Bot className="w-4 h-4" />
            <span>Data Sources:</span>
            {csvIdState && <Badge variant="outline" className="bg-blue-900 text-blue-200 border-none">CSV Data</Badge>}
            {pdfIdState && <Badge variant="outline" className="bg-purple-900 text-purple-200 border-none">PDF Document</Badge>}
            {webIdState && <Badge variant="outline" className="bg-green-900 text-green-200 border-none">Web Content</Badge>}
          </div>
        </div>
      )}

      {/* Data Source Uploads */}
      <div className="border-b border-gray-800 p-4 bg-gray-900/80">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-6 space-y-2 md:space-y-0 mb-4">
          {/* CSV Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">CSV Data</label>
            <label className="inline-block px-3 py-1 bg-blue-700 text-white rounded cursor-pointer hover:bg-blue-800 transition shadow-lg">
              Upload CSV
              <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={uploading} className="hidden" />
            </label>
            {csvIdState && <Badge variant="outline" className="ml-2 bg-green-700 text-white border-none">CSV Ready</Badge>}
          </div>
          {/* PDF Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">PDF Document</label>
            <label className="inline-block px-3 py-1 bg-purple-700 text-white rounded cursor-pointer hover:bg-purple-800 transition shadow-lg">
              Upload PDF
              <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploading} className="hidden" />
            </label>
            {pdfIdState && <Badge variant="outline" className="ml-2 bg-green-700 text-white border-none">PDF Ready</Badge>}
          </div>
          {/* Web URL */}
          <div className="flex items-center space-x-2">
            <label className="block text-xs font-medium text-gray-400 mb-1">Web URL</label>
            <Input
              value={webUrl}
              onChange={e => setWebUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-48 bg-gray-800 text-white border-gray-600"
              disabled={uploading}
            />
            <Button size="sm" onClick={handleWebUrlSubmit} disabled={uploading || !webUrl.trim()} className="bg-blue-700 hover:bg-blue-800 shadow-lg">
              Add
            </Button>
            {webIdState && <Badge variant="outline" className="ml-2 bg-green-700 text-white border-none">Web Ready</Badge>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="mb-4 p-3 bg-gradient-to-r from-purple-700 to-blue-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Welcome to AutoGen Agents!
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Ask questions and our specialized AI agents will collaborate to provide comprehensive answers.
              {(csvIdState || pdfIdState || webIdState) && " Your data sources are ready for analysis."}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.type === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.type === "ai_agent" && (
              <div className="p-2 bg-gradient-to-r from-purple-700 to-blue-700 rounded-lg shrink-0 shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-xl p-4 shadow-lg ${
                message.type === "user"
                  ? "bg-blue-700 text-white ml-auto"
                  : "bg-gray-900 text-gray-100 border border-gray-800"
              }`}
            >
              {message.type === "ai_agent" && message.agentType && (
                <div className="mb-2">
                  {getAgentIcon(message.agentType)}
                </div>
              )}

              {message.thinking && (
                <div className="mb-2 p-2 bg-blue-900 rounded text-sm text-blue-200 flex items-center">
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  {message.thinking}
                </div>
              )}

              {message.isStreaming && !message.content && !message.thinking && (
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4 rounded-full bg-gray-800" />
                  <Skeleton className="h-4 w-20 bg-gray-800" />
                  <Skeleton className="h-4 w-16 bg-gray-800" />
                </div>
              )}

              {message.content && (
                <div className="whitespace-pre-wrap">
                  {message.content}
                </div>
              )}

              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs font-medium text-gray-400 mb-2">Sources:</p>
                  <div className="space-y-2">
                    {message.sources.map((source, index) => (
                      <div
                        key={index}
                        className="bg-gray-900 p-2 rounded border border-gray-800 text-xs text-gray-200 shadow"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-blue-200">
                            {source.title}
                          </span>
                          <span className="text-blue-400">
                            {(source.relevance_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-gray-400 mt-1">
                          {source.content_preview}
                        </p>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline flex items-center mt-1"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {message.type === "ai_agent" && message.content && (
                <div className="flex items-center mt-2 space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(message.content)}
                    className="h-6 px-2 text-xs text-blue-400 hover:text-blue-600"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {message.type === "user" && (
              <div className="p-2 bg-gray-800 rounded-lg shrink-0 shadow">
                <User className="w-5 h-5 text-blue-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4 bg-gray-900/80">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask the AI agents anything..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-gray-100 border-gray-700 placeholder-gray-500"
          />
          {isLoading ? (
            <Button onClick={stopGeneration} variant="destructive" size="sm" className="bg-red-700 hover:bg-red-800 text-white shadow-lg">
              Stop
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
              className="bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-800 hover:to-blue-800 text-white shadow-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        {agentStatus?.status !== "active" && (
          <p className="text-xs text-amber-400 mt-2">
            ⚠️ Agent system is initializing. Responses may be delayed.
          </p>
        )}
      </div>
    </div>
  );
}


