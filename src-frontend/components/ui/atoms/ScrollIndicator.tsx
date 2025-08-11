import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScrollIndicatorProps {
  direction?: "up" | "down";
  visible?: boolean;
  onClick?: () => void;
  position?: "top" | "bottom";
  className?: string;
}

export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({
  direction = "down",
  visible = true,
  onClick,
  position = "bottom",
  className
}) => {
  if (!visible) return null;

  const Icon = direction === "down" ? ChevronDown : ChevronUp;

  const positionClasses = {
    top: "top-4",
    bottom: "bottom-4"
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      className={cn(
        "absolute right-4 z-10 h-8 w-8 rounded-full p-0 shadow-md opacity-70 hover:opacity-100 transition-opacity",
        positionClasses[position],
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
};