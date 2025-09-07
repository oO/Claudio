import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/common";
import { PromptTextarea } from "./PromptTextarea";
import { ModelSelector } from "./ModelSelector";
import { ThinkingModeSelector, type ThinkingMode } from "./ThinkingModeSelector";
import { PromptControls } from "./PromptControls";
import { DebugLabel } from "@/components/ui/atoms";

export interface ExpandedPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  selectedModel: "sonnet" | "opus";
  onModelSelect: (model: "sonnet" | "opus") => void;
  selectedThinkingMode: ThinkingMode;
  onThinkingModeSelect: (mode: ThinkingMode) => void;
  embeddedImages: string[];
  onRemoveImage: (index: number) => void;
  onSend: () => void;
  canSend: boolean;
  isLoading: boolean;
  disabled?: boolean;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * Expanded modal view for composing longer prompts
 */
export const ExpandedPromptModal: React.FC<ExpandedPromptModalProps> = ({
  isOpen,
  onClose,
  prompt,
  onPromptChange,
  onPaste,
  selectedModel,
  onModelSelect,
  selectedThinkingMode,
  onThinkingModeSelect,
  embeddedImages,
  onRemoveImage,
  onSend,
  canSend,
  isLoading,
  disabled = false,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}) => {
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <DebugLabel label="ExpandedPromptModal" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Compose your prompt</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Image previews */}
            {embeddedImages.length > 0 && (
              <ImagePreview
                images={embeddedImages}
                onRemove={onRemoveImage}
                className="border-t border-border pt-2"
              />
            )}

            {/* Textarea */}
            <PromptTextarea
              value={prompt}
              onChange={onPromptChange}
              onPaste={onPaste}
              placeholder="Type your prompt here..."
              className="min-h-[200px]"
              disabled={disabled}
              autoResize={false}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Model:</span>
                  <ModelSelector
                    selectedModel={selectedModel}
                    onModelSelect={onModelSelect}
                    disabled={disabled}
                    variant="compact"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Thinking:</span>
                  <ThinkingModeSelector
                    selectedThinkingMode={selectedThinkingMode}
                    onThinkingModeSelect={onThinkingModeSelect}
                    disabled={disabled}
                    showTooltip={true}
                  />
                </div>
              </div>

              <PromptControls
                onSend={onSend}
                canSend={canSend}
                isLoading={isLoading}
                disabled={disabled}
                showExpandButton={false}
              />
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};