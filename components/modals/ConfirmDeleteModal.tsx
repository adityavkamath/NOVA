"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  chatTitle?: string;
  isCollapsed: boolean; // To adjust positioning of the modal based on sidebar state
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Chat Session",
  description = "Are you sure you want to delete this chat session? This action cannot be undone.",
  chatTitle,
  isCollapsed,
}: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            left: isCollapsed ? "4rem" : "16rem", // Adjust left position based on sidebar width
          }}
        >
          {/* Dark transparent backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative bg-gray-900/40 backdrop-blur-xl border border-red-500/20 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute cursor-pointer top-4 right-4 p-1 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>

            <h3 className="text-lg font-semibold text-white text-center mb-2">
              {title}
            </h3>

            <p className="text-sm text-gray-400 text-center mb-4">
              {description}
            </p>

            {chatTitle && (
              <div className="bg-white/5 rounded-lg p-3 mb-6 border border-white/10">
                <p className="text-xs text-gray-400 mb-1">Chat to be deleted:</p>
                <p className="text-sm text-white font-medium truncate">
                  "{chatTitle}"
                </p>
              </div>
            )}

            {/* Action buttons to cancel and delete */}
            <div className="flex space-x-3">
              <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1 cursor-pointer hover:bg-white/10 text-gray-300 hover:text-white border border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 cursor-pointer bg-red-600 hover:bg-red-700 text-white border border-red-500"
              >
                Delete
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}