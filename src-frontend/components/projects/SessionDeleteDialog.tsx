import React, { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

interface SessionDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onSessionsDeleted: (result: {
    sessions_deleted: number;
    todos_deleted: number;
    timelines_deleted: number;
    size_freed_mb: number;
    sessions_remaining: number;
  }) => void;
}

interface SessionAgeRange {
  newest_age_days: number;
  oldest_age_days: number;
  total_sessions: number;
  has_sessions: boolean;
}

interface SessionDeletionPreview {
  sessions_to_delete: any[];
  sessions_to_keep: any[];
  total_sessions: number;
  sessions_to_delete_count: number;
  sessions_to_keep_count: number;
  size_to_free_mb: number;
}

export const SessionDeleteDialog: React.FC<SessionDeleteDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSessionsDeleted,
}) => {
  const [sessionDeletionAge, setSessionDeletionAge] = useState(30);
  const [sessionDeletionPreview, setSessionDeletionPreview] = useState<SessionDeletionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sessionAgeRange, setSessionAgeRange] = useState<SessionAgeRange | null>(null);
  const [ageRangeLoading, setAgeRangeLoading] = useState(false);
  const [isDeletingSessions, setIsDeletingSessions] = useState(false);

  // Load session age range when dialog opens
  useEffect(() => {
    if (open && projectId) {
      loadSessionAgeRange(projectId);
    }
  }, [open, projectId]);

  // Load preview when age range is loaded
  useEffect(() => {
    if (sessionAgeRange && projectId && open) {
      loadSessionDeletionPreview(projectId, sessionDeletionAge);
    }
  }, [sessionAgeRange, projectId, open, sessionDeletionAge]);

  const loadSessionAgeRange = async (projectId: string) => {
    setAgeRangeLoading(true);
    try {
      const ageRange = await api.getSessionAgeRange(projectId);
      setSessionAgeRange(ageRange);

      // Set initial age to middle of the range, but at least the newest + some buffer
      if (ageRange.has_sessions) {
        const middleAge = Math.floor(
          (ageRange.newest_age_days + ageRange.oldest_age_days) / 2,
        );
        const defaultAge = Math.max(middleAge, ageRange.newest_age_days + 1);
        setSessionDeletionAge(defaultAge);
      }
    } catch (error) {
      logger.error("Failed to load session age range:", error);
      setSessionAgeRange(null);
    } finally {
      setAgeRangeLoading(false);
    }
  };

  const loadSessionDeletionPreview = async (
    projectId: string,
    daysOld: number,
  ) => {
    setPreviewLoading(true);
    try {
      const preview = await api.previewSessionDeletionByAge(projectId, daysOld);
      setSessionDeletionPreview(preview);
    } catch (error) {
      logger.error("Failed to load session deletion preview:", error);
      setSessionDeletionPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSessionAgeChange = async (newAge: number) => {
    setSessionDeletionAge(newAge);
    if (projectId && open) {
      await loadSessionDeletionPreview(projectId, newAge);
    }
  };

  const handleSessionsDeleted = async () => {
    setIsDeletingSessions(true);
    try {
      logger.log("Deleting sessions older than", sessionDeletionAge, "days");

      const result = await api.deleteSessionsByAge(projectId, sessionDeletionAge);

      logger.log("Session deletion completed:", result);

      // Close dialog and reset state
      onOpenChange(false);
      setSessionDeletionPreview(null);
      setSessionAgeRange(null);

      // Notify parent with results
      onSessionsDeleted(result);
    } catch (error) {
      logger.error("Failed to delete sessions:", error);
      // You could add error toast here if needed
    } finally {
      setIsDeletingSessions(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSessionDeletionPreview(null);
    setSessionAgeRange(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delete Old Sessions</DialogTitle>
          <DialogDescription>
            Delete sessions older than a specified number of days for project "{projectName}".
            <br />
            <br />
            <strong>Note:</strong> This will permanently delete sessions, their todos, and timelines. Your project source code remains untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Age selector */}
          <div className="space-y-4">
            {ageRangeLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">
                  Loading session ages...
                </span>
              </div>
            ) : sessionAgeRange?.has_sessions ? (
              <div>
                <Label className="text-sm font-medium">
                  Delete sessions older than {sessionDeletionAge} days:
                </Label>

                {/* Dynamic slider based on actual session range */}
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <input
                      type="range"
                      min={sessionAgeRange.newest_age_days}
                      max={sessionAgeRange.oldest_age_days}
                      value={sessionDeletionAge}
                      onChange={(e) =>
                        handleSessionAgeChange(parseInt(e.target.value))
                      }
                      className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(to right, #22c55e 0%, #f97316 50%, #ef4444 100%)",
                        outline: "none",
                      }}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Newest ({sessionAgeRange.newest_age_days}d)</span>
                      <span>Oldest ({sessionAgeRange.oldest_age_days}d)</span>
                    </div>
                  </div>

                  {/* Age indicator */}
                  <div className="text-center">
                    <div className="inline-flex items-center space-x-2 bg-muted px-3 py-1 rounded-full">
                      <span className="text-sm font-medium">
                        Deleting sessions older than {sessionDeletionAge} days
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : sessionAgeRange && !sessionAgeRange.has_sessions ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No sessions found in this project.
                </p>
              </div>
            ) : null}
          </div>

          {/* Preview section */}
          {previewLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">
                Loading preview...
              </span>
            </div>
          ) : sessionDeletionPreview ? (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium">Deletion Preview:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Sessions to delete:
                    </span>
                    <span className="font-medium text-destructive">
                      {sessionDeletionPreview.sessions_to_delete_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Sessions to keep:
                    </span>
                    <span className="font-medium text-green-600">
                      {sessionDeletionPreview.sessions_to_keep_count}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total sessions:</span>
                    <span className="font-medium">
                      {sessionDeletionPreview.total_sessions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Storage freed:</span>
                    <span className="font-medium">
                      {sessionDeletionPreview.size_to_free_mb.toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </div>

              {sessionDeletionPreview.sessions_to_delete_count === 0 && (
                <div className="text-sm text-muted-foreground mt-3 p-3 bg-background rounded border">
                  No sessions older than {sessionDeletionAge} days found.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isDeletingSessions}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSessionsDeleted}
            disabled={
              isDeletingSessions ||
              !sessionDeletionPreview ||
              sessionDeletionPreview.sessions_to_delete_count === 0
            }
          >
            {isDeletingSessions ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {sessionDeletionPreview?.sessions_to_delete_count || 0} Sessions
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};