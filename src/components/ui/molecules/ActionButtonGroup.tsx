import React from "react";
import { LucideIcon } from "lucide-react";
import { ActionButton, ActionButtonProps } from "@/components/ui/atoms/ActionButton";
import { cn } from "@/lib/utils";

export interface ActionButtonGroupItem {
  id: string;
  icon: LucideIcon;
  label: string;
  variant?: ActionButtonProps["variant"];
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export interface ActionButtonGroupProps {
  actions: ActionButtonGroupItem[];
  orientation?: "horizontal" | "vertical";
  size?: ActionButtonProps["size"];
  showLabels?: boolean;
  className?: string;
}

export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  actions,
  orientation = "horizontal",
  size = "sm",
  showLabels = true,
  className
}) => {
  const containerClasses = cn(
    "flex gap-2",
    orientation === "vertical" ? "flex-col" : "flex-row",
    className
  );

  return (
    <div className={containerClasses}>
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          icon={action.icon}
          label={action.label}
          variant={action.variant}
          size={size}
          onClick={action.onClick}
          disabled={action.disabled}
          isLoading={action.isLoading}
          showLabel={showLabels}
        />
      ))}
    </div>
  );
};