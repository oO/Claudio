import React, { useState, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = "Search...",
  value = "",
  onSearch,
  debounceMs = 300,
  className,
  size = "default"
}) => {
  const [localValue, setLocalValue] = useState(value);

  const sizeClasses = {
    sm: "h-8 text-xs",
    default: "h-9 text-sm",
    lg: "h-10 text-base"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const debouncedSearch = useCallback(
    debounceMs > 0 
      ? (() => {
          let timeout: NodeJS.Timeout;
          return (query: string) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => onSearch(query), debounceMs);
          };
        })()
      : onSearch,
    [onSearch, debounceMs]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    setLocalValue("");
    onSearch("");
  };

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className={cn("relative flex-1", className)}>
      <Search className={cn(
        "absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground",
        iconSizes[size]
      )} />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        className={cn(
          "pl-9",
          localValue && "pr-9",
          sizeClasses[size]
        )}
      />
      {localValue && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className={cn(
            "absolute right-1 top-1/2 transform -translate-y-1/2 hover:bg-transparent",
            size === "sm" && "h-6 w-6",
            size === "default" && "h-7 w-7",
            size === "lg" && "h-8 w-8"
          )}
        >
          <X className={iconSizes[size]} />
        </Button>
      )}
    </div>
  );
};