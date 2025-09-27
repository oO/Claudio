import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { Save, Loader2, Eye, Edit, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { TabPageLayout } from '@/components/common';
import { ThemedMDEditor } from "@/components/ui";
import { useScreenTracking } from '@/hooks/useAnalytics';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';
import { claudeApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { logger } from '@/lib/logger';

interface ClaudeMdTabProps {
  tab: Tab;
  isActive: boolean;
}

export const ClaudeMdTab: React.FC<ClaudeMdTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);
  
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentMode, setCurrentMode] = useState<"edit" | "preview" | "live">("preview");
  
  const hasChanges = content !== originalContent;
  
  // Automatically sync unsaved changes state with the tab
  const { markAsSaved } = useUnsavedChanges(hasChanges);
  
  // Load the system prompt on mount
  useEffect(() => {
    loadSystemPrompt();
  }, []);
  
  const loadSystemPrompt = async () => {
    try {
      setLoading(true);
      setError(null);
      const prompt = await claudeApi.getSystemPrompt();
      setContent(prompt);
      setOriginalContent(prompt);
    } catch (err) {
      logger.error("Failed to load system prompt:", err);
      setError("Failed to load CLAUDE.md file");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);
      await claudeApi.saveSystemPrompt(content);
      setOriginalContent(content);
      markAsSaved(); // Clear the unsaved changes flag
      setToast({ message: "CLAUDE.md saved", type: "success" });
    } catch (err) {
      logger.error("Failed to save system prompt:", err);
      setError("Failed to save CLAUDE.md file");
      setToast({ message: "Failed to save CLAUDE.md", type: "error" });
    } finally {
      setSaving(false);
    }
  };
  
  const renderActions = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <Button
          variant={currentMode === "preview" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("preview")}
          className="h-8 px-3 text-xs rounded-none rounded-l-md border-0"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button
          variant={currentMode === "edit" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("edit")}
          className="h-8 px-3 text-xs rounded-none border-0 border-l border-r border-border/50"
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant={currentMode === "live" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("live")}
          className="h-8 px-3 text-xs rounded-none rounded-r-md border-0"
        >
          <Split className="h-3 w-3 mr-1" />
          Live
        </Button>
      </div>
      
      <Button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        size="sm"
        className="h-8"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );

  return (
    <div className="relative h-full">
      <DebugLabel label="ClaudeMdTab" />
      <TabPageLayout
        title="CLAUDE.md"
        subtitle="Global Claude Code configuration"
        actions={renderActions()}
        contentPadding={false}
      >
        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-6 mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
        
        {/* Editor */}
        <div className="h-full p-6 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ThemedMDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              preview={currentMode}
            />
          )}
        </div>
      </TabPageLayout>
      
      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
};