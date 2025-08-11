/**
 * ProjectSettings component for managing project-specific hooks configuration
 */

import React, { useState, useEffect } from 'react';
import { HooksEditor } from '@/components/settings';
import { SlashCommandsManager, ToolPermissionsManager } from '@/components/common';
import { useLocalProjectSettings } from '@/hooks';
import { api } from '@/lib/api';
import { DebugLabel } from '@/components/ui/atoms';
import { 
  AlertTriangle, 
  ArrowLeft, 
  Settings,
  FolderOpen,
  GitBranch,
  Shield,
  Command,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Toast, ToastContainer } from '@/components/ui/toast';
import type { Project } from '@/lib/api';

interface ProjectSettingsProps {
  project: Project;
  onBack: () => void;
  className?: string;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  project,
  onBack,
  className
}) => {
  const [activeTab, setActiveTab] = useState('commands');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Project settings for tool permissions (base + local)
  const {
    baseSettings,
    localSettings,
    mergedSettings,
    loading: settingsLoading,
    saving: settingsSaving,
    allowRules: baseAllowRules,
    denyRules: baseDenyRules,
    localAllowRules,
    localDenyRules,
    loadSettings: loadProjectSettings,
    saveLocalSettings,
    addLocalPermissionRule,
    updateLocalPermissionRule,
    removeLocalPermissionRule,
  } = useLocalProjectSettings((success, message) => {
    setToast({ message, type: success ? "success" : "error" });
  });
  
  // Other hooks settings
  const [gitIgnoreLocal, setGitIgnoreLocal] = useState(true);

  useEffect(() => {
    checkGitIgnore();
    loadProjectSettings(project.path);
  }, [project, loadProjectSettings]);

  const checkGitIgnore = async () => {
    try {
      // Check if .claude/settings.local.json is in .gitignore
      const gitignorePath = `${project.path}/.gitignore`;
      const gitignoreContent = await api.readClaudeMdFile(gitignorePath);
      setGitIgnoreLocal(gitignoreContent.includes('.claude/settings.local.json'));
    } catch {
      // .gitignore might not exist
      setGitIgnoreLocal(false);
    }
  };

  const addToGitIgnore = async () => {
    try {
      const gitignorePath = `${project.path}/.gitignore`;
      let content = '';
      
      try {
        content = await api.readClaudeMdFile(gitignorePath);
      } catch {
        // File doesn't exist, create it
      }
      
      if (!content.includes('.claude/settings.local.json')) {
        content += '\n# Claude local settings (machine-specific)\n.claude/settings.local.json\n';
        await api.saveClaudeMdFile(gitignorePath, content);
        setGitIgnoreLocal(true);
        setToast({ message: 'Added to .gitignore', type: 'success' });
      }
    } catch (err) {
      console.error('Failed to update .gitignore:', err);
      setToast({ message: 'Failed to update .gitignore', type: 'error' });
    }
  };

  const handleSavePermissions = async () => {
    await saveLocalSettings(project.path);
    // Also ensure local settings are in .gitignore
    if (!gitIgnoreLocal) {
      await addToGitIgnore();
    }
  };

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      <DebugLabel label="ProjectSettings" />
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Project Settings</h2>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="font-mono">{project.path}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="commands" className="gap-2">
                <Command className="h-4 w-4" />
                Slash Commands
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <Lock className="h-4 w-4" />
                Tool Permissions
              </TabsTrigger>
              <TabsTrigger value="project" className="gap-2">
                <GitBranch className="h-4 w-4" />
                Project Hooks
              </TabsTrigger>
              <TabsTrigger value="local" className="gap-2">
                <Shield className="h-4 w-4" />
                Local Hooks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="commands" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Project Slash Commands</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Custom commands that are specific to this project. These commands are stored in
                      <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">.claude/slash-commands/</code>
                      and can be committed to version control.
                    </p>
                  </div>
                  
                  <SlashCommandsManager
                    projectPath={project.path}
                    scopeFilter="project"
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Local Tool Permissions</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Override global tool permissions for this project. Settings are stored in
                        <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">.claude/settings.local.json</code>
                        and are machine-specific (not committed to version control).
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleSavePermissions}
                      disabled={settingsLoading || settingsSaving}
                      size="sm"
                      className="gap-2"
                    >
                      {settingsSaving ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          Save Local Overrides
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {!gitIgnoreLocal && (
                    <div className="flex items-center gap-4 p-3 bg-yellow-500/10 rounded-md">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <div className="flex-1">
                        <p className="text-sm text-yellow-600">
                          Local settings file should be added to .gitignore
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addToGitIgnore}
                      >
                        Add to .gitignore
                      </Button>
                    </div>
                  )}
                  
                  {/* Base Settings Display (Read-only) */}
                  {(baseAllowRules.length > 0 || baseDenyRules.length > 0) && (
                    <div className="space-y-3">
                      <div className="border border-muted rounded-md p-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">
                          Base Project Settings (.claude/settings.json)
                        </h4>
                        <div className="space-y-2">
                          {baseAllowRules.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-green-500">Allow: </span>
                              {baseAllowRules.map((rule, index) => (
                                <span key={rule.id} className="text-xs text-muted-foreground">
                                  {rule.value}{index < baseAllowRules.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {baseDenyRules.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-red-500">Deny: </span>
                              {baseDenyRules.map((rule, index) => (
                                <span key={rule.id} className="text-xs text-muted-foreground">
                                  {rule.value}{index < baseDenyRules.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Local Overrides (Editable) */}
                  <ToolPermissionsManager
                    allowRules={localAllowRules}
                    denyRules={localDenyRules}
                    onAddRule={addLocalPermissionRule}
                    onUpdateRule={updateLocalPermissionRule}
                    onRemoveRule={removeLocalPermissionRule}
                    scope="local"
                    title="Local Permission Overrides"
                    description="Override project permissions for this machine only. These settings take precedence over base project settings."
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="project" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Project Hooks</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      These hooks apply to all users working on this project. They are stored in
                      <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">.claude/settings.json</code>
                      and should be committed to version control.
                    </p>
                  </div>
                  
                  <HooksEditor
                    projectPath={project.path}
                    scope="project"
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="local" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Local Hooks</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      These hooks only apply to your machine. They are stored in
                      <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">.claude/settings.local.json</code>
                      and should NOT be committed to version control.
                    </p>
                    
                    {!gitIgnoreLocal && (
                      <div className="flex items-center gap-4 p-3 bg-yellow-500/10 rounded-md">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div className="flex-1">
                          <p className="text-sm text-yellow-600">
                            Local settings file is not in .gitignore
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={addToGitIgnore}
                        >
                          Add to .gitignore
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <HooksEditor
                    projectPath={project.path}
                    scope="local"
                  />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Toast Container */}
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
