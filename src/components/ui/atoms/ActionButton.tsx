import React from "react";
import { LucideIcon } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends Omit<ButtonProps, 'children'> {
  icon: LucideIcon;
  label: string;
  isLoading?: boolean;
  showLabel?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  label,
  isLoading = false,
  showLabel = true,
  className,
  disabled,
  ...props
}) => {
  return (
    <Button
      {...props}
      disabled={disabled || isLoading}
      className={cn(
        "gap-2",
        !showLabel && "px-2",
        className
      )}
    >
      <Icon className={cn(
        "h-3 w-3",
        isLoading && "animate-spin"
      )} />
      {showLabel && label}
    </Button>
  );
};