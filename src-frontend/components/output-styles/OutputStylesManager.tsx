import React, { useState, useEffect } from "react";
import { Plus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { outputStylesApi, type OutputStyle } from "@/lib/api";
import { OutputStyleCard } from "./OutputStyleCard";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';

interface OutputStylesManagerProps {
  /**
   * Optional project path - if provided, loads project styles, otherwise loads global styles
   */
  projectPath?: string;
  /**
   * Callback when a style is edited
   */
  onEditStyle?: (style: OutputStyle) => void;
  /**
   * Callback when a style is deleted
   */
  onDeleteStyle?: (style: OutputStyle) => void;
  /**
   * Callback when create style is clicked
   */
  onCreateStyle?: () => void;
  /**
   * Callback when import style is clicked
   */
  onImportStyle?: () => void;
  /**
   * Callback to report visible range for position label
   */
  onPositionChange?: (start: number, end: number, total: number) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Shared OutputStylesManager component that displays the create/import buttons and style cards
 * Used both directly in Global Output Styles and inside the collapsible wrapper for Project Styles
 */
export const OutputStylesManager: React.FC<OutputStylesManagerProps> = ({
  projectPath,
  onEditStyle,
  onDeleteStyle,
  onCreateStyle,
  onImportStyle,
  onPositionChange,
  className,
}) => {
  const [styles, setStyles] = useState<OutputStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load styles when component mounts or when projectPath changes
  useEffect(() => {
    loadStyles();
  }, [projectPath]);

  // Report position changes to parent
  useEffect(() => {
    // For now, we show all styles (no pagination), so it's just 1 to total
    const total = styles.length;
    if (total > 0) {
      onPositionChange?.(1, total, total);
    } else {
      onPositionChange?.(0, 0, 0);
    }
  }, [styles.length]); // onPositionChange intentionally omitted - it's just a callback

  const loadStyles = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundStyles = await outputStylesApi.listOutputStyles(projectPath);
      setStyles(foundStyles);
    } catch (err) {
      logger.error("Failed to load output styles:", err);
      setError("Failed to load output styles");
    } finally {
      setLoading(false);
    }
  };

  const handleEditStyle = (style: OutputStyle) => {
    onEditStyle?.(style);
  };

  const handleDeleteStyle = (style: OutputStyle) => {
    onDeleteStyle?.(style);
  };

  return (
    <div className={cn("w-full relative flex flex-col h-full", className)}>
      <DebugLabel label="OutputStylesManager" />
      {/* Create and Import buttons */}
      {(onCreateStyle || onImportStyle) && (
        <div className="px-6 pb-2 flex-shrink-0">
          <div className="flex gap-2">
            {onCreateStyle && (
              <Button
                size="default"
                variant="outline"
                onClick={onCreateStyle}
                className="flex-1 h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Output Style
              </Button>
            )}
            {onImportStyle && (
              <Button
                size="default"
                variant="outline"
                onClick={onImportStyle}
                className="flex-1 h-10"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Output Style
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Styles List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="py-4 text-sm text-destructive text-center">{error}</div>
      ) : styles.length === 0 ? (
        <div className="py-8 text-sm text-muted-foreground text-center">
          {projectPath
            ? "No project output styles found in .claude/output-styles/"
            : "No global output styles found"}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto px-6">
          <div className="space-y-3">
          {styles.map((style, index) => (
            <OutputStyleCard
              key={style.name}
              style={style}
              onEdit={onEditStyle ? handleEditStyle : undefined}
              onDelete={onDeleteStyle ? handleDeleteStyle : undefined}
              animationDelay={index * 0.05}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
};
