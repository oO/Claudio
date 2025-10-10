import React, { useState } from "react";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { DebugLabel } from "@/components/ui/atoms";
import { ProjectCard } from "./ProjectCard";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project, event?: React.MouseEvent) => void;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback to report visible range for position label
   */
  onPositionChange?: (start: number, end: number, total: number) => void;
}

const ITEMS_PER_PAGE = 12;

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
  onPositionChange,
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

  // Report position changes to parent
  React.useEffect(() => {
    const displayStart = startIndex + 1;
    const displayEnd = Math.min(endIndex, projects.length);
    onPositionChange?.(displayStart, displayEnd, projects.length);
  }, [startIndex, endIndex, projects.length]); // onPositionChange intentionally omitted - it's just a callback

  return (
    <div className={cn("space-y-3 relative", className)}>
      <DebugLabel label="ProjectList" />

      {/* Project cards */}
      <div className="space-y-3">
        {currentProjects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={onProjectClick}
            animationDelay={index * 0.05}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
