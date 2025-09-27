import React from "react";
import { useDebugUnified } from "@/hooks/useDebugUnified";

interface DebugLabelProps {
  label: string;
  className?: string;
}

/**
 * Atomic component for debug labels that only show when debug mode is enabled
 * Now uses UnifiedSettings for cached debug mode access (no API calls!)
 */
export const DebugLabel: React.FC<DebugLabelProps> = ({ label, className = "" }) => {
  const { isDebugMode } = useDebugUnified();

  if (!isDebugMode) {
    return null;
  }

  return (
    <div className={`debug-label ${className}`}>
      {label}
    </div>
  );
};