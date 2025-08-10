import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilePicker, SlashCommandPicker, ImagePreview } from "@/components/common";
import { DebugLabel } from "@/components/ui/atoms";
import { type FileEntry, type SlashCommand } from "@/lib/api";

// Import our extracted components and hooks
import { PromptTextarea } from "./PromptTextarea";
import { ModelSelector } from "./ModelSelector";
import { ThinkingModeSelector, type ThinkingMode, THINKING_MODES } from "./ThinkingModeSelector";
import { PromptControls } from "./PromptControls";
import { ExpandedPromptModal } from "./ExpandedPromptModal";
import {
  usePromptInput,
  useSlashCommands,
  useImageHandling,
  useFilePicker,
} from "@/hooks";

interface FloatingPromptInputProps {
  /**
   * Callback when prompt is sent
   */
  onSend: (prompt: string, model: "sonnet" | "opus") => void;
  /**
   * Whether the input is loading
   */
  isLoading?: boolean;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Default model to select
   */
  defaultModel?: "sonnet" | "opus";
  /**
   * Project path for file picker
   */
  projectPath?: string;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when cancel is clicked (only during loading)
   */
  onCancel?: () => void;
}

export interface FloatingPromptInputRef {
  addImage: (imagePath: string) => void;
}

/**
 * FloatingPromptInput component - Fixed position prompt input with model picker
 * 
 * @example
 * const promptRef = useRef<FloatingPromptInputRef>(null);
 * <FloatingPromptInput
 *   ref={promptRef}
 *   onSend={(prompt, model) => console.log('Send:', prompt, model)}
 *   isLoading={false}
 * />
 */
const FloatingPromptInputInner = (
  {
    onSend,
    isLoading = false,
    disabled = false,
    defaultModel = "sonnet",
    projectPath,
    className,
    onCancel,
  }: FloatingPromptInputProps,
  ref: React.Ref<FloatingPromptInputRef>,
) => {
  // Model and thinking mode state
  const [selectedModel, setSelectedModel] = useState<"sonnet" | "opus">(defaultModel);
  const [selectedThinkingMode, setSelectedThinkingMode] = useState<ThinkingMode>("auto");
  const [isExpanded, setIsExpanded] = useState(false);

  // Textarea refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Core prompt input logic
  const {
    prompt,
    setPrompt,
    updatePrompt,
    clearPrompt,
    canSend,
    cursorPosition,
    setCursorPosition,
  } = usePromptInput({
    defaultValue: "",
    disabled,
  });

  // Image handling
  const {
    embeddedImages,
    setEmbeddedImages,
    dragActive,
    handleDrag,
    handleDrop,
    handlePaste,
    handleRemoveImage,
    addImage,
    extractImagePaths,
  } = useImageHandling({
    projectPath,
    onPromptUpdate: updatePrompt,
    onFocusTextarea: () => {
      const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
      target?.focus();
    },
    onSetCursor: (position: number) => {
      const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
      target?.setSelectionRange(position, position);
    },
  });

  // Update embedded images when prompt changes
  useEffect(() => {
    const imagePaths = extractImagePaths(prompt);
    setEmbeddedImages(imagePaths);
  }, [prompt, extractImagePaths, setEmbeddedImages]);

  // Slash commands
  const {
    showSlashCommandPicker,
    slashCommandQuery,
    closeSlashCommandPicker,
    handleSlashCommandSelect: handleSlashCommandSelectBase,
    detectSlashCommand,
  } = useSlashCommands();

  // File picker for @ mentions
  const {
    showFilePicker,
    filePickerQuery,
    closeFilePicker,
    handleFileSelect: handleFileSelectBase,
    detectAtSymbol,
  } = useFilePicker({
    projectPath,
  });

  // Focus management
  useEffect(() => {
    if (isExpanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus();
    } else if (!isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Expose imperative handle for adding images
  React.useImperativeHandle(
    ref,
    () => ({
      addImage: (imagePath: string) => {
        const newPrompt = addImage(imagePath, prompt);
        setPrompt(newPrompt);
      }
    }),
    [addImage, prompt, setPrompt]
  );

  // Handle sending with thinking mode
  const handleSend = () => {
    if (canSend) {
      let finalPrompt = prompt.trim();
      
      // Append thinking phrase if not auto mode
      const thinkingMode = THINKING_MODES.find(m => m.id === selectedThinkingMode);
      if (thinkingMode && thinkingMode.phrase) {
        finalPrompt = `${finalPrompt}.\n\n${thinkingMode.phrase}.`;
      }
      
      onSend(finalPrompt, selectedModel);
      clearPrompt();
      setEmbeddedImages([]);
    }
  };

  // Text change handler with slash command and @ detection
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;

    // Check for slash commands and @ mentions
    detectSlashCommand(newValue, newCursorPosition, prompt);
    detectAtSymbol(newValue, newCursorPosition, prompt);

    setPrompt(newValue);
    setCursorPosition(newCursorPosition);
  };

  // Enhanced file select handler
  const handleFileSelect = (entry: FileEntry) => {
    // Find the @ position before cursor
    let atPosition = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (prompt[i] === '@') {
        atPosition = i;
        break;
      }
      // Stop if we hit whitespace (new word)
      if (prompt[i] === ' ' || prompt[i] === '\n') {
        break;
      }
    }

    if (atPosition === -1) {
      console.error('[FloatingPromptInput] @ position not found');
      return;
    }

    // Replace the @ and partial query with the selected path
    const beforeAt = prompt.substring(0, atPosition);
    const afterCursor = prompt.substring(cursorPosition);
    const relativePath = entry.path.startsWith(projectPath || '')
      ? entry.path.slice((projectPath || '').length + 1)
      : entry.path;

    const newPrompt = `${beforeAt}@${relativePath} ${afterCursor}`;
    setPrompt(newPrompt);
    closeFilePicker();

    // Focus and set cursor position
    setTimeout(() => {
      const target = isExpanded ? expandedTextareaRef.current : textareaRef.current;
      target?.focus();
      const newCursorPos = beforeAt.length + relativePath.length + 2; // +2 for @ and space
      target?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Enhanced slash command select handler
  const handleSlashCommandSelect = (command: SlashCommand) => {
    const textarea = isExpanded ? expandedTextareaRef.current : textareaRef.current;
    if (!textarea) return;

    // Find the / position before cursor
    let slashPosition = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (prompt[i] === '/') {
        slashPosition = i;
        break;
      }
      // Stop if we hit whitespace (new word)
      if (prompt[i] === ' ' || prompt[i] === '\n') {
        break;
      }
    }

    if (slashPosition === -1) {
      console.error('[FloatingPromptInput] / position not found');
      return;
    }

    // Insert command
    const beforeSlash = prompt.substring(0, slashPosition);
    const afterCursor = prompt.substring(cursorPosition);
    
    if (command.accepts_arguments) {
      const newPrompt = `${beforeSlash}${command.full_command} `;
      setPrompt(newPrompt);
      closeSlashCommandPicker();

      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeSlash.length + command.full_command.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      const newPrompt = `${beforeSlash}${command.full_command} ${afterCursor}`;
      setPrompt(newPrompt);
      closeSlashCommandPicker();

      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeSlash.length + command.full_command.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showFilePicker && e.key === 'Escape') {
      e.preventDefault();
      closeFilePicker();
      return;
    }

    if (showSlashCommandPicker && e.key === 'Escape') {
      e.preventDefault();
      closeSlashCommandPicker();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !isExpanded && !showFilePicker && !showSlashCommandPicker) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <DebugLabel label="FloatingPromptInput" />
      {/* Expanded Modal */}
      <ExpandedPromptModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        prompt={prompt}
        onPromptChange={handleTextChange}
        onPaste={handlePaste}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        selectedThinkingMode={selectedThinkingMode}
        onThinkingModeSelect={setSelectedThinkingMode}
        embeddedImages={embeddedImages}
        onRemoveImage={(index) => handleRemoveImage(index, prompt)}
        onSend={handleSend}
        canSend={canSend}
        isLoading={isLoading}
        disabled={disabled}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      />

      {/* Fixed Position Input Bar */}
      <div
        className={cn(
          "relative fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border",
          dragActive && "ring-2 ring-primary ring-offset-2",
          className
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="max-w-5xl mx-auto">
          {/* Image previews */}
          {embeddedImages.length > 0 && (
            <ImagePreview
              images={embeddedImages}
              onRemove={(index) => handleRemoveImage(index, prompt)}
              className="border-b border-border"
            />
          )}

          <div className="p-4">
            <div className="flex items-end gap-3">
              {/* Model Selector */}
              <ModelSelector
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                disabled={disabled}
              />

              {/* Thinking Mode Selector */}
              <ThinkingModeSelector
                selectedThinkingMode={selectedThinkingMode}
                onThinkingModeSelect={setSelectedThinkingMode}
                disabled={disabled}
                showTooltip={true}
              />

              {/* Prompt Input */}
              <div className="flex-1 relative">
                <PromptTextarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={dragActive ? "Drop images here..." : "Ask Claude anything..."}
                  disabled={disabled}
                  className="pr-10"
                  dragActive={dragActive}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(true)}
                  disabled={disabled}
                  className="absolute right-1 bottom-1 h-8 w-8"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>

                {/* File Picker */}
                <AnimatePresence>
                  {showFilePicker && projectPath && projectPath.trim() && (
                    <FilePicker
                      basePath={projectPath.trim()}
                      onSelect={handleFileSelect}
                      onClose={closeFilePicker}
                      initialQuery={filePickerQuery}
                    />
                  )}
                </AnimatePresence>

                {/* Slash Command Picker */}
                <AnimatePresence>
                  {showSlashCommandPicker && (
                    <SlashCommandPicker
                      projectPath={projectPath}
                      onSelect={handleSlashCommandSelect}
                      onClose={closeSlashCommandPicker}
                      initialQuery={slashCommandQuery}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Controls */}
              <PromptControls
                onSend={handleSend}
                onCancel={onCancel}
                canSend={canSend}
                isLoading={isLoading}
                disabled={disabled}
                showExpandButton={false}
              />
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line{projectPath?.trim() && ", @ to mention files, / for commands, drag & drop or paste images"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const FloatingPromptInput = React.forwardRef<
  FloatingPromptInputRef,
  FloatingPromptInputProps
>(FloatingPromptInputInner);

FloatingPromptInput.displayName = 'FloatingPromptInput';