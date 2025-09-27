import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColorSwatch } from "@/components/ui/atoms/ColorSwatch";

export interface ColorOption {
  name: string;
  value: string;
  bgClass: string;
}

export interface ColorPickerDialogProps {
  isOpen: boolean;
  selectedColor: string;
  colors: ColorOption[];
  onColorSelect: (color: string) => void;
  onClose: () => void;
  title?: string;
  className?: string;
}

export const ColorPickerDialog: React.FC<ColorPickerDialogProps> = ({
  isOpen,
  selectedColor,
  colors,
  onColorSelect,
  onClose,
  title = "Choose Color",
  className
}) => {
  if (!isOpen) return null;

  const handleColorSelect = (colorValue: string) => {
    onColorSelect(colorValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={cn(
        "bg-background border border-border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4",
        className
      )}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        
        <div className="grid grid-cols-2 gap-3">
          {colors.map((colorOption) => (
            <button
              key={colorOption.value}
              onClick={() => handleColorSelect(colorOption.value)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                selectedColor === colorOption.value
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              <ColorSwatch
                color={colorOption.name}
                bgClass={colorOption.bgClass}
                selected={selectedColor === colorOption.value}
              />
              <span className={cn(
                "text-sm font-medium",
                selectedColor === colorOption.value && "text-primary font-semibold"
              )}>
                {colorOption.name}
              </span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};