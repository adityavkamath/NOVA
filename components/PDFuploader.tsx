"use client";

import type React from "react";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { AnimatePresence } from "framer-motion";
import {
  FileText,
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
  pdfId?: string;
}

interface PdfUploaderProps {
  onFileUpload?: (file: File, url: string, pdfId: string) => void;
  onFileRemove?: (fileId: string) => void;
}

export default function PdfUploader({
  onFileUpload,
  onFileRemove,
}: PdfUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { user } = useUser();

  const userId = user?.id;
  const { getToken, isSignedIn } = useAuth();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Please upload a PDF file only";
    }
    if (file.size > 50 * 1024 * 1024) {
      return "File size must be less than 50MB";
    }
    return null;
  };

  const uploadFileToBackend = async (
    file: File
  ): Promise<{ url: string; pdfId: string }> => {
    if (!isSignedIn) {
      throw new Error("Please sign in to upload files");
    }

    const token = await getToken();
    if (!token) {
      throw new Error("Authentication token not available");
    }

    const formData = new FormData();
    formData.append("file", file);

    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/pdf/upload-pdf`;

    try {
      const response = await axios.post(apiUrl, formData, {
        headers: {
          "user-id": userId,
        },
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Upload failed");
      }

      const pdfId = data.data.id || data.id;

      if (!pdfId) {
        throw new Error("PDF ID not received from server");
      }

      return {
        url: data.data.url,
        pdfId: pdfId,
      };
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error("Please sign in to upload files");
      } else if (error.response?.status === 404) {
        throw new Error("User not found. Please contact support.");
      }

      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Upload failed due to an unknown error";
      throw new Error(errorMessage);
    }
  };

  const createChatSession = async (
    pdfId: string,
    fileName: string
  ): Promise<string> => {
    if (!isSignedIn) {
      throw new Error("Please sign in to create chat session");
    }

    const token = await getToken();
    if (!token) {
      throw new Error("Authentication token not available");
    }

    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/chat/create-session`;

    try {
      const response = await axios.post(
        apiUrl,
        {
          title: `Chat with ${fileName}`,
          feature_type: "pdf",
          source_id: pdfId,
        },
        {
          headers: {
            "user-id": userId,
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Failed to create chat session");
      }

      const sessionId = data.data?.id || data.id;

      if (!sessionId) {
        throw new Error("Session ID not received from server");
      }

      return sessionId;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error("Please sign in to create chat session");
      } else if (error.response?.status === 404) {
        throw new Error("User not found. Please contact support.");
      }

      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Failed to create chat session";
      throw new Error(errorMessage);
    }
  };

  const simulateProgressAndUpload = async (
    file: UploadedFile
  ): Promise<void> => {
    try {
      const progressInterval = setInterval(() => {
        setUploadedFile((prev) => {
          if (!prev || prev.status !== "uploading") return prev;
          const newProgress = Math.min(
            prev.uploadProgress + Math.random() * 15,
            90
          );
          return { ...prev, uploadProgress: newProgress };
        });
      }, 300);

      const { url: fileUrl, pdfId } = await uploadFileToBackend(file.file);

      clearInterval(progressInterval);

      setUploadedFile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          uploadProgress: 100,
          status: "success",
          url: fileUrl,
          pdfId: pdfId,
        };
      });

      toast.success("PDF uploaded and converted to embeddings!", {
        description: `${file.name} is ready for processing`,
        duration: 5000,
        action: {
          label: "View",
          onClick: () => window.open(fileUrl, "_blank"),
        },
      });

      onFileUpload?.(file.file, fileUrl, pdfId);
    } catch (error) {
      // Clear any progress interval
      setUploadedFile((prev) => {
        if (!prev) return null;
        return { ...prev, status: "error", uploadProgress: 0 };
      });

      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload file";
      toast.error("Upload failed", {
        description: errorMessage,
        duration: 7000,
        action: {
          label: "Retry",
          onClick: () => handleFile(file.file),
        },
      });
    }
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSignedIn) {
        toast.error("Authentication required", {
          description: "Please sign in to upload files",
          duration: 5000,
        });
        return;
      }

      const validationError = validateFile(file);
      if (validationError) {
        toast.error("Invalid file", {
          description: validationError,
          duration: 5000,
        });
        return;
      }

      if (uploadedFile) {
        setUploadedFile(null);
      }

      const newFile: UploadedFile = {
        file,
        name: file.name,
        size: formatFileSize(file.size),
        uploadProgress: 0,
        status: "uploading",
        id: Date.now().toString(),
      };

      setUploadedFile(newFile);

      toast.info("Upload started", {
        description: `Uploading ${file.name} to cloud storage...`,
        duration: 3000,
      });

      await simulateProgressAndUpload(newFile);
    },
    [uploadedFile, onFileUpload, isSignedIn, getToken]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]); // Only take the first file
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  const handleRemoveFile = useCallback(() => {
    if (uploadedFile) {
      onFileRemove?.(uploadedFile.id);
      setUploadedFile(null);

      toast.info("File removed", {
        description: "You can upload a new PDF file now",
        duration: 3000,
      });
    }
  }, [uploadedFile, onFileRemove]);

  const handleStartChat = useCallback(async () => {
    if (!uploadedFile?.pdfId || uploadedFile.status !== "success") {
      toast.error("Unable to start chat", {
        description: "PDF ID not available. Please try uploading again.",
        duration: 5000,
      });
      return;
    }

    setIsCreatingSession(true);

    try {
      // Create chat session here
      const sessionId = await createChatSession(
        uploadedFile.pdfId,
        uploadedFile.name
      );

      console.log("Chat session created with ID:", sessionId);
      console.log("Navigating to PDF chat with PDF ID:", uploadedFile.pdfId);

      toast.success("Chat session created!", {
        description: "Redirecting to your PDF chat...",
        duration: 2000,
      });

      // Navigate to the chat page - you can choose to use sessionId or pdfId based on your routing
      router.push(
        `/dashboard/chats/pdf-chat/${uploadedFile.pdfId}?sessionId=${sessionId}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create chat session";

      toast.error("Failed to start chat", {
        description: errorMessage,
        duration: 5000,
        action: {
          label: "Retry",
          onClick: () => handleStartChat(),
        },
      });
    } finally {
      setIsCreatingSession(false);
    }
  }, [uploadedFile, router]);

  const openFileDialog = () => {
    if (!isSignedIn) {
      toast.error("Authentication required", {
        description: "Please sign in to upload files",
        duration: 5000,
      });
      return;
    }
    fileInputRef.current?.click();
  };

  if (!isSignedIn) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center p-12 border-2 border-dashed border-gray-600 rounded-lg bg-gray-900/30">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-red-800 flex items-center justify-center mb-6 border border-gray-500">
            <AlertCircle className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Sign In Required
          </h3>
          <p className="text-gray-400 mb-6">
            Please sign in to upload and chat with PDF documents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-2xl mx-auto`}>
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 transition-colors duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-400 bg-gray-900/50"
            : uploadedFile
            ? "border-gray-600 bg-gray-900/30"
            : "border-gray-600 hover:border-gray-300 hover:bg-gray-700/20"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!uploadedFile ? openFileDialog : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {!uploadedFile ? (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-violet-800 flex items-center justify-center mb-6 border border-gray-500">
                <CloudUpload className="h-8 w-8 text-white" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-2">
                Upload PDF Document
              </h3>
              <p className="text-gray-400 mb-6">
                Drag and drop your PDF file here, or click to browse
              </p>

              <div className="flex items-center justify-center space-x-4 mb-4">
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100/10 border border-gray-700">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">PDF Files</span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100/10 border border-gray-700">
                  <span className="text-sm text-gray-400">Up to 50MB</span>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Files are uploaded to secure cloud storage
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center space-x-4 p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">
                    {uploadedFile.name}
                  </h4>
                  <p className="text-xs text-gray-400">{uploadedFile.size}</p>
                  {uploadedFile.url && (
                    <p className="text-xs text-blue-400 mt-1">
                      Stored in cloud storage
                    </p>
                  )}
                  {uploadedFile.pdfId && (
                    <p className="text-xs text-green-400 mt-1">
                      PDF ID: {uploadedFile.pdfId}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {uploadedFile.status === "uploading" && (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                      <span className="text-xs bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">
                        Uploading...
                      </span>
                    </div>
                  )}
                  {uploadedFile.status === "success" && (
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-400">Complete</span>
                    </div>
                  )}
                  {uploadedFile.status === "error" && (
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-xs text-red-400">Failed</span>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="p-1 h-8 w-8 hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              {uploadedFile.status === "uploading" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">
                      Uploading to cloud storage...
                    </span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">
                      {Math.round(uploadedFile.uploadProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 bg-gradient-to-r from-blue-400 to-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadedFile.uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Message */}
              {uploadedFile.status === "success" && (
                <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-green-400 font-medium mb-1">
                    PDF uploaded successfully!
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    File stored securely in cloud storage
                  </p>

                  <div className="flex justify-center space-x-2">
                    {uploadedFile.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(uploadedFile.url, "_blank")}
                        className="h-8 text-xs cursor-pointer border-green-400/30 text-green-400 hover:bg-green-400/10"
                      >
                        View File
                      </Button>
                    )}
                    <Button
                      onClick={handleStartChat}
                      size="sm"
                      className="h-8 text-xs cursor-pointer bg-gradient-to-br from-blue-600 to-violet-800 text-white hover:bg-blue-600"
                      disabled={!uploadedFile.pdfId || isCreatingSession}
                    >
                      {isCreatingSession ? (
                        <div className="flex items-center space-x-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Creating...</span>
                        </div>
                      ) : (
                        "Start Chatting"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {uploadedFile.status === "error" && (
                <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-400 font-medium mb-1">
                    Upload failed
                  </p>
                  <p className="text-xs text-gray-400">
                    Please try again or check your connection
                  </p>
                  <Button
                    onClick={() => handleFile(uploadedFile.file)}
                    size="sm"
                    className="mt-2 h-8 text-xs bg-red-500 text-white hover:bg-red-600"
                  >
                    Retry Upload
                  </Button>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
