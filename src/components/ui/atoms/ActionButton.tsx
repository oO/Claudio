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

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(({
  icon: Icon,
  label,
  isLoading = false,
  showLabel = true,
  className,
  disabled,
  ...props
}, ref) => {
  return (
    <Button
      {...props}
      ref={ref}
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
});

ActionButton.displayName = "ActionButton";