"use client";

export const dynamic = 'force-dynamic';

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

interface DetailedSource {
  title: string;
  url?: string;
  content_preview: string;
  source_platform: string;
  relevance_score: number;
}

interface SearchDoc {
  text: string;
  url: string;
  score: number;
  source: string;
  title: string;
}

interface SearchResponse {
  answer: string;
  docs: SearchDoc[];
  source: string;
  sources_used: string[];
  detailed_sources?: DetailedSource[];
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  docs?: SearchDoc[];
  sources_used?: string[];
  sources?: string; // JSON string from database
  detailed_sources?: DetailedSource[]; // Parsed detailed sources
  timestamp: Date;
}

interface SourceOption {
  value: string;
  label: string;
}

const MultipleSourcesChat = () => {
  const { user } = useUser();
  const [sessionIdFromParams, setSessionIdFromParams] = useState<string | null>(null);

  useEffect(() => {
    // Get search params on client side only
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setSessionIdFromParams(params.get('sessionId'));
    }
  }, []);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedSource, setSelectedSource] = useState("all");
  const [sources, setSources] = useState<SourceOption[]>([
    { value: "all", label: "All Sources" },
    { value: "reddit", label: "Reddit" },
    { value: "stackoverflow", label: "StackOverflow" },
    { value: "github", label: "GitHub" },
    { value: "devto", label: "Dev.to" },
    { value: "hackernews", label: "HackerNews" },
  ]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    // Only load chat history if we have a sessionIdFromParams from URL
    if (sessionIdFromParams && user?.id) {
      loadChatHistory();
    } else if (user?.id) {
      // If no sessionIdFromParams but user is available, create a new session immediately
      createNewSessionAndUpdateURL();
    }
  }, [sessionIdFromParams, user?.id]);

  const createNewSessionAndUpdateURL = async () => {
    if (!user?.id) return;
    
    try {
      const newSessionId = await createNewSession();
      if (newSessionId) {
        // Update URL with new sessionIdFromParams without page reload
        const newUrl = `${window.location.pathname}?sessionIdFromParams=${newSessionId}`;
        window.history.replaceState({}, '', newUrl);
      }
    } catch (error) {
      console.error("Error creating new session:", error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    if (!sessionIdFromParams || !user?.id) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/multi/sessions/${sessionIdFromParams}/messages`,
        {
          headers: {
            "user-id": user.id,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = [];
        
        // Convert database messages to UI messages format
        for (let i = 0; i < data.messages.length; i += 2) {
          const userMessage = data.messages[i];
          const aiMessage = data.messages[i + 1];
          
          if (userMessage && userMessage.role === 'user') {
            loadedMessages.push({
              id: userMessage.id,
              type: "user",
              content: userMessage.message,
              timestamp: new Date(userMessage.timestamp),
            });
          }
          
          if (aiMessage && aiMessage.role === 'ai_agent') {
            // Parse sources from database if available
            let sourcesUsed: string[] = [];
            let detailedSources: DetailedSource[] = [];
            
            if (aiMessage.sources) {
              try {
                const parsed = JSON.parse(aiMessage.sources);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  // Check if it's detailed sources (objects) or simple source names (strings)
                  if (typeof parsed[0] === 'object' && parsed[0].title) {
                    detailedSources = parsed;
                    sourcesUsed = [...new Set(parsed.map((s: DetailedSource) => s.source_platform))];
                  } else {
                    // Old format - just source names
                    sourcesUsed = parsed;
                  }
                }
              } catch (e) {
                console.warn("Failed to parse sources:", aiMessage.sources);
              }
            }
            
            loadedMessages.push({
              id: aiMessage.id,
              type: "assistant",
              content: aiMessage.message,
              sources_used: sourcesUsed,
              detailed_sources: detailedSources,
              // Note: docs won't be available from stored history, only sources_used
              timestamp: new Date(aiMessage.timestamp),
            });
          }
        }
        
        setMessages(loadedMessages);
        toast.success("Chat history loaded successfully!");
      } else {
        console.error("Failed to load chat history");
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchSources = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/multi/sources`,
        {
          headers: {
            "user-id": user?.id || "",
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.sources_with_labels) {
          setSources(data.sources_with_labels);
        }
      }
    } catch (error) {
      console.error("Error fetching sources:", error);
      toast.error("Failed to fetch available sources");
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      let currentSessionId = sessionIdFromParams;
      
      // If no sessionIdFromParams, create a new session first
      if (!currentSessionId) {
        const newSessionId = await createNewSession();
        if (newSessionId) {
          currentSessionId = newSessionId;
          // Update URL with new sessionIdFromParams
          window.history.replaceState({}, '', `${window.location.pathname}?sessionIdFromParams=${newSessionId}`);
        } else {
          throw new Error("Failed to create new session");
        }
      }

      // Now send the message with session storage
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/multi/send-message`,
        {
          method: "POST",
          headers: {
            "user-id": user?.id || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: currentSessionId,
            message: currentInput,
            source: selectedSource,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Update the user message with the ID from the database
      setMessages((prev) => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, id: data.user_message.id }
          : msg
      ));

      const assistantMessage: Message = {
        id: data.ai_message.id,
        type: "assistant",
        content: data.ai_message.message,
        docs: data.docs,
        sources_used: data.sources_used,
        detailed_sources: data.detailed_sources || [],
        timestamp: new Date(data.ai_message.timestamp),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to get response. Please try again.");
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "Sorry, I encountered an error while processing your question. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/multi/sessions`,
        {
          method: "POST",
          headers: {
            "user-id": user.id,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Multi-Source Chat",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("Error creating new session:", error);
      return null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getSourceColor = (source: string) => {
    const colors: { [key: string]: string } = {
      reddit: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      stackoverflow: "bg-orange-600/20 text-orange-400 border-orange-600/30",
      github: "bg-gray-500/20 text-gray-300 border-gray-500/30",
      devto: "bg-green-500/20 text-green-300 border-green-500/30",
      hackernews: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    };
    return colors[source] || "bg-blue-500/20 text-blue-300 border-blue-500/30";
  };

  const formatMessage = (content: string) => {
    // Format bold text
    const boldFormatted = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-blue-200">$1</strong>');
    
    // Format inline code
    const codeFormatted = boldFormatted.replace(/`([^`]+)`/g, '<code class="bg-gray-200/20 text-blue-300 px-2 py-1 rounded text-sm font-mono">$1</code>');
    
    return codeFormatted;
  };

  return (
    <div className="flex flex-col h-[90vh] max-w-6xl mx-auto p-6 bg-black/95 rounded-xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Multi-Source Python Assistant</h1>
          <p className="text-gray-400 text-sm">Ask questions and get answers from multiple Python sources</p>
        </div>
        
        {/* Source Selector */}
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-300">Source:</label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            title="Select data source for search"
          >
            {sources.map((source) => (
              <option key={source.value} value={source.value} className="bg-gray-900 text-white">
                {source.label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSources}
            className="text-gray-400 hover:text-white"
            title="Refresh sources"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
        <div className="space-y-6 custom-scrollbar">
          {isLoadingHistory && (
            <div className="text-center text-gray-400 py-8">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
              <p className="text-lg font-medium mb-2">Loading chat history...</p>
              <p className="text-sm">Please wait while we retrieve your previous messages.</p>
            </div>
          )}
          
          {!isLoadingHistory && messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Ready to help with Python questions!</p>
              <p className="text-sm">Ask anything about Python programming, frameworks, libraries, or best practices.</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex space-x-3 max-w-4xl ${message.type === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === "user" 
                    ? "bg-blue-600" 
                    : "bg-gradient-to-br from-violet-500 to-purple-600"
                }`}>
                  {message.type === "user" ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex-1 ${message.type === "user" ? "text-right" : ""}`}>
                  <div className={`inline-block p-4 rounded-xl ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 border border-white/10 text-gray-100"
                  }`}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(message.content),
                      }}
                      className="prose prose-invert max-w-none"
                    />
                  </div>

                  {/* Sources and Documents */}
                  {message.type === "assistant" && (
                    <div className="mt-4 space-y-3">
                      {/* Database Sources - Always show if available */}
                      {/* Database Sources - Always show if available */}
                      {(() => {
                        // Use detailed sources from database if available
                        const dbSources = message.detailed_sources || [];
                        
                        if (dbSources.length > 0) {
                          // Display detailed sources from database
                          return (
                            <div className="grid gap-2">
                              <h4 className="text-sm font-medium text-gray-300">Sources:</h4>
                              {dbSources.slice(0, 5).map((source: any, index: number) => (
                                <div
                                  key={index}
                                  className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <Badge className={`text-xs ${getSourceColor(source.source_platform || source.source || 'unknown')}`}>
                                          {source.source_platform || source.source || 'unknown'}
                                        </Badge>
                                        {source.relevance_score && (
                                          <span className="text-xs text-gray-400">
                                            Score: {source.relevance_score.toFixed(3)}
                                          </span>
                                        )}
                                      </div>
                                      <h5 className="text-sm font-medium text-white truncate mb-1">
                                        {source.title || "No title"}
                                      </h5>
                                      {source.content_preview && (
                                        <p className="text-xs text-gray-400 line-clamp-2">
                                          {source.content_preview.substring(0, 150)}...
                                        </p>
                                      )}
                                    </div>
                                    {source.url && source.url !== "N/A" && source.url.startsWith("http") && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 text-gray-400 hover:text-white ml-2"
                                        onClick={() => window.open(source.url, "_blank")}
                                        title="Open source"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Fallback Sources Used - Show if no database sources but sources_used exists */}
                      {(!message.sources || (message.sources && JSON.parse(message.sources || '[]').length === 0)) && 
                       message.sources_used && message.sources_used.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-gray-400">Sources used:</span>
                          {message.sources_used.map((source, index) => (
                            <Badge
                              key={index}
                              className={`text-xs ${getSourceColor(source)}`}
                            >
                              {source}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Document References - Only show if docs are available (new messages) */}
                      {message.docs && message.docs.length > 0 && (
                        <div className="grid gap-2">
                          <h4 className="text-sm font-medium text-gray-300">Live Sources:</h4>
                          {message.docs.slice(0, 5).map((doc, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Badge className={`text-xs ${getSourceColor(doc.source)}`}>
                                    {doc.source}
                                  </Badge>
                                  <span className="text-xs text-gray-400">
                                    Score: {(1 - doc.score).toFixed(3)}
                                  </span>
                                </div>
                                <h5 className="text-sm font-medium text-white truncate mb-1">
                                  {doc.title || "No title"}
                                </h5>
                                <p className="text-xs text-gray-400 line-clamp-2">
                                  {doc.text.substring(0, 150)}...
                                </p>
                              </div>
                              {doc.url && doc.url !== "N/A" && doc.url.startsWith("http") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1 text-gray-400 hover:text-white ml-2"
                                  onClick={() => window.open(doc.url, "_blank")}
                                  title="Open source"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    <span className="text-gray-300">Searching and analyzing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex space-x-4">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a Python-related question..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-blue-500/50 focus:ring-blue-500/50"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Selected source: <span className="text-blue-400">{sources.find(s => s.value === selectedSource)?.label}</span>
        </p>
      </div>
    </div>
  );
};

export default MultipleSourcesChat;
