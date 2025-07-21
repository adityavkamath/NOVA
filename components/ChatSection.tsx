"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton, useUser } from "@clerk/nextjs";
import { toast } from "sonner";

interface SourceInfo {
  title: string;
  content_preview: string;
  page: number;
  relevance_score: number;
}

interface Message {
  id: string;
  type: "user" | "ai_agent";
  content: string;
  timestamp: Date;
  sources?: SourceInfo[];
  isStreaming?: boolean;
  isLoading?: boolean;
}

interface StreamChunk {
  content?: string;
  sources?: SourceInfo[];
}

interface ApiMessage {
  id: string;
  role: string;
  message: string;
  timestamp: string;
  sources?: string;
}

interface ApiResponse {
  success: boolean;
  data: ApiMessage[];
}

interface CodePart {
  type: "code";
  language: string;
  content: string;
  raw: string;
}

interface HeaderPart {
  type: "header";
  level: number;
  content: string;
}

interface ListPart {
  type: "numbered-list" | "bullet-list";
  content: string;
}

interface TextPart {
  type: "text";
  content: string;
}

type MessagePart = CodePart | HeaderPart | ListPart | TextPart;

interface MessageFormatterProps {
  message: string;
  isStreaming?: boolean;
}

// Component to format the message from the AI agent
const MessageFormatter: React.FC<MessageFormatterProps> = ({
  message,
  isStreaming = false,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (
    text: string,
    index: number
  ): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const formatMessage = (text: string): MessagePart[] => {
    if (!text) return [];

    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    const parts: MessagePart[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        parts.push(...parseNonCodeText(beforeText));
      }

      parts.push({
        type: "code",
        language: match[1] || "text",
        content: match[2].trim(),
        raw: match[0],
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(...parseNonCodeText(remainingText));
    }

    return parts;
  };

  const parseNonCodeText = (text: string): MessagePart[] => {
    if (!text.trim()) return [];

    const parts: MessagePart[] = [];
    const lines = text.split("\n");
    let currentSection = "";
    let currentType: MessagePart["type"] = "text";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^#{1,6}\s/)) {
        if (currentSection.trim()) {
          parts.push({
            type: currentType,
            content: currentSection.trim(),
          } as MessagePart);
          currentSection = "";
        }
        const level = (line.match(/^#{1,6}/) as RegExpMatchArray)[0].length;
        parts.push({
          type: "header",
          level: level,
          content: line.replace(/^#{1,6}\s/, ""),
        });
        currentType = "text";
      } else if (line.match(/^\d+\.\s/)) {
        if (currentSection.trim() && currentType !== "numbered-list") {
          parts.push({
            type: currentType,
            content: currentSection.trim(),
          } as MessagePart);
          currentSection = "";
        }
        currentSection += line + "\n";
        currentType = "numbered-list";
      } else if (line.match(/^[-*•]\s/) || line.match(/^\s*[-*•]\s/)) {
        if (currentSection.trim() && currentType !== "bullet-list") {
          parts.push({
            type: currentType,
            content: currentSection.trim(),
          } as MessagePart);
          currentSection = "";
        }
        currentSection += line + "\n";
        currentType = "bullet-list";
      } else if (line.match(/\*\*(.*?)\*\*/)) {
        if (currentSection.trim() && currentType !== "text") {
          parts.push({
            type: currentType,
            content: currentSection.trim(),
          } as MessagePart);
          currentSection = "";
        }
        currentSection += line + "\n";
        currentType = "text";
      } else {
        if (currentType !== "text" && currentSection.trim()) {
          parts.push({
            type: currentType,
            content: currentSection.trim(),
          } as MessagePart);
          currentSection = "";
          currentType = "text";
        }
        currentSection += line + "\n";
      }
    }

    if (currentSection.trim()) {
      parts.push({
        type: currentType,
        content: currentSection.trim(),
      } as MessagePart);
    }

    return parts;
  };

  const formatBoldText = (text: string): (string | React.ReactNode)[] => {
    return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-blue-200">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const formatInlineCode = (text: string): (string | React.ReactNode)[] => {
    return text.split(/(`[^`]+`)/).map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={index}
            className="bg-gray-200/20 text-blue-300 px-2 py-1 rounded text-sm font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return formatBoldText(part);
    });
  };

  const renderPart = (part: MessagePart, index: number): React.ReactNode => {
    switch (part.type) {
      case "code":
        return (
          <div key={index} className="my-3 relative">
            <div className="flex items-center justify-between bg-gray-200/10 text-gray-300 px-3 py-2 rounded-t-lg border border-gray-600">
              <span className="text-xs font-medium">
                {part.language || "Code"}
              </span>
              <button
                onClick={() => copyToClipboard(part.content, index)}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs"
              >
                {copiedIndex === index ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}
                <span>{copiedIndex === index ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <pre className="bg-gray-200/10 text-gray-100 p-3 rounded-b-lg overflow-x-auto border-l border-r border-b border-gray-600">
              <code className="font-mono text-xs leading-relaxed">
                {part.content}
              </code>
            </pre>
          </div>
        );

      case "header":
        const HeaderTag = `h${Math.min(part.level + 1, 6)}` as
          | "h1"
          | "h2"
          | "h3"
          | "h4"
          | "h5"
          | "h6";
        const headerClasses: Record<number, string> = {
          1: "text-lg font-bold text-white mt-4 mb-3",
          2: "text-base font-bold text-white mt-4 mb-2",
          3: "text-sm font-semibold text-white mt-3 mb-2",
          4: "text-sm font-semibold text-gray-200 mt-3 mb-2",
          5: "text-xs font-semibold text-gray-200 mt-2 mb-1",
          6: "text-xs font-medium text-gray-200 mt-2 mb-1",
        };

        return (
          <HeaderTag
            key={index}
            className={headerClasses[part.level] || headerClasses[6]}
          >
            {part.content}
          </HeaderTag>
        );

      case "numbered-list":
        const numberedItems = part.content
          .split("\n")
          .filter((line) => line.trim());
        return (
          <ol
            key={index}
            className="list-decimal list-inside space-y-1 my-3 ml-3"
          >
            {numberedItems.map((item, itemIndex) => (
              <li key={itemIndex} className="text-gray-300 text-sm">
                {formatInlineCode(item.replace(/^\d+\.\s/, ""))}
              </li>
            ))}
          </ol>
        );

      case "bullet-list":
        const bulletItems = part.content
          .split("\n")
          .filter((line) => line.trim());
        return (
          <ul key={index} className="list-disc list-inside space-y-1 my-3 ml-3">
            {bulletItems.map((item, itemIndex) => (
              <li key={itemIndex} className="text-gray-300 text-sm">
                {formatInlineCode(item.replace(/^\s*[-*•]\s/, ""))}
              </li>
            ))}
          </ul>
        );

      case "text":
      default:
        return (
          <div key={index} className="my-1">
            {part.content.split("\n").map((line, lineIndex) => (
              <p
                key={lineIndex}
                className={`text-gray-300 text-sm leading-relaxed ${
                  line.trim() ? "mb-1" : ""
                }`}
              >
                {line.trim() ? formatInlineCode(line) : ""}
              </p>
            ))}
          </div>
        );
    }
  };

  const formattedParts = formatMessage(message);

  return (
    <div className="prose-sm max-w-none">
      {formattedParts.map((part, index) => renderPart(part, index))}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-1 rounded-sm"></span>
      )}
    </div>
  );
};

interface Message {
  id: string;
  type: "user" | "ai_agent";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isStreaming?: boolean;
}

interface ChatSectionProps {
  fileName: string;
  sessionId: string;
  pdfId: string;
  className?: string;
}

interface StreamChunk {
  content?: string;
  sources?: SourceInfo[];
}

// Sources Display Component
const SourcesDisplay: React.FC<{ sources: SourceInfo[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-gray-800/20 rounded-lg border border-gray-600/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <ExternalLink className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-300">Sources Referenced</span>
      </div>
      <div className="grid gap-3">
        {sources.slice(0, 5).map((source, index) => (
          <div 
            key={index} 
            className="p-3 bg-gray-700/10 rounded-md border border-gray-600/10 hover:bg-gray-700/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-200 truncate">{source.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  {Math.round(source.relevance_score * 100)}% match
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
              {source.content_preview}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Chat Loading Skeleton Component
const ChatLoadingSkeleton = () => {
  return (
    <div className="space-y-4">
      {/* AI Message Skeleton */}
      <div className="flex justify-start">
        <div className="flex max-w-[85%] flex-row gap-x-3 items-start">
          <Skeleton className="w-8 h-8 rounded-full bg-gray-200/10" />
          <div className="rounded-2xl px-4 py-3 bg-gray-200/10 border border-gray-600/30">
            <Skeleton className="h-4 w-64 mb-2 bg-gray-200/10" />
            <Skeleton className="h-4 w-48 mb-2 bg-gray-200/10" />
            <Skeleton className="h-4 w-32 bg-gray-200/10" />
          </div>
        </div>
      </div>

      {/* User Message Skeleton */}
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-row-reverse gap-x-3 items-start">
          <Skeleton className="w-8 h-8 rounded-full bg-gray-200/10" />
          <div className="rounded-2xl px-4 py-3 bg-gray-200/10">
            <Skeleton className="h-4 w-48 mb-2 bg-gray-200/10" />
            <Skeleton className="h-4 w-36 bg-gray-200/10" />
          </div>
        </div>
      </div>

      {/* AI Message Skeleton */}
      <div className="flex justify-start">
        <div className="flex max-w-[85%] flex-row gap-x-3 items-start">
          <Skeleton className="w-8 h-8 rounded-full bg-gray-200/10" />
          <div className="rounded-2xl px-4 py-3 bg-gray-200/10 border border-gray-600/30">
            <Skeleton className="h-4 w-72 mb-2 bg-gray-200/10" />
            <Skeleton className="h-4 w-56 mb-2 bg-gray-200/10" />
            <Skeleton className="h-4 w-44 mb-2 bg-gray-200/10" />
            <Skeleton className="h-4 w-28 bg-gray-200/10" />
          </div>
        </div>
      </div>

      {/* User Message Skeleton */}
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-row-reverse gap-x-3 items-start">
          <Skeleton className="w-8 h-8 rounded-full bg-gray-200/10" />
          <div className="rounded-2xl px-4 py-3 bg-gray-200/10">
            <Skeleton className="h-4 w-40 bg-gray-200/10" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ChatSection({
  fileName,
  sessionId,
  pdfId,
  className = "",
}: ChatSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { user, isSignedIn } = useUser();

  // Enhanced auto-scroll function
  const scrollToBottom = (smooth: boolean = true): void => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: smooth ? "smooth" : "auto",
        block: "end"
      });
    }, 100);
  };

  // Auto-scroll when messages change or when typing
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (streamingMessageId) {
      scrollToBottom();
    }
  }, [streamingMessageId]);

  useEffect(() => {
    const loadMessages = async (): Promise<void> => {
      if (!sessionId || !user?.id) return;

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/${sessionId}/messages`,
          {
            headers: {
              "user-id": user.id,
            },
          }
        );

        if (response.ok) {
          const data: ApiResponse = await response.json();
          if (data.success) {
            const loadedMessages: Message[] = data.data.map(
              (msg: ApiMessage) => ({
                id: msg.id,
                type: msg.role === "user" ? "user" : "ai_agent",
                content: msg.message,
                timestamp: new Date(msg.timestamp),
                sources: msg.sources ? JSON.parse(msg.sources) : undefined,
              })
            );

            setMessages(loadedMessages);
          }
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        setMessages([
          {
            id: "welcome",
            type: "ai_agent",
            content: `Hello! I'm ready to help you analyze "${fileName}". You can ask me questions about the content, request summaries, or explore specific topics within the document.`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [sessionId, user?.id, fileName]);

  const handleSendMessage = async (): Promise<void> => {
    if (!inputMessage.trim() || !sessionId || !user?.id) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentMessage = inputMessage;
    setInputMessage("");
    setIsTyping(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setStreamingMessageId(assistantMessageId);

    // Add initial empty AI message for streaming
    const initialAIMessage: Message = {
      id: assistantMessageId,
      type: "ai_agent",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, initialAIMessage]);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/send-message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "user-id": user.id,
          },
          body: JSON.stringify({
            session_id: sessionId,
            message: currentMessage,
            pdf_id: pdfId,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      let assistantResponse = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsTyping(false);
              setStreamingMessageId(null);
              // Mark streaming as complete
              setMessages((prev) => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage.id === assistantMessageId) {
                  updated[updated.length - 1] = {
                    ...lastMessage,
                    isStreaming: false,
                  };
                }
                return updated;
              });
              return;
            }

            try {
              const parsed: StreamChunk = JSON.parse(data);
              
              // Handle sources
              if (parsed.sources) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.id === assistantMessageId) {
                    updated[updated.length - 1] = {
                      ...lastMessage,
                      sources: parsed.sources,
                    };
                  }
                  return updated;
                });
              }
              
              // Handle content streaming
              if (parsed.content) {
                assistantResponse += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.id === assistantMessageId) {
                    updated[updated.length - 1] = {
                      ...lastMessage,
                      content: assistantResponse,
                    };
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Ignore JSON parse errors for malformed chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
      setMessages((prev) => {
        const withoutStreaming = prev.slice(0, -1);
        return [
          ...withoutStreaming,
          {
            id: assistantMessageId,
            type: "ai_agent",
            content:
              "I apologize, but I'm having trouble processing your request right now. Please try again.",
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsTyping(false);
      setStreamingMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className={`h-full bg-black flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/30">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-gray-200/10" />
            <div>
              <Skeleton className="h-4 w-20 mb-1 bg-gray-200/10" />
              <Skeleton className="h-3 w-32 bg-gray-200/10" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full bg-gray-200/10" />
        </div>

        {/* Loading Messages */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{
            maxHeight: "calc(100vh - 200px)",
          }}
        >
          <ChatLoadingSkeleton />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-600/30 bg-gray-900/20">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <Skeleton className="h-12 w-full rounded-xl bg-gray-200/10" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl bg-gray-200/10" />
          </div>
          <Skeleton className="h-4 w-64 mt-2 bg-gray-200/10" />
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-black flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">AI Agent</h2>
            <p className="text-xs text-gray-400">Analyzing {fileName}</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 bg-gray-200/10 px-3 py-1 rounded-full">
          {messages.length} messages
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{
          maxHeight: "calc(100vh - 200px)",
          scrollbarWidth: "thin",
          scrollbarColor: "#374151 transparent",
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.type === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex max-w-[85%] ${
                message.type === "user"
                  ? "flex-row-reverse gap-x-3"
                  : "flex-row gap-x-3"
              } items-start`}
            >
              <div
                className={`${
                  !isSignedIn ? "w-8 h-8" : ""
                } rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === "user"
                    ? "bg-gradient-to-br from-blue-500 to-violet-600"
                    : "border-gray-800/10 bg-gray-200/10 ring-1 ring-white/20"
                }`}
              >
                {message.type === "user" ? (
                  isSignedIn ? (
                    <UserButton />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )
                ) : (
                  <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gray-500/10 shadow-md">
                    <p className="font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-gray-500 to-white">
                      N
                    </p>
                    {/* <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 opacity-50 blur-sm">
                    </div> */}
                  </div>
                )}
              </div>

              <div
                className={`rounded-2xl px-4 py-3 max-w-full ${
                  message.type === "user"
                    ? "bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg"
                    : "bg-gray-200/10 text-white border border-gray-600/30 shadow-lg backdrop-blur-sm"
                }`}
              >
                {message.isLoading ? (
                  <div className="flex items-center space-x-2 py-1">
                    <span className="text-sm text-gray-400">Analyzing</span>
                    <span className="flex space-x-1">
                      <span className="w-1.5 h-1.5 bg-gradient-to-br from-blue-600 to-violet-800 rounded-full dot-bounce" />
                      <span className="w-1.5 h-1.5 bg-gradient-to-br from-blue-600 to-violet-800 rounded-full dot-bounce" />
                      <span className="w-1.5 h-1.5 bg-gradient-to-br from-blue-600 to-violet-800 rounded-full dot-bounce" />
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="break-words">
                      {message.type === "ai_agent" ? (
                        <>
                          <MessageFormatter
                            message={message.content}
                            isStreaming={message.isStreaming || false}
                          />
                          {message.sources && (
                            <SourcesDisplay sources={message.sources} />
                          )}
                        </>
                      ) : (
                        <div
                          className="text-sm leading-relaxed break-words whitespace-pre-wrap"
                          style={{
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {message.content}
                        </div>
                      )}
                    </div>
                    <div
                      className={`text-xs mt-2 ${
                        message.type === "user"
                          ? "text-white/70"
                          : "text-gray-400"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-600/30 bg-gray-900/20">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the PDF..."
              className="bg-gray-200/10 border-gray-600/30 px-4 py-3 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl min-h-[48px] resize-none backdrop-blur-sm"
              disabled={isTyping}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-gradient-to-r from-blue-500 to-violet-600 text-white hover:from-blue-600 hover:to-violet-700 px-4 py-3 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="text-xs text-gray-400 mt-2 px-1">
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>

      <style jsx>{`
        .dot-bounce {
          animation: dot-bounce 1.4s infinite ease-in-out both;
        }
        .dot-bounce:nth-child(1) {
          animation-delay: -0.32s;
        }
        .dot-bounce:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes dot-bounce {
          0%,
          80%,
          100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
