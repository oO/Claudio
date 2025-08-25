import React, { useState, useRef } from "react";
import { DebugLabel } from "@/components/ui/atoms";
import { PromptTextarea } from "./PromptTextarea";
import { ModelSelector } from "./ModelSelector";
import { ThinkingModeSelector, type ThinkingMode } from "./ThinkingModeSelector";
import { PromptControls } from "./PromptControls";

interface SimplePromptInputProps {
  onSend: (prompt: string, model: "sonnet" | "opus") => void;
  onCancel: () => void;
  isLoading: boolean;
  disabled?: boolean;
  projectPath: string;
}

export interface SimplePromptInputRef {
  focus: () => void;
  clear: () => void;
  getCurrentPrompt: () => string;
}

/**
 * Clean, simple prompt input - essential features without complexity
 */
export const SimplePromptInput = React.forwardRef<SimplePromptInputRef, SimplePromptInputProps>(
  ({ onSend, onCancel, isLoading, disabled = false, projectPath }, ref) => {
    const [prompt, setPrompt] = useState("");
    const [selectedModel, setSelectedModel] = useState<"sonnet" | "opus">("sonnet");
    const [thinkingMode, setThinkingMode] = useState<ThinkingMode>("auto");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => setPrompt(""),
      getCurrentPrompt: () => prompt,
    }));

    const canSend = prompt.trim().length > 0 && !disabled;

    const handleSend = () => {
      if (!canSend) return;
      onSend(prompt, selectedModel);
      setPrompt(""); // Clear after sending
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="bg-background border-t">
        <DebugLabel label="SimplePromptInput" />
        
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex flex-col gap-3">
            {/* Model and Thinking Mode Selectors */}
            <div className="flex gap-2">
              <ModelSelector
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                disabled={disabled || isLoading}
              />
              <ThinkingModeSelector
                selectedThinkingMode={thinkingMode}
                onThinkingModeSelect={setThinkingMode}
                disabled={disabled || isLoading}
              />
            </div>

            {/* Main Input Area */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <PromptTextarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask Claude something... (${projectPath ? 'ready' : 'no project selected'})`}
                  disabled={disabled || isLoading}
                  minHeight={44}
                  maxHeight={200}
                  autoResize
                />
              </div>
              
              {/* Send/Stop Button */}
              <div className="flex-shrink-0">
                <PromptControls
                  onSend={handleSend}
                  onCancel={onCancel}
                  canSend={canSend}
                  isLoading={isLoading}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

SimplePromptInput.displayName = 'SimplePromptInput';