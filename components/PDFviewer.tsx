"use client";

import { useState } from "react";
import { FileText, Loader } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PdfViewerProps {
  pdfUrl: string;
  fileName: string;
  className?: string;
}

export default function PdfViewer({
  pdfUrl,
  fileName,
  className = "",
}: PdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div
      className={`h-full bg-black text-white border-r border-white/10 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-sm font-medium text-white">
            {fileName}
          </h1>
        </div>
      </div>

      {/* PDF Display */}
      <div className="flex-1 bg-black relative flex justify-center items-center px-4 py-4 overflow-auto">
        {isLoading && (
          <div className="absolute flex flex-col items-center space-y-4 animate-pulse z-10">
            <Skeleton className="flex justify-center items-center w-[500px] min-h-[630px] rounded-lg bg-black/90">
              <Loader className="w-6 h-6 animate-spin text-gray-400" />
            </Skeleton>
          </div>
        )}

        <div
          className={`bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300 ${
            isLoading ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="w-[500px] min-h-[630px] border-0"
            title="PDF Viewer"
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
}
