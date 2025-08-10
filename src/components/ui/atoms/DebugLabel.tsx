import React from "react";
import { useDebug } from "@/hooks";

interface DebugLabelProps {
  label: string;
  className?: string;
}

/**
 * Atomic component for debug labels that only show when debug mode is enabled
 */
export const DebugLabel: React.FC<DebugLabelProps> = ({ label, className = "" }) => {
  const { isDebugMode } = useDebug();

  if (!isDebugMode) {
    return null;
  }

  return (
    <div className={`debug-label ${className}`}>
      {label}
    </div>
  );
};