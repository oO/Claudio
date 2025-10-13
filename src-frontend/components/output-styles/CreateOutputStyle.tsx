import React, { useState } from "react";
import { motion } from "framer-motion";
import { Save, MoreVertical, Settings, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabPageLayout } from "@/components/common";
import { outputStylesApi, type OutputStyle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ThemedMDEditor } from "@/components/ui";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { logger } from '@/lib/logger';

// Atomic Design System imports
import {
  DebugLabel,
  ActionButton
} from "@/components/ui/atoms";
import {
  StatusMessage
} from "@/components/ui/molecules";
import {
  ConfirmationDialog
} from "@/components/ui/organisms";

interface CreateOutputStyleProps {
  /**
   * Optional style to edit (if provided, component is in edit mode)
   */
  style?: OutputStyle;
  /**
   * Callback to go back to the styles list
   */
  onBack: () => void;
  /**
   * Callback when style is created/updated
   */
  onStyleCreated: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Optional project path (indicates this is a project-level style)
   */
  projectPath?: string;
}

/**
 * CreateOutputStyle component for creating or editing an output style
 *
 * @example
 * <CreateOutputStyle onBack={() => setView('list')} onStyleCreated={handleCreated} />
 */
export const CreateOutputStyle: React.FC<CreateOutputStyleProps> = ({
  style,
  onBack,
  onStyleCreated,
  className,
  projectPath,
}) => {
  const [name, setName] = useState(style?.name || "");
  const [description, setDescription] = useState(style?.description || "");
  const [content, setContent] = useState(style?.content || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("properties");

  const isEditMode = !!style;

  // Helper to format style name from "my-style" to "My Style"
  const formatStyleName = (styleName: string) => {
    return styleName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Convert name to snake-case (kebab-case)
  const toSnakeCase = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
  };

  // Validate snake-case format
  const isValidSnakeCase = (str: string) => {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);
  };

  // Check if form has changes
  const nameChanged = name !== (style?.name || "");
  const descriptionChanged = description !== (style?.description || "");
  const contentChanged = content !== (style?.content || "");

  const hasChanges = isEditMode && (nameChanged || descriptionChanged || contentChanged);

  // Automatically sync unsaved changes state with the tab
  const { markAsSaved } = useUnsavedChanges(hasChanges);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Output style name is required");
      return;
    }

    // Validate snake-case format
    if (!isValidSnakeCase(name)) {
      setError("Style name must be in kebab-case format (lowercase with dashes, e.g., my-custom-style)");
      return;
    }

    if (!content.trim()) {
      setError("Style content is required");
      return;
    }

    // Check for name conflicts if name changed
    if (isEditMode && name !== style?.name) {
      try {
        // Get list of existing styles to check for conflicts
        const existingStyles = await outputStylesApi.listOutputStyles(projectPath);
        const nameExists = existingStyles.some(s => s.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          setError(`An output style named "${name}" already exists. Please choose a different name.`);
          return;
        }
      } catch (err) {
        // Silent error - name conflict check failed
      }
    } else if (!isEditMode) {
      // For new styles, always check for conflicts
      try {
        const existingStyles = await outputStylesApi.listOutputStyles(projectPath);
        const nameExists = existingStyles.some(s => s.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          setError(`An output style named "${name}" already exists. Please choose a different name.`);
          return;
        }
      } catch (err) {
        // Silent error - name conflict check failed
      }
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditMode) {
        await outputStylesApi.updateOutputStyle(
          {
            name,
            description: description || undefined,
            content,
          },
          projectPath
        );
      } else {
        await outputStylesApi.createOutputStyle(
          {
            name,
            description: description || undefined,
            content,
          },
          projectPath
        );
      }

      markAsSaved(); // Clear the unsaved changes flag
      onStyleCreated();
    } catch (err) {
      logger.error("Failed to save output style:", err);
      setError(isEditMode ? "Failed to update output style" : "Failed to create output style");
      setToast({
        message: isEditMode ? "Failed to update output style" : "Failed to create output style",
        type: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    // Check if there are unsaved changes
    if (hasChanges) {
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  };

  const handleConfirmLeave = () => {
    setShowUnsavedDialog(false);
    onBack();
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
  };

  const handleMoveToUserLevel = async (overwrite: boolean = false) => {
    if (!style?.name || !style?.file_path) return;

    // Extract project path from file_path
    const projectPathMatch = style.file_path.match(/^(.*)\/\.claude\/output-styles\//);
    if (!projectPathMatch) {
      setError("Could not determine project path from style file location");
      return;
    }
    const extractedProjectPath = projectPathMatch[1];

    try {
      setSaving(true);
      await outputStylesApi.moveOutputStyleToUserLevel(style.name, extractedProjectPath, overwrite);
      setToast({ message: "Output style moved to user level successfully!", type: "success" });
      setTimeout(() => {
        onStyleCreated(); // Refresh the list
      }, 500);
    } catch (error) {
      logger.error("Failed to move output style:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if error is about style already existing
      if (errorMsg.includes('STYLE_EXISTS:')) {
        setShowOverwriteDialog(true);
      } else {
        setError(errorMsg.replace('STYLE_EXISTS:', ''));
      }
    } finally {
      setSaving(false);
    }
  };

  // Check if this is a project-level style
  const isUserLevelStyle = style?.file_path?.match(/^\/Users\/[^/]+\/\.claude\/output-styles\//);
  const isProjectLevelStyle = style?.file_path && !isUserLevelStyle;

  const renderActions = () => (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSave}
        disabled={saving || !name.trim() || !content.trim() || (isEditMode && !hasChanges)}
        size="sm"
        className="h-8"
      >
        {saving ? (
          <>
            <Save className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save
          </>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionButton
            icon={MoreVertical}
            label="More options"
            variant="ghost"
            size="icon"
            showLabel={false}
            className="h-8 w-8"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isEditMode && isProjectLevelStyle && (
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleMoveToUserLevel();
              }}
            >
              Move to User Level
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logger.info('Export clicked');
            }}
          >
            Export Output Style
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logger.info('Duplicate clicked');
            }}
          >
            Duplicate Output Style
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Get the style file path
  const getStyleFilePath = () => {
    if (!style?.file_path) return '';

    // Replace /Users/<username> with ~ for cleaner display
    const homeDir = style.file_path.match(/^\/Users\/[^/]+/)?.[0];
    const displayPath = homeDir ? style.file_path.replace(homeDir, '~') : style.file_path;
    return displayPath;
  };

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      <DebugLabel label="CreateOutputStyle" />
      <TabPageLayout
        title={isEditMode
          ? formatStyleName(name || style?.name || '')
          : "Create Output Style"
        }
        path={isEditMode ? getStyleFilePath() : undefined}
        subtitle={!isEditMode ? "Create a new Claude Code output style" : undefined}
        onBack={handleBack}
        actions={renderActions()}
        contentPadding={false}
      >
        <div className="h-full flex flex-col">
          <div className="container mx-auto py-6 flex-1 min-h-0 flex flex-col">
            <div className="bg-background text-foreground relative h-full flex flex-col">
              {/* Error display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mx-4 mt-4"
                >
                  <StatusMessage
                    type="error"
                    message={error}
                    onDismiss={() => setError(null)}
                  />
                </motion.div>
              )}

              {/* Tabbed Form */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full flex flex-col flex-1 min-h-0 gap-2"
              >
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="properties" className="gap-2 hover:bg-accent">
                    <Settings className="h-4 w-4" />
                    Properties
                  </TabsTrigger>
                  <TabsTrigger value="prompt" className="gap-2 hover:bg-accent">
                    <FileText className="h-4 w-4" />
                    System Prompt
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="properties" className="flex-1 min-h-0">
                  <Card className="flex flex-col h-full pb-3">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="relative flex flex-col h-full"
                    >
                      {/* Fixed header */}
                      <div className="p-6 pb-3">
                        <h3 className="text-lg font-semibold text-accent">Properties</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Configure your output style's basic settings
                        </p>
                      </div>

                      {/* Scrollable content */}
                      <div className="flex-1 min-h-0 overflow-auto px-6">
                        <div className="space-y-4">
                          {/* Name */}
                          <div className="space-y-2">
                            <Label htmlFor="name">Style Name</Label>
                            <Input
                              id="name"
                              value={name}
                              onChange={(e) => {
                                const converted = toSnakeCase(e.target.value);
                                setName(converted);
                              }}
                              placeholder="e.g., concise, educational, code-reviewer"
                              required
                              className={cn(
                                "w-full font-mono",
                                name && !isValidSnakeCase(name) && "border-destructive"
                              )}
                            />
                            <p className="text-xs text-muted-foreground">
                              Must be kebab-case: lowercase letters, numbers, and dashes only (will become {name || 'style-name'}.md)
                            </p>
                          </div>

                          {/* Description */}
                          <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Brief description of this output style's purpose..."
                              rows={4}
                              className="w-full resize-none min-h-[80px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              Describe when and how to use this output style
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Card>
                </TabsContent>

                <TabsContent value="prompt" className="flex-1 min-h-0">
                  <Card className="flex flex-col h-full pb-3">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="h-full flex flex-col"
                    >
                      {/* Fixed header */}
                      <div className="p-6 pb-3">
                        <h3 className="text-lg font-semibold text-accent">System Prompt</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Define the instructions and behavior modifications for this output style
                        </p>
                      </div>

                      {/* Editor content */}
                      <div className="flex-1 min-h-0 px-6">
                        <ThemedMDEditor
                          value={content}
                          onChange={(val) => setContent(val || "")}
                          height="100%"
                        />
                      </div>
                    </motion.div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
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

      {/* Unsaved Changes Dialog */}
      <ConfirmationDialog
        isOpen={showUnsavedDialog}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave?"
        confirmText="Leave"
        cancelText="Stay"
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
        variant="destructive"
      />

      {/* Overwrite Style Dialog */}
      <ConfirmationDialog
        isOpen={showOverwriteDialog}
        title="Output Style Already Exists"
        description={`An output style named "${style?.name}" already exists at the user level. Do you want to overwrite it with this project-level style?`}
        confirmText="Overwrite"
        cancelText="Cancel"
        onConfirm={() => {
          setShowOverwriteDialog(false);
          handleMoveToUserLevel(true); // Call with overwrite=true
        }}
        onCancel={() => setShowOverwriteDialog(false)}
        variant="destructive"
      />
    </div>
  );
};
