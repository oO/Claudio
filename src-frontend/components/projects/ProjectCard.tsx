import React from "react";
import { motion } from "framer-motion";
import { Folder, MessagesSquare, HardDrive, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DebugLabel } from "@/components/ui/atoms";
import { type Project } from "@/lib/api";
import { prettifyProjectName } from "@/lib/utils";
import { formatFileSize, formatTimeAgo } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project, event: React.MouseEvent) => void;
  className?: string;
  animationDelay?: number;
}

/**
 * Card component for displaying projects in a list
 * Click card to navigate to project detail view
 */
export function ProjectCard({ project, onClick, className, animationDelay = 0 }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      onClick={(event) => onClick(project, event)}
      className={cn(
        "group relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer",
        className,
      )}
      data-testid="project-card"
      data-project-id={project.id}
    >
      <DebugLabel label="ProjectCard" />
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 p-2">
          <Folder className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate mb-1">
            {prettifyProjectName(project.path)}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate mb-2">
            {project.path}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <span>{formatFileSize(project.total_size_bytes || 0)}</span>
            </div>
            {project.last_active && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTimeAgo(project.last_active * 1000)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="flex items-center gap-1 bg-accent"
        >
          <MessagesSquare className="h-3 w-3" />
          {project.session_count}
        </Badge>
      </div>
    </motion.div>
  );
}
