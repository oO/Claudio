import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, MoreVertical, Bot, FileText, Shield } from "lucide-react";
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
import { agentsApi, type Agent } from "@/lib/api";
import { AGENT_COLORS, AGENT_COLOR_OPTIONS, getAgentColor, type AgentColorName } from "@/lib/agentColors";
import { cn } from "@/lib/utils";
import { ThemedMDEditor } from "@/components/ui";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { logger } from '@/lib/logger';

// Atomic Design System imports
import {
  ColorSwatch,
  RadioOption,
  DebugLabel,
  ActionButton
} from "@/components/ui/atoms";
import { 
  StatusMessage,
  ActionButtonGroup,
  DropdownSelector
} from "@/components/ui/molecules";
import {
  ConfirmationDialog,
  ColorPickerDialog,
  type ColorOption,
  type ToolCategory,
  type Tool
} from "@/components/ui/organisms";
// import { type AgentIconName } from "./CCAgents";

// Agent colors now imported from centralized definitions

// Claude Code tool categories and individual tools
const TOOL_CATEGORIES: ToolCategory[] = [
  { name: "All tools", value: "all", description: "Access to all available tools" },
  { name: "Read-only tools", value: "read-only", description: "Tools that only read/view information" },
  { name: "Edit tools", value: "edit", description: "Tools that can modify files or content" },
  { name: "Execution tools", value: "execution", description: "Tools that can execute code or commands" },
];

const INDIVIDUAL_TOOLS: Tool[] = [
  { name: "Task", category: "execution", description: "Launch specialized sub-agents" },
  { name: "Bash", category: "execution", description: "Execute shell commands" },
  { name: "Glob", category: "read-only", description: "Find files by pattern matching" },
  { name: "Grep", category: "read-only", description: "Search file contents" },
  { name: "LS", category: "read-only", description: "List directory contents" },
  { name: "ExitPlanMode", category: "execution", description: "Exit planning mode" },
  { name: "Read", category: "read-only", description: "Read file contents" },
  { name: "Edit", category: "edit", description: "Make targeted file edits" },
  { name: "MultiEdit", category: "edit", description: "Make multiple file edits" },
  { name: "Write", category: "edit", description: "Create or overwrite files" },
  { name: "NotebookRead", category: "read-only", description: "Read Jupyter notebooks" },
  { name: "NotebookEdit", category: "edit", description: "Edit Jupyter notebooks" },
  { name: "WebFetch", category: "read-only", description: "Retrieve content from URLs" },
  { name: "TodoWrite", category: "edit", description: "Manage task lists" },
  { name: "WebSearch", category: "read-only", description: "Perform web searches" },
];

interface CreateAgentProps {
  /**
   * Optional agent to edit (if provided, component is in edit mode)
   */
  agent?: Agent;
  /**
   * Callback to go back to the agents list
   */
  onBack: () => void;
  /**
   * Callback when agent is created/updated
   */
  onAgentCreated: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Optional project path (indicates this is a project-level agent)
   */
  projectPath?: string;
}

/**
 * CreateAgent component for creating or editing a CC agent
 * 
 * @example
 * <CreateAgent onBack={() => setView('list')} onAgentCreated={handleCreated} />
 */
export const CreateAgent: React.FC<CreateAgentProps> = ({
  agent,
  onBack,
  onAgentCreated,
  className,
  projectPath,
}) => {
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  // Ensure the color is valid - fallback to Blue if the agent color doesn't match our types
  const getValidColor = (colorValue?: string): AgentColorName => {
    const validColors: AgentColorName[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
    
    // Normalize the color value
    const normalizedColor = colorValue?.toLowerCase().trim();
    
    // Check if it's a valid color name
    if (normalizedColor && validColors.includes(normalizedColor as AgentColorName)) {
      return normalizedColor as AgentColorName;
    }
    
    // Try to get color from getAgentColor (handles hex values)
    const agentColor = getAgentColor(colorValue || '');
    if (agentColor.value !== 'grey') {
      return agentColor.value;
    }
    
    // Default to blue for editing (grey is only for display fallback)
    return "blue";
  };
  
  // Store the original color for comparison
  const originalColor = React.useMemo(() => getValidColor(agent?.color), [agent?.color]);
  const [color, setColor] = useState<AgentColorName>(originalColor);
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [model, setModel] = useState(agent?.model || "inherit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("properties");
  
  // Tool selection state - initialize from agent data
  const initialTools = agent?.tools ? new Set(agent.tools.split(',').map(t => t.trim())) : new Set<string>();
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTools, setSelectedTools] = useState<Set<string>>(initialTools);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize category selection from agent data
  useEffect(() => {
    if (agent?.tools) {
      const toolsList = agent.tools.split(',').map(t => t.trim());
      
      // Check if all tools are selected (All tools category)
      if (toolsList.length === INDIVIDUAL_TOOLS.length && 
          INDIVIDUAL_TOOLS.every(tool => toolsList.includes(tool.name))) {
        setSelectedCategories(new Set(['all']));
      } else {
        // Check which categories are fully selected
        const categories = new Set<string>();
        TOOL_CATEGORIES.forEach(category => {
          if (category.value !== 'all') {
            const categoryTools = INDIVIDUAL_TOOLS.filter(tool => tool.category === category.value);
            if (categoryTools.every(tool => toolsList.includes(tool.name))) {
              categories.add(category.value);
            }
          }
        });
        setSelectedCategories(categories);
      }
      
      // Show advanced if individual tools are selected
      if (toolsList.length > 0 && !selectedCategories.has('all')) {
        setShowAdvanced(true);
      }
    }
  }, [agent]);

  // Auto-resize description textarea when component mounts or description changes
  useEffect(() => {
    const textarea = document.getElementById('description') as HTMLTextAreaElement;
    if (textarea && description) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [description]);

  const isEditMode = !!agent;

  // Helper to transform agent name from "agent-builder" to "Agent Builder"
  const formatAgentName = (agentName: string) => {
    return agentName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper to get tools as string
  const getToolsString = () => {
    return Array.from(selectedTools).sort().join(', ');
  };
  
  // Check if form has changes - detailed comparison
  const nameChanged = name !== (agent?.name || "");
  const descriptionChanged = description !== (agent?.description || "");
  const colorChanged = color !== originalColor;
  const systemPromptChanged = systemPrompt !== (agent?.system_prompt || "");
  const modelChanged = model !== (agent?.model || "inherit");
  // Compare tools in sorted order since the order doesn't matter
  const normalizeTools = (toolsStr: string) => toolsStr.split(',').map(t => t.trim()).sort().join(', ');
  const toolsChanged = getToolsString() !== normalizeTools(agent?.tools || "");
  
  const hasChanges = isEditMode && (
    nameChanged || 
    descriptionChanged ||
    colorChanged ||
    systemPromptChanged ||
    modelChanged ||
    toolsChanged
  );
  
  // Automatically sync unsaved changes state with the tab
  const { markAsSaved } = useUnsavedChanges(hasChanges);
  

  // Tool management helpers
  const handleCategoryToggle = (categoryValue: string) => {
    const newCategories = new Set(selectedCategories);
    const newTools = new Set(selectedTools);

    if (categoryValue === 'all') {
      if (newCategories.has('all')) {
        // Unselect all
        newCategories.clear();
        newTools.clear();
      } else {
        // Select all
        newCategories.clear();
        newCategories.add('all');
        newTools.clear();
        INDIVIDUAL_TOOLS.forEach(tool => newTools.add(tool.name));
      }
    } else {
      // Handle specific category
      const categoryTools = INDIVIDUAL_TOOLS.filter(tool => tool.category === categoryValue);
      
      if (newCategories.has(categoryValue)) {
        // Unselect this category
        newCategories.delete(categoryValue);
        categoryTools.forEach(tool => newTools.delete(tool.name));
      } else {
        // Select this category
        newCategories.add(categoryValue);
        categoryTools.forEach(tool => newTools.add(tool.name));
      }
      
      // Remove 'all' if it was selected
      newCategories.delete('all');
    }

    setSelectedCategories(newCategories);
    setSelectedTools(newTools);
  };

  const handleToolToggle = (toolName: string) => {
    const newTools = new Set(selectedTools);
    const newCategories = new Set(selectedCategories);

    if (newTools.has(toolName)) {
      newTools.delete(toolName);
    } else {
      newTools.add(toolName);
    }

    // Update categories based on selected tools
    newCategories.clear();
    
    // Check if all tools are selected
    if (newTools.size === INDIVIDUAL_TOOLS.length && 
        INDIVIDUAL_TOOLS.every(tool => newTools.has(tool.name))) {
      newCategories.add('all');
    } else {
      // Check which categories are fully selected
      TOOL_CATEGORIES.forEach(category => {
        if (category.value !== 'all') {
          const categoryTools = INDIVIDUAL_TOOLS.filter(tool => tool.category === category.value);
          if (categoryTools.length > 0 && categoryTools.every(tool => newTools.has(tool.name))) {
            newCategories.add(category.value);
          }
        }
      });
    }

    setSelectedCategories(newCategories);
    setSelectedTools(newTools);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Agent name is required");
      return;
    }

    if (!systemPrompt.trim()) {
      setError("System prompt is required");
      return;
    }
    
    // Check for name conflicts if name changed
    if (isEditMode && name !== agent?.name) {
      try {
        // Get list of existing agents to check for conflicts
        const existingAgents = await agentsApi.listAgents();
        const nameExists = existingAgents.some(a => a.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          setError(`An agent named "${name}" already exists. Please choose a different name.`);
          return;
        }
      } catch (err) {
        // Silent error - name conflict check failed
      }
    } else if (!isEditMode) {
      // For new agents, always check for conflicts
      try {
        const existingAgents = await agentsApi.listAgents();
        const nameExists = existingAgents.some(a => a.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          setError(`An agent named "${name}" already exists. Please choose a different name.`);
          return;
        }
      } catch (err) {
        // Silent error - name conflict check failed
      }
    }

    try {
      setSaving(true);
      setError(null);
      
      const toolsString = getToolsString();
      
      if (isEditMode && agent?.id) {
        await agentsApi.updateAgent(
          agent.id, 
          name, 
          systemPrompt, 
          undefined, // default_task not supported by Claude Native Agents
          model,
          description,
          toolsString,
          color
        );
      } else {
        await agentsApi.createAgent(
          name, 
          systemPrompt, 
          undefined, // default_task not supported by Claude Native Agents
          model,
          description,
          toolsString,
          color
        );
      }
      
      markAsSaved(); // Clear the unsaved changes flag
      onAgentCreated();
    } catch (err) {
      logger.error("Failed to save agent:", err);
      setError(isEditMode ? "Failed to update agent" : "Failed to create agent");
      setToast({ 
        message: isEditMode ? "Failed to update agent" : "Failed to create agent", 
        type: "error" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    // Check if there are unsaved changes using the same logic as hasChanges
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
    if (!agent?.name || !agent?.file_path) return;

    // Extract project path from file_path
    // e.g., /Users/olivier/Projects/claudio/.claude/agents/commit-expert.md -> /Users/olivier/Projects/claudio
    const projectPathMatch = agent.file_path.match(/^(.*)\/\.claude\/agents\//);
    if (!projectPathMatch) {
      setError("Could not determine project path from agent file location");
      return;
    }
    const extractedProjectPath = projectPathMatch[1];

    try {
      setSaving(true);
      await agentsApi.moveAgentToUserLevel(agent.name, extractedProjectPath, overwrite);
      setToast({ message: "Agent moved to user level successfully!", type: "success" });
      setTimeout(() => {
        onAgentCreated(); // Refresh the list
      }, 500);
    } catch (error) {
      logger.error("Failed to move agent:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if error is about agent already existing
      if (errorMsg.includes('AGENT_EXISTS:')) {
        setShowOverwriteDialog(true);
      } else {
        setError(errorMsg.replace('AGENT_EXISTS:', ''));
      }
    } finally {
      setSaving(false);
    }
  };

  // Check if this is a project-level agent (not in user's ~/.claude/agents/)
  // User-level agents are ONLY in /Users/<username>/.claude/agents/
  // Everything else (any other path with /.claude/agents/) is a project agent
  const isUserLevelAgent = agent?.file_path?.match(/^\/Users\/[^/]+\/\.claude\/agents\//);
  const isProjectLevelAgent = agent?.file_path && !isUserLevelAgent;

  const renderActions = () => (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSave}
        disabled={saving || !name.trim() || !systemPrompt.trim() || (isEditMode && !hasChanges)}
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

      <DropdownMenu
        onOpenChange={(open) => {
          // Dropdown state change handled by component
        }}
      >
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
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => {
            // Menu close focus handled by component
          }}
        >
          {isEditMode && isProjectLevelAgent && (
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
            Export Agent
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logger.info('Duplicate clicked');
            }}
          >
            Duplicate Agent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Get the agent file path
  const getAgentFilePath = () => {
    if (!agent?.file_path) return '';

    // Replace /Users/<username> with ~ for cleaner display
    const homeDir = agent.file_path.match(/^\/Users\/[^/]+/)?.[0];
    const displayPath = homeDir ? agent.file_path.replace(homeDir, '~') : agent.file_path;
    return displayPath;
  };

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      <DebugLabel label="CreateAgent" />
      <TabPageLayout
        title={isEditMode
          ? formatAgentName(name || agent?.name || '')
          : "Create Global Agent"
        }
        path={isEditMode ? getAgentFilePath() : undefined}
        subtitle={!isEditMode ? "Create a new Claude Code agent" : undefined}
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
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="properties" className="gap-2 hover:bg-accent">
              <Bot className="h-4 w-4" />
              Agent Properties
            </TabsTrigger>
            <TabsTrigger value="prompt" className="gap-2 hover:bg-accent">
              <FileText className="h-4 w-4" />
              System Prompt
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2 hover:bg-accent">
              <Shield className="h-4 w-4" />
              Tool Permissions
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
                    <h3 className="text-lg font-semibold text-accent">Agent Properties</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure your agent's basic settings and behavior
                    </p>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 min-h-0 overflow-auto px-6">
                    <div className="space-y-4">
                    {/* Name and Color */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Agent Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., code-assistant"
                          required
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use kebab-case (e.g., agent-builder)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Agent Color</Label>
                        <DropdownSelector
                          label="Agent Color"
                          value={getAgentColor(color).name}
                          onClick={() => setShowColorPicker(true)}
                        >
                          <ColorSwatch
                            color={getAgentColor(color).name}
                            bgClass={getAgentColor(color).solidClass}
                            size="sm"
                          />
                        </DropdownSelector>
                        <p className="text-xs text-muted-foreground">
                          Visual identifier for your agent
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Use this agent when..."
                        rows={8}
                        className="w-full resize-none block"
                      />
                      <p className="text-xs text-muted-foreground">
                        Describe when and how to use this agent. This helps Claude delegate tasks automatically.
                      </p>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <RadioOption
                          id="inherit"
                          label="Inherit"
                          description="Use Claude Code's default"
                          selected={model === "inherit"}
                          onClick={() => setModel("inherit")}
                        />

                        <RadioOption
                          id="opus"
                          label="Opus"
                          description="Most capable, best for complex tasks"
                          selected={model === "opus"}
                          onClick={() => setModel("opus")}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <RadioOption
                          id="sonnet"
                          label="Sonnet"
                          description="Fast, efficient for most tasks"
                          selected={model === "sonnet"}
                          onClick={() => setModel("sonnet")}
                        />

                        <RadioOption
                          id="haiku"
                          label="Haiku"
                          description="Fastest, lightweight for simple tasks"
                          selected={model === "haiku"}
                          onClick={() => setModel("haiku")}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the AI model for this agent
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
                      Define the behavior and capabilities of your agent
                    </p>
                  </div>

                  {/* Editor content */}
                  <div className="flex-1 min-h-0 px-6">
                    <ThemedMDEditor
                      value={systemPrompt}
                      onChange={(val) => setSystemPrompt(val || "")}
                    />
                  </div>
                </motion.div>
              </Card>
            </TabsContent>

            <TabsContent value="tools" className="flex-1 min-h-0">
              <Card className="flex flex-col h-full pb-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="relative flex flex-col h-full"
                >
                  {/* Fixed header */}
                  <div className="p-6 pb-3">
                    <h3 className="text-lg font-semibold text-accent">Tool Permissions</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose which Claude Code tools this agent can access
                    </p>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 min-h-0 overflow-auto px-6">
                    <div className="space-y-4">
                      {/* Tool Categories */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Tool Categories</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {TOOL_CATEGORIES.map((category) => (
                            <button
                              key={category.value}
                              onClick={() => handleCategoryToggle(category.value)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors text-left",
                                selectedCategories.has(category.value) ? "text-accent" : ""
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategories.has(category.value)}
                                onChange={() => {}} // Handled by button onClick
                                className="w-4 h-4 rounded border-border pointer-events-none"
                              />
                              <div>
                                <div className="text-sm font-medium">{category.name}</div>
                                <div className="text-xs opacity-70">{category.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Separator */}
                      <hr className="border-border" />

                      {/* Individual Tools */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Individual Tools</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {INDIVIDUAL_TOOLS.map((tool) => (
                            <button
                              key={tool.name}
                              onClick={() => handleToolToggle(tool.name)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors text-left",
                                selectedTools.has(tool.name) ? "text-accent" : ""
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTools.has(tool.name)}
                                onChange={() => {}} // Handled by button onClick
                                className="w-4 h-4 rounded border-border pointer-events-none"
                              />
                              <div>
                                <div className="text-sm font-medium">{tool.name}</div>
                                <div className="text-xs opacity-70">{tool.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
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

  {/* Color Picker Dialog */}
  <ColorPickerDialog
    isOpen={showColorPicker}
    selectedColor={color}
    colors={AGENT_COLOR_OPTIONS}
    onColorSelect={(color: string) => setColor(color as AgentColorName)}
    onClose={() => setShowColorPicker(false)}
    title="Choose Agent Color"
  />

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

  {/* Overwrite Agent Dialog */}
  <ConfirmationDialog
    isOpen={showOverwriteDialog}
    title="Agent Already Exists"
    description={`An agent named "${agent?.name}" already exists at the user level. Do you want to overwrite it with this project-level agent?`}
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
