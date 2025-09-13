import React from "react";
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
import type { Session } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";

interface ProjectDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ProjectDeleteDialog: React.FC<ProjectDeleteDialogProps> = ({
  open,
  onOpenChange,
  session,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  return (
    <>
      {open && <DebugLabel label="ProjectDeleteDialog" />}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Session</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this session? This action cannot be undone.
            {session && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium truncate">{session.first_message || "Untitled Session"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {session.message_count || 0} messages • {((session.size_bytes || 0) / 1024).toFixed(1)} KB
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Session
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};