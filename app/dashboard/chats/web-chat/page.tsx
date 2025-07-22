"use client";

import type React from "react";
import WebScraping from "@/components/WebScraping";

export default function WebChatMainPage() {
  return (
    <div className="h-screen w-full bg-black text-white flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Web Content Chat
          </h1>
          <p className="text-gray-400 text-lg">
            Enter any URL to scrape its content and start chatting with it
          </p>
        </div>
        
        <WebScraping className="w-full" />
      </div>
    </div>
  );
}
