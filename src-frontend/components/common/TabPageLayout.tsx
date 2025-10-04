import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";

interface TabPageLayoutProps {
  /**
   * Main page title
   */
  title: string;
  /**
   * Optional subtitle/description
   */
  subtitle?: string;
  /**
   * Page content
   */
  children: React.ReactNode;
  /**
   * Optional className for additional styling
   */
  className?: string;
  /**
   * Whether to add padding to the content area (default: true)
   */
  contentPadding?: boolean;
  /**
   * Optional back button handler - if provided, shows back arrow
   */
  onBack?: () => void;
  /**
   * Optional action buttons (like Save, Cancel, etc.)
   */
  actions?: React.ReactNode;
  /**
   * Whether to show a loading state in actions area
   */
  loading?: boolean;
}

/**
 * Shared layout component for tab pages
 * Provides consistent header styling, navigation, and action buttons
 */
export const TabPageLayout: React.FC<TabPageLayoutProps> = ({
  title,
  subtitle,
  children,
  className,
  contentPadding = true,
  onBack,
  actions,
  loading = false,
}) => {
  return (
    <div
      id="TabPageLayout"
      className={cn("flex-1 min-h-0 flex flex-col bg-background relative", className)}
    >
      <DebugLabel label="TabPageLayout" />
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 border-b border-border"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-accent">{title}</h1>
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {actions && (
              <div
                id="TabActions"
                className="flex items-center gap-2 flex-shrink-0"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                ) : (
                  actions
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <div
          id="TabContent"
          className={cn("flex-1 min-h-0", contentPadding && "p-6")}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
