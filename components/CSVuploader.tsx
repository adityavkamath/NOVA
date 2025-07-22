"use client";

import type React from "react";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

interface UploadedFile {
  file: File;
  name: string;
  size: string;
  uploadProgress: number;
  status: "uploading" | "success" | "error";
  id: string;
  url?: string;
  csvId?: string;
}

interface CsvUploaderProps {
  onFileUpload?: (file: File, url: string, csvId: string) => void;
  onFileRemove?: (fileId: string) => void;
}

export default function CsvUploader({
  onFileUpload,
  onFileRemove,
}: CsvUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { user } = useUser();

  const userId = user?.id;
  const { isSignedIn } = useAuth();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileUpload = async (file: File) => {
    if (!isSignedIn) {
      toast.error("Please sign in to upload files");
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be under 100MB");
      return;
    }

    const fileId = Math.random().toString(36).substring(7);
    const newFile: UploadedFile = {
      file,
      name: file.name,
      size: formatFileSize(file.size),
      uploadProgress: 0,
      status: "uploading",
      id: fileId,
    };

    setUploadedFile(newFile);

    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/csv/upload-csv`,
        formData,
        {
          headers: {
            "user-id": user.id,
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadedFile((prev) =>
                prev ? { ...prev, uploadProgress: progress } : null
              );
            }
          },
        }
      );

      if (response.data.success) {
        const csvData = response.data.data;
        setUploadedFile((prev) =>
          prev
            ? {
                ...prev,
                status: "success",
                url: csvData.url,
                csvId: csvData.id,
                uploadProgress: 100,
              }
            : null
        );

        onFileUpload?.(file, csvData.url, csvData.id);
        toast.success("CSV uploaded successfully!");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadedFile((prev) =>
        prev ? { ...prev, status: "error" } : null
      );
      
      // Better error message handling
      let errorMessage = "Failed to upload CSV file";
      
      if (error.response?.data?.detail) {
        // Handle string error messages
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // Handle validation error arrays
          errorMessage = error.response.data.detail.map((err: any) => 
            typeof err === 'string' ? err : err.msg || 'Validation error'
          ).join(', ');
        } else {
          errorMessage = "Invalid file format or server error";
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const removeFile = () => {
    if (uploadedFile) {
      onFileRemove?.(uploadedFile.id);
      setUploadedFile(null);
    }
  };

  const createChatSession = async () => {
    if (!uploadedFile?.csvId || !userId) {
      toast.error("No CSV file uploaded or user not authenticated");
      return;
    }

    setIsCreatingSession(true);

    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/create-session`,
        {
          user_id: userId,
          feature_type: "csv",
          source_id: uploadedFile.csvId,
          title: `CSV Chat - ${uploadedFile.name}`,
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
        router.push(`/dashboard/chats/csv-chat/${uploadedFile.csvId}?sessionId=${sessionId}`);
      }
    } catch (error: any) {
      console.error("Session creation error:", error);
      toast.error("Failed to create chat session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">CSV Chat</h1>
        <p className="text-gray-400">
          Upload your CSV file and chat with your data using AI
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          isDragOver
            ? "border-blue-500 bg-blue-500/10"
            : uploadedFile
            ? "border-green-500 bg-green-500/10"
            : "border-gray-600 bg-gray-800/50 hover:border-gray-500"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {!uploadedFile ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Drop your CSV file here
                </h3>
                <p className="text-gray-400 mb-4">
                  or click to browse your files
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV File
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Supports CSV files up to 100MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-400">{uploadedFile.size}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {uploadedFile.status === "uploading" && (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm text-gray-400">
                        {uploadedFile.uploadProgress}%
                      </span>
                    </div>
                  )}
                  {uploadedFile.status === "success" && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {uploadedFile.status === "error" && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {uploadedFile.status === "uploading" && (
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-violet-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadedFile.uploadProgress}%` }}
                  />
                </div>
              )}

              {uploadedFile.status === "success" && (
                <div className="space-y-4">
                  <p className="text-green-400 font-medium">
                    ✅ CSV uploaded and processed successfully!
                  </p>
                  <Button
                    onClick={createChatSession}
                    disabled={isCreatingSession}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 w-full"
                  >
                    {isCreatingSession ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Chat Session...
                      </>
                    ) : (
                      <>
                        <CloudUpload className="h-4 w-4 mr-2" />
                        Start Chatting with CSV
                      </>
                    )}
                  </Button>
                </div>
              )}

              {uploadedFile.status === "error" && (
                <div className="space-y-4">
                  <p className="text-red-400 font-medium">
                    ❌ Upload failed. Please try again.
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
            <FileSpreadsheet className="h-4 w-4 text-green-400" />
          </div>
          <h3 className="font-medium text-white mb-1">Data Analysis</h3>
          <p className="text-sm text-gray-400">
            Ask questions about your CSV data and get insights
          </p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
            <CloudUpload className="h-4 w-4 text-blue-400" />
          </div>
          <h3 className="font-medium text-white mb-1">Smart Processing</h3>
          <p className="text-sm text-gray-400">
            AI understands your data structure and content
          </p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
            <Upload className="h-4 w-4 text-purple-400" />
          </div>
          <h3 className="font-medium text-white mb-1">Easy Upload</h3>
          <p className="text-sm text-gray-400">
            Drag and drop or click to upload your CSV files
          </p>
        </div>
      </div>
    </div>
  );
}
