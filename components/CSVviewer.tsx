"use client";

import { useState, useEffect } from "react";
import { FileSpreadsheet, Loader, Download, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CsvViewerProps {
  csvUrl: string;
  fileName: string;
  className?: string;
}

export default function CsvViewer({
  csvUrl,
  fileName,
  className = "",
}: CsvViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCsvData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch CSV data");
        }

        const text = await response.text();
        const rows = text
          .split("\n")
          .map((row) =>
            row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
          );

        // Filter out empty rows
        const filteredRows = rows.filter((row) =>
          row.some((cell) => cell.length > 0)
        );
        setCsvData(filteredRows);
        setError(null);
      } catch (err) {
        console.error("Error fetching CSV:", err);
        setError("Failed to load CSV data");
        toast.error("Failed to load CSV data");
      } finally {
        setIsLoading(false);
      }
    };

    if (csvUrl) {
      fetchCsvData();
    }
  }, [csvUrl]);

  const downloadCsv = () => {
    const link = document.createElement("a");
    link.href = csvUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started");
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  const displayRows = csvData.slice(0, 50); 
  const hasMoreRows = csvData.length > 50;

  return (
    <div
      className={`h-full bg-black text-white border-r border-white/10 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-medium text-white">{fileName}</h1>
            {csvData.length > 0 && (
              <p className="text-xs text-gray-400">
                {csvData.length} rows × {csvData[0]?.length || 0} columns
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={togglePreview}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            {showPreview ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={downloadCsv}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* CSV Display */}
      <div className="flex-1 bg-black relative overflow-auto">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 animate-pulse z-10">
            <Skeleton className="flex justify-center items-center w-full h-32 rounded-lg bg-gray-800">
              <Loader className="w-6 h-6 animate-spin text-gray-400" />
            </Skeleton>
            <p className="text-gray-400">Loading CSV data...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <FileSpreadsheet className="h-12 w-12 text-gray-600 mx-auto" />
              <p className="text-gray-400">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && csvData.length > 0 && showPreview && (
          <div className="p-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 border-b border-gray-700">
                      {csvData[0]?.map((header, index) => (
                        <th
                          key={index}
                          className="px-3 py-2 text-left font-medium text-gray-300 border-r border-gray-700 last:border-r-0 min-w-[100px]"
                        >
                          {header || `Column ${index + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.slice(1).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-gray-700 hover:bg-gray-800/50"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-2 text-gray-300 border-r border-gray-700 last:border-r-0 max-w-[200px] truncate"
                            title={cell}
                          >
                            {cell || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMoreRows && (
                <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-center">
                  <p className="text-xs text-gray-400">
                    Showing first 50 rows of {csvData.length} total rows
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isLoading && !error && csvData.length > 0 && !showPreview && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">
                  CSV Preview Hidden
                </h3>
                <p className="text-gray-400 mb-4">
                  Click the eye icon to show the data preview
                </p>
                <Button
                  onClick={togglePreview}
                  className="bg-gradient-to-r from-green-500 to-emerald-600"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Show Preview
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && csvData.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <FileSpreadsheet className="h-12 w-12 text-gray-600 mx-auto" />
              <p className="text-gray-400">No data found in CSV file</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
