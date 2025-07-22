"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, Globe, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface WebViewerProps {
  webUrl: string;
  webData: {
    id: string;
    url: string;
    title: string;
    content: string;
    meta_description?: string;
    word_count: number;
    embedding_status: string;
    created_at: string;
  };
  className?: string;
}

export default function WebViewer({ webUrl, webData, className = "" }: WebViewerProps) {
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Ready for chat';
      case 'pending':
        return 'Processing...';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Unknown status';
    }
  };

  if (isLoading) {
    return (
      <div className={`h-full bg-black flex flex-col ${className}`}>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-3/4 bg-gray-200/10" />
          <Skeleton className="h-4 w-1/2 bg-gray-200/10" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full bg-gray-200/10" />
            <Skeleton className="h-4 w-full bg-gray-200/10" />
            <Skeleton className="h-4 w-3/4 bg-gray-200/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-black flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{webData.title}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <ExternalLink className="h-4 w-4 text-gray-400" />
                <a 
                  href={webData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate max-w-md"
                >
                  {webData.url}
                </a>
              </div>
            </div>
          </div>
          <Button
            onClick={() => window.open(webData.url, '_blank')}
            variant="outline"
            size="sm"
            className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Visit Site
          </Button>
        </div>

        {/* Meta Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">
              {webData.word_count.toLocaleString()} words
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">
              {formatDate(webData.created_at)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(webData.embedding_status) === 'text-green-400' ? 'bg-green-400' : getStatusColor(webData.embedding_status) === 'text-yellow-400' ? 'bg-yellow-400' : 'bg-red-400'}`} />
            <span className={getStatusColor(webData.embedding_status)}>
              {getStatusText(webData.embedding_status)}
            </span>
          </div>
        </div>

        {/* Meta Description */}
        {webData.meta_description && (
          <div className="mt-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
            <p className="text-sm text-gray-300 italic">
              {webData.meta_description}
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="prose prose-invert max-w-none">
              <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                {webData.content}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
