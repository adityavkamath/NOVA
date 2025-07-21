"use client";

import type React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { GripVertical } from "lucide-react";
import PdfViewer from "@/components/PDFviewer";
import ChatSection from "@/components/ChatSection";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface PdfChatPageProps {
  className?: string;
}

export default function PdfChatPage({ className = "" }: PdfChatPageProps) {
  const [leftWidth, setLeftWidth] = useState(40);
  const [isResizing, setIsResizing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [sessionId, setSessionId] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();

  const fetchPdfDetails = async () => {
    try {
      const userId = user?.id;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/pdf/${id}`,
        {
          headers: {
            "user-id": userId,
          },
        }
      );
      const { public_url, filename } = response.data;

      setFileName(filename);
      setPdfUrl(public_url);
      
      // Get session ID from URL params
      const urlSessionId = searchParams.get('sessionId');
      if (urlSessionId) {
        setSessionId(urlSessionId);
      }

      toast.success("PDF details loaded successfully!");
    } catch (error) {
      console.error("Error fetching PDF details:", error);
      toast.error("Failed to load PDF details. Please try again.");
    }
  };

  useEffect(() => {
    if (isLoaded && user?.id && id) {
      fetchPdfDetails();
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
        {pdfUrl && fileName ? (
          <div style={{ width: `${leftWidth}%` }} className="h-full">
            <PdfViewer pdfUrl={pdfUrl} fileName={fileName} />
          </div>
        ) : (
          <div style={{ width: `${leftWidth}%` }} className="flex items-center justify-center h-full">
            <p className="text-gray-500">PDF not yet loaded...</p>
          </div>
        )}

        {/* Resizer */}
        <div
          className={`w-1 bg-black hover:bg-blue-500 cursor-col-resize transition-colors duration-200 relative flex items-center justify-center ${
            isResizing ? "bg-gradient-to-b from-blue-600 to-violet-600" : ""
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -inset-x-1 flex items-center justify-center">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Chat Section */}
        <div style={{ width: `${100 - leftWidth}%` }} className="h-full">
          <ChatSection 
            fileName={fileName} 
            sessionId={sessionId}
            pdfId={id}
          />
        </div>
      </div>
    </div>
  );
}