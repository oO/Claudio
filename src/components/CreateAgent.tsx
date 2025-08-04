import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { api, type Agent } from "@/lib/api";
import { cn } from "@/lib/utils";
import MDEditor from "@uiw/react-md-editor";
import { type AgentIconName } from "./CCAgents";

// Available agent colors
const AGENT_COLORS = [
  { name: "Red", value: "Red", bgClass: "bg-red-500", hoverClass: "hover:bg-red-600" },
  { name: "Blue", value: "Blue", bgClass: "bg-blue-500", hoverClass: "hover:bg-blue-600" },
  { name: "Green", value: "Green", bgClass: "bg-green-500", hoverClass: "hover:bg-green-600" },
  { name: "Yellow", value: "Yellow", bgClass: "bg-yellow-500", hoverClass: "hover:bg-yellow-600" },
  { name: "Purple", value: "Purple", bgClass: "bg-purple-500", hoverClass: "hover:bg-purple-600" },
  { name: "Orange", value: "Orange", bgClass: "bg-orange-500", hoverClass: "hover:bg-orange-600" },
  { name: "Pink", value: "Pink", bgClass: "bg-pink-500", hoverClass: "hover:bg-pink-600" },
  { name: "Cyan", value: "Cyan", bgClass: "bg-cyan-500", hoverClass: "hover:bg-cyan-600" },
] as const;

// Claude Code tool categories and individual tools
const TOOL_CATEGORIES = [
  { name: "All tools", value: "all", description: "Access to all available tools" },
  { name: "Read-only tools", value: "read-only", description: "Tools that only read/view information" },
  { name: "Edit tools", value: "edit", description: "Tools that can modify files or content" },
  { name: "Execution tools", value: "execution", description: "Tools that can execute code or commands" },
] as const;

const INDIVIDUAL_TOOLS = [
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
] as const;

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
}) => {
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [color, setColor] = useState(agent?.color || "Blue");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [model, setModel] = useState(agent?.model || "inherit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  
  // Tool selection state
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize tool selection from agent data
  useEffect(() => {
    if (agent?.tools) {
      const toolsList = agent.tools.split(',').map(t => t.trim());
      setSelectedTools(new Set(toolsList));
      
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
  
  // Helper to get tools as string
  const getToolsString = () => {
    return Array.from(selectedTools).sort().join(', ');
  };
  
  // Check if form has changes
  const hasChanges = isEditMode && (
    name !== (agent?.name || "") || 
    description !== (agent?.description || "") ||
    color !== (agent?.color || "Blue") ||
    systemPrompt !== (agent?.system_prompt || "") ||
    model !== (agent?.model || "inherit") ||
    getToolsString() !== (agent?.tools || "")
  );

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
        const existingAgents = await api.listAgents();
        const nameExists = existingAgents.some(a => a.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          setError(`An agent named "${name}" already exists. Please choose a different name.`);
          return;
        }
      } catch (err) {
        console.error("Failed to check for name conflicts:", err);
      }
    } else if (!isEditMode) {
      // For new agents, always check for conflicts
      try {
        const existingAgents = await api.listAgents();
        const nameExists = existingAgents.some(a => a.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          setError(`An agent named "${name}" already exists. Please choose a different name.`);
          return;
        }
      } catch (err) {
        console.error("Failed to check for name conflicts:", err);
      }
    }

    try {
      setSaving(true);
      setError(null);
      
      const toolsString = getToolsString();
      
      if (isEditMode && agent?.id) {
        await api.updateAgent(
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
        await api.createAgent(
          name, 
          systemPrompt, 
          undefined, // default_task not supported by Claude Native Agents
          model,
          description,
          toolsString,
          color
        );
      }
      
      onAgentCreated();
    } catch (err) {
      console.error("Failed to save agent:", err);
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
    if ((name !== (agent?.name || "") || 
         description !== (agent?.description || "") ||
         color !== (agent?.color || "Blue") ||
         systemPrompt !== (agent?.system_prompt || "") ||
         model !== (agent?.model || "inherit")) && 
        !confirm("You have unsaved changes. Are you sure you want to leave?")) {
      return;
    }
    onBack();
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {isEditMode ? (
                  <>
                    Edit the{' '}
                    <span className={cn(
                      "px-2 py-1 rounded text-white text-sm",
                      color && AGENT_COLORS.find(c => c.value === color)?.bgClass
                    )}>
                      {name || agent?.name}
                    </span>
                    {' '}Agent
                  </>
                ) : (
                  "Create Personal Agent"
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode ? "Update your Claude Code agent" : "Create a new Claude Code agent"}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemPrompt.trim() || (isEditMode && !hasChanges)}
            size="sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
        </motion.div>
        
        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-4 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}
        
        {/* Form */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-4">Basic Information</h3>
                  </div>
              
              {/* Name and Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Code Assistant"
                    required
                    className={cn(
                      "w-full",
                      // Apply color background except for default state (when color is Blue and it's the initial value)
                      color && (color !== "Blue" || agent?.color) && AGENT_COLORS.find(c => c.value === color)?.bgClass,
                      color && (color !== "Blue" || agent?.color) && "text-white placeholder:text-white/70"
                    )}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Agent Color</Label>
                  <div
                    onClick={() => setShowColorPicker(true)}
                    className="h-10 px-3 py-2 bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const selectedColorData = AGENT_COLORS.find(c => c.value === color) || AGENT_COLORS[1]; // Default to Blue
                        return (
                          <>
                            <div className={cn("w-4 h-4 rounded", selectedColorData.bgClass)} />
                            <span className="text-sm">{selectedColorData.name}</span>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    // Auto-expand on change as well
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  placeholder="Brief description of when to use this agent"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-hidden"
                  style={{ 
                    minHeight: '42px',
                    height: 'auto'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
              </div>

              {/* Tools */}
              <div className="space-y-2">
                <Label>Tools</Label>
                <div
                  onClick={() => setShowToolPicker(true)}
                  className="h-10 px-3 py-2 bg-background border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {selectedTools.size === 0 
                        ? "Select tools..." 
                        : selectedCategories.has('all')
                          ? "All tools"
                          : Array.from(selectedTools).sort().join(', ')
                      }
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>


              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Model</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModel("inherit")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "inherit" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-start gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "inherit" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "inherit" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Inherit</div>
                        <div className="text-xs opacity-80">Use Claude Code's default</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setModel("opus")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "opus" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-start gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "opus" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "opus" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Opus</div>
                        <div className="text-xs opacity-80">Most capable, best for complex tasks</div>
                      </div>
                    </div>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModel("sonnet")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "sonnet" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-start gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "sonnet" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "sonnet" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Sonnet</div>
                        <div className="text-xs opacity-80">Fast, efficient for most tasks</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setModel("haiku")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      model === "haiku" 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-start gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        model === "haiku" ? "border-primary-foreground" : "border-current"
                      )}>
                        {model === "haiku" && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">Haiku</div>
                        <div className="text-xs opacity-80">Fastest, lightweight for simple tasks</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* System Prompt Editor */}
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Define the behavior and capabilities of your CC Agent
                </p>
                <div className="rounded-lg border border-border overflow-hidden shadow-sm" data-color-mode="dark">
                  <MDEditor
                    value={systemPrompt}
                    onChange={(val) => setSystemPrompt(val || "")}
                    preview="edit"
                    height={400}
                    visibleDragbar={false}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
  
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
  {showColorPicker && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Choose Agent Color</h3>
        <div className="grid grid-cols-2 gap-3">
          {AGENT_COLORS.map((colorOption) => (
            <button
              key={colorOption.value}
              onClick={() => {
                setColor(colorOption.value);
                setShowColorPicker(false);
              }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                color === colorOption.value
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className={cn("w-6 h-6 rounded", colorOption.bgClass)} />
              <span className={cn(
                "text-sm font-medium",
                color === colorOption.value && "text-primary font-semibold"
              )}>{colorOption.name}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            onClick={() => setShowColorPicker(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )}

  {/* Tool Picker Dialog */}
  {showToolPicker && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Choose Agent Tools</h3>
        
        {/* Tool Categories - 2 column responsive */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Tool Categories</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TOOL_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  onClick={() => handleCategoryToggle(category.value)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                    selectedCategories.has(category.value)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
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
                    <div className="text-xs text-muted-foreground">{category.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <hr className="border-border" />

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? 'Hide individual tools' : 'Show individual tools'}
            <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {/* Individual Tools - 2 column responsive */}
          {showAdvanced && (
            <div>
              <h4 className="text-sm font-medium mb-3">Individual Tools</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INDIVIDUAL_TOOLS.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => handleToolToggle(tool.name)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                      selectedTools.has(tool.name)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
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
                      <div className="text-xs text-muted-foreground">{tool.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {selectedTools.size} of {INDIVIDUAL_TOOLS.length} tools selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowToolPicker(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowToolPicker(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
  );
}; 
