"use client";

import type React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { GripVertical } from "lucide-react";
import WebViewer from "@/components/WebViewer"; 
import ChatSection from "@/components/ChatSection";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

interface WebChatDynamicPageProps {
  className?: string;
}

export default function WebChatDynamicPage({ className = "" }: WebChatDynamicPageProps) {
  const [leftWidth, setLeftWidth] = useState(40);
  const [isResizing, setIsResizing] = useState(false);
  const [webData, setWebData] = useState<any>(null);
  const [sessionId, setSessionId] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();

  const fetchWebDetails = async () => {
    try {
      const userId = user?.id;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/web/${id}`,
        {
          headers: {
            "user-id": userId,
          },
        }
      );

      if (response.data.success) {
        setWebData(response.data.data);
        
        // Get session ID from URL params first
        const urlSessionId = searchParams.get('sessionId');
        console.log("DEBUG: Web Chat Page - id:", id, "urlSessionId:", urlSessionId);
        
        if (urlSessionId && urlSessionId !== "undefined") {
          setSessionId(urlSessionId);
          console.log("DEBUG: Web Chat Page - sessionId set from URL:", urlSessionId);
        } else {
          console.log("DEBUG: Web Chat Page - No valid sessionId in URL, checking for existing session or creating new one");
          // Check if there's an existing session for this web page
          await findOrCreateSession(response.data.data.title);
        }

        toast.success("Web page details loaded successfully!");
      }
    } catch (error) {
      console.error("Error fetching web page details:", error);
      toast.error("Failed to load web page details. Please try again.");
    }
  };

  const findOrCreateSession = async (webTitle: string) => {
    if (!user?.id || !id) {
      console.log("DEBUG: Cannot find/create session - missing data:", { userId: user?.id, webId: id });
      return;
    }

    try {
      // First, try to find an existing session for this web page
      console.log("DEBUG: Looking for existing session for web page:", id);
      const existingSessionResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/sessions`,
        {
          headers: {
            "user-id": user.id,
          },
          params: {
            feature_type: "web",
            source_id: id
          }
        }
      );

      if (existingSessionResponse.data.success && existingSessionResponse.data.data.length > 0) {
        // Use the most recent existing session
        const mostRecentSession = existingSessionResponse.data.data[0];
        setSessionId(mostRecentSession.id);
        console.log("DEBUG: Found existing session:", mostRecentSession.id);
        return;
      }
    } catch (error) {
      console.log("DEBUG: No existing session found or error fetching sessions:", error);
    }

    // If no existing session, create a new one
    await createChatSession(webTitle);
  };

  const createChatSession = async (webTitle: string) => {
    if (!user?.id || !id) {
      console.log("DEBUG: Cannot create session - missing data:", { userId: user?.id, webId: id });
      return;
    }

    setIsCreatingSession(true);
    try {
      console.log("DEBUG: Creating new chat session for web page:", id);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/create-session`,
        {
          user_id: user.id,
          feature_type: "web",
          source_id: id,
          title: `Web Chat - ${webTitle}`,
        },
        {
          headers: {
            "user-id": user.id,
          },
        }
      );

      if (response.data.success) {
        const newSessionId = response.data.data.session_id;
        setSessionId(newSessionId);
        console.log("DEBUG: Web Chat Page - Created new session:", newSessionId);
        toast.success("Chat session created!");
      }
    } catch (error: any) {
      console.error("Session creation error:", error);
      toast.error("Failed to create chat session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  useEffect(() => {
    console.log("DEBUG: Web Chat Page useEffect - isLoaded:", isLoaded, "user?.id:", user?.id, "id:", id);
    if (isLoaded && user?.id && id) {
      fetchWebDetails();
    }
  }, [isLoaded, user?.id, id, searchParams]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      const constrainedWidth = Math.min(Math.max(newLeftWidth, 30), 70);
      setLeftWidth(constrainedWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`h-screen w-full bg-black text-white flex overflow-hidden ${className}`}
    >
      <div ref={containerRef} className="flex w-full h-full">
        {webData ? (
          <div style={{ width: `${leftWidth}%` }} className="h-full">
            <WebViewer webUrl={webData.url} webData={webData} />
          </div>
        ) : (
          <div style={{ width: `${leftWidth}%` }} className="flex items-center justify-center h-full">
            <p className="text-gray-500">Web content not yet loaded...</p>
          </div>
        )}

        {/* Resizer */}
        <div
          className={`w-1 bg-black hover:bg-purple-500 cursor-col-resize transition-colors duration-200 relative flex items-center justify-center ${
            isResizing ? "bg-gradient-to-b from-purple-600 to-blue-600" : ""
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -inset-x-1 flex items-center justify-center">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Chat Section */}
        <div style={{ width: `${100 - leftWidth}%` }} className="h-full">
          {sessionId && sessionId !== "undefined" && webData ? (
            <ChatSection 
              fileName={webData.title}
              sessionId={sessionId}
              webId={id}
            />
          ) : (
            <div className="h-full bg-black flex items-center justify-center">
              <div className="text-gray-400">
                {isCreatingSession ? "Creating chat session..." : 
                 !sessionId || sessionId === "undefined" ? "No valid chat session found..." : 
                 "Loading chat..."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}