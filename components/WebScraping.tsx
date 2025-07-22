"use client";

import React, { useState } from "react";
import { Globe, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";

interface WebScrapingProps {
  onWebScraped?: (webData: any) => void;
  className?: string;
}

interface ScrapedWeb {
  id: string;
  url: string;
  title: string;
  content_preview: string;
  word_count: number;
  embedding_status: string;
}

export default function WebScraping({ onWebScraped, className = "" }: WebScrapingProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedWeb, setScrapedWeb] = useState<ScrapedWeb | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  const { user } = useUser();
  const router = useRouter();

  const isValidUrl = (string: string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const handleScrapeUrl = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL (including http:// or https://)");
      return;
    }

    if (!user?.id) {
      toast.error("Please sign in to scrape URLs");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/web/scrape-url`,
        { url: url.trim() },
        {
          headers: {
            "user-id": user.id,
          },
        }
      );

      if (response.data.success) {
        const webData = response.data.data;
        setScrapedWeb(webData);
        onWebScraped?.(webData);
        toast.success(response.data.message);
      }
    } catch (error: any) {
      console.error("Web scraping error:", error);
      
      let errorMessage = "Failed to scrape the URL";
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 400) {
        errorMessage = "Could not access the URL. Please check the URL and try again.";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error while processing the URL. Please try again.";
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = "Network error. Please check your connection.";
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!scrapedWeb || !user?.id) return;

    setIsCreatingSession(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/create-session`,
        {
          user_id: user.id,
          feature_type: "web",
          source_id: scrapedWeb.id,
          title: `Web Chat - ${scrapedWeb.title}`,
        },
        {
          headers: {
            "user-id": user.id,
          },
        }
      );

      if (response.data.success) {
        const sessionId = response.data.data.session_id;
        toast.success("Chat session created successfully!");
        router.push(`/dashboard/chats/web-chat/${scrapedWeb.id}?sessionId=${sessionId}`);
      }
    } catch (error: any) {
      console.error("Session creation error:", error);
      toast.error("Failed to create chat session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      handleScrapeUrl();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'pending':
        return <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Globe className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Ready to chat!';
      case 'pending':
        return 'Processing content...';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mx-auto">
          <Globe className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Web Content Chat</h1>
        <p className="text-gray-400">
          Enter any website URL to scrape its content and start chatting with it
        </p>
      </div>

      {/* URL Input */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-gray-400" />
            <label className="text-sm font-medium text-gray-300">Website URL</label>
          </div>
          
          <div className="flex space-x-3">
            <div className="flex-1">
              <Input
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleScrapeUrl}
              disabled={isLoading || !url.trim()}
              className="bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Scrape
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            💡 Tip: Works best with news articles, blog posts, and content-rich pages
          </div>
        </div>
      </div>

      {/* Scraped Content Preview */}
      {scrapedWeb && (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Scraped Content</h3>
            {getStatusIcon(scrapedWeb.embedding_status)}
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-white truncate">{scrapedWeb.title}</h4>
              <div className="flex items-center space-x-2 mt-1">
                <ExternalLink className="h-4 w-4 text-gray-400" />
                <a 
                  href={scrapedWeb.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate"
                >
                  {scrapedWeb.url}
                </a>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              📝 {scrapedWeb.word_count.toLocaleString()} words
            </div>

            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <p className="text-sm text-gray-300 line-clamp-3">
                {scrapedWeb.content_preview}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(scrapedWeb.embedding_status)}
                <span className="text-sm text-gray-400">
                  {getStatusText(scrapedWeb.embedding_status)}
                </span>
              </div>

              <Button
                onClick={handleStartChat}
                disabled={scrapedWeb.embedding_status !== 'completed' || isCreatingSession}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
              >
                {isCreatingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    💬 Start Chat
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Examples */}
      <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-800/50">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Example URLs you can try:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <button
            onClick={() => setUrl("https://news.ycombinator.com")}
            className="text-left text-blue-400 hover:text-blue-300 hover:underline"
          >
            🔥 Hacker News
          </button>
          <button
            onClick={() => setUrl("https://www.bbc.com/news")}
            className="text-left text-blue-400 hover:text-blue-300 hover:underline"
          >
            📰 BBC News
          </button>
          <button
            onClick={() => setUrl("https://techcrunch.com")}
            className="text-left text-blue-400 hover:text-blue-300 hover:underline"
          >
            🚀 TechCrunch
          </button>
          <button
            onClick={() => setUrl("https://medium.com")}
            className="text-left text-blue-400 hover:text-blue-300 hover:underline"
          >
            ✍️ Medium Articles
          </button>
        </div>
      </div>
    </div>
  );
}
