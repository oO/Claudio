import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { api, type Agent } from "@/lib/api";
import { AGENT_COLORS, LEGACY_AGENT_COLORS, getAgentColor, type AgentColorName } from "@/lib/agentColors";
import { cn } from "@/lib/utils";
import { ThemedMDEditor } from "@/components/ui";
import { ExampleEditor, type Example } from "@/components/common";

// Atomic Design System imports
import { 
  ActionButton,
  LoadingSpinner,
  AgentIcon,
  ColorSwatch,
  RadioOption
} from "@/components/ui/atoms";
import { 
  StatusMessage,
  ActionButtonGroup,
  DropdownSelector
} from "@/components/ui/molecules";
import { 
  ConfirmationDialog,
  ColorPickerDialog,
  ToolPickerDialog,
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
  // Ensure the color is valid - fallback to Blue if the agent color doesn't match our types
  const getValidColor = (colorValue?: string): AgentColorName => {
    const validColors: AgentColorName[] = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan'];
    if (colorValue && validColors.includes(colorValue as AgentColorName)) {
      return colorValue as AgentColorName;
    }
    return "Blue";
  };
  
  const [color, setColor] = useState<AgentColorName>(getValidColor(agent?.color));
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [model, setModel] = useState(agent?.model || "inherit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [, setExamples] = useState<Example[]>([]);
  
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
        // Silent error - name conflict check failed
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
        // Silent error - name conflict check failed
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
            <ActionButton
              icon={ArrowLeft}
              label="Back"
              showLabel={false}
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            />
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {isEditMode ? (
                  <>
                    Edit the{' '}
                    <span className={cn(
                      "px-2 py-1 rounded text-white text-sm",
                      getAgentColor(color || "Blue").solidClass
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
          
          <ActionButton
            icon={Save}
            label={saving ? "Saving..." : "Save"}
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemPrompt.trim() || (isEditMode && !hasChanges)}
            size="sm"
            isLoading={saving}
          />
        </motion.div>
        
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
                      color && (color !== "Blue" || agent?.color) && getAgentColor(color).cssClass
                    )}
                  />
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
                </div>
              </div>

              {/* Description and Examples */}
              <div className="space-y-2">
                <ExampleEditor
                  description={description}
                  onDescriptionChange={setDescription}
                  onExamplesChange={setExamples}
                />
              </div>

              {/* Tools */}
              <div className="space-y-2">
                <Label>Tools</Label>
                <DropdownSelector
                  label="Tools"
                  value={selectedTools.size === 0 
                    ? "" 
                    : selectedCategories.has('all')
                      ? "All tools"
                      : Array.from(selectedTools).sort().join(', ')
                  }
                  placeholder="Select tools..."
                  onClick={() => setShowToolPicker(true)}
                />
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
              </div>

              {/* System Prompt Editor */}
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Define the behavior and capabilities of your CC Agent
                </p>
                <ThemedMDEditor
                  value={systemPrompt}
                  onChange={(val) => setSystemPrompt(val || "")}
                  height={400}
                />
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
  <ColorPickerDialog
    isOpen={showColorPicker}
    selectedColor={color}
    colors={LEGACY_AGENT_COLORS}
    onColorSelect={(color: string) => setColor(color as AgentColorName)}
    onClose={() => setShowColorPicker(false)}
    title="Choose Agent Color"
  />

  {/* Tool Picker Dialog */}
  <ToolPickerDialog
    isOpen={showToolPicker}
    selectedCategories={selectedCategories}
    selectedTools={selectedTools}
    categories={TOOL_CATEGORIES}
    tools={INDIVIDUAL_TOOLS}
    onCategoryToggle={handleCategoryToggle}
    onToolToggle={handleToolToggle}
    onClose={() => setShowToolPicker(false)}
    title="Choose Agent Tools"
  />
</div>
  );
}; 
