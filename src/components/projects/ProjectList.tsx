import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Folder,
  MessagesSquare,
  HardDrive,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/date-utils";
import { Pagination } from "@/components/ui/pagination";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project) => void;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 12;

/**
 * Extracts the project name from the full path
 */
const getProjectName = (path: string): string => {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
};

/**
 * ProjectList component - Displays a paginated list of projects with hover animations
 *
 * @example
 * <ProjectList
 *   projects={projects}
 *   onProjectClick={(project) => handleProjectClick(project)}
 * />
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProjects = projects.slice(startIndex, endIndex);

  // Reset to page 1 if projects change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [projects.length]);

  // Format file size from bytes
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {currentProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Card
              className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer group h-full"
              onClick={() => onProjectClick(project)}
            >
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Folder className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold text-base truncate">
                        {getProjectName(project.path)}
                      </h3>
                    </div>
                    {project.sessions.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 ml-2 flex items-center gap-1"
                      >
                        <MessagesSquare className="h-3 w-3" />
                        {project.sessions.length}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 font-mono truncate">
                    {project.path}
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Project stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{formatFileSize(project.total_size_bytes)}</span>
                      </div>
                      {project.last_active && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatTimeAgo(project.last_active * 1000)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
