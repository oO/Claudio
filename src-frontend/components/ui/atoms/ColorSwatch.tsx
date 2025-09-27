import React from "react";
import { cn } from "@/lib/utils";

export interface ColorSwatchProps {
  color: string;
  bgClass: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  color,
  bgClass,
  selected = false,
  onClick,
  size = "md",
  className
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  return (
    <div
      className={cn(
        "rounded",
        bgClass,
        sizeClasses[size],
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        selected && "ring-2 ring-primary ring-offset-2",
        className
      )}
      onClick={onClick}
      title={color}
    />
  );
};