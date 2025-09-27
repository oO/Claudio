import { useMemo } from "react";
import type { ClaudeSettings } from "@/lib/api";
import type { PermissionRule, EnvironmentVariable } from "./useSettingsState";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FieldValidation {
  isValid: boolean;
  error?: string;
  warning?: string;
}

export interface SettingsValidation {
  overall: ValidationResult;
  apiKeyHelper: FieldValidation;
  permissions: {
    allow: FieldValidation[];
    deny: FieldValidation[];
  };
  environment: FieldValidation[];
}

/**
 * Custom hook for validating settings data
 */
export const useSettingsValidation = (
  settings: ClaudeSettings | null,
  allowRules: PermissionRule[],
  denyRules: PermissionRule[],
  envVars: EnvironmentVariable[]
): SettingsValidation => {
  
  const validation = useMemo(() => {
    const result: SettingsValidation = {
      overall: { isValid: true, errors: [], warnings: [] },
      apiKeyHelper: { isValid: true },
      permissions: {
        allow: [],
        deny: [],
      },
      environment: [],
    };

    if (!settings) {
      result.overall.isValid = false;
      result.overall.errors.push("Settings not loaded");
      return result;
    }


    // Validate API key helper
    if (settings.apiKeyHelper) {
      const path = settings.apiKeyHelper.trim();
      if (!path.startsWith('/') && !path.startsWith('~')) {
        result.apiKeyHelper = {
          isValid: false,
          error: "API key helper must be an absolute path"
        };
        result.overall.isValid = false;
        result.overall.errors.push("Invalid API key helper path");
      }
    }

    // Validate permission rules
    const validatePermissionRule = (rule: PermissionRule): FieldValidation => {
      const value = rule.value.trim();
      
      if (!value) {
        return {
          isValid: false,
          error: "Permission rule cannot be empty"
        };
      }

      // Check for common patterns
      const validPatterns = [
        /^[A-Z][a-zA-Z]*$/,                    // Tool name like "Bash", "Read"
        /^[A-Z][a-zA-Z]*\(.+\)$/,             // Tool with args like "Bash(npm run test)"
        /^[A-Z][a-zA-Z]*\(.+\*\)$/,           // Tool with wildcard like "Bash(npm run test:*)"
        /^[A-Z][a-zA-Z]*\(~?\/.+\)$/,         // Tool with path like "Read(~/.zshrc)"
        /^[A-Z][a-zA-Z]*\(.+\/\*\*\)$/,       // Tool with glob like "Edit(docs/**)"
      ];

      const isValidPattern = validPatterns.some(pattern => pattern.test(value));
      
      if (!isValidPattern) {
        return {
          isValid: true,
          warning: "Rule may not match expected pattern"
        };
      }

      return { isValid: true };
    };

    // Validate allow rules
    result.permissions.allow = allowRules.map(validatePermissionRule);
    const invalidAllowRules = result.permissions.allow.filter(v => !v.isValid);
    if (invalidAllowRules.length > 0) {
      result.overall.isValid = false;
      result.overall.errors.push(`${invalidAllowRules.length} invalid allow rules`);
    }

    // Validate deny rules
    result.permissions.deny = denyRules.map(validatePermissionRule);
    const invalidDenyRules = result.permissions.deny.filter(v => !v.isValid);
    if (invalidDenyRules.length > 0) {
      result.overall.isValid = false;
      result.overall.errors.push(`${invalidDenyRules.length} invalid deny rules`);
    }

    // Validate environment variables
    result.environment = envVars.map((envVar): FieldValidation => {
      const key = envVar.key.trim();
      const value = envVar.value.trim();

      if (!key && !value) {
        return { isValid: true }; // Empty entries are allowed, will be filtered out
      }

      if (!key) {
        return {
          isValid: false,
          error: "Environment variable key cannot be empty"
        };
      }

      if (!value) {
        return {
          isValid: false,
          error: "Environment variable value cannot be empty"
        };
      }

      // Check for valid environment variable key format
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        return {
          isValid: false,
          error: "Key must use uppercase letters, numbers, and underscores"
        };
      }

      // Check for duplicate keys
      const duplicates = envVars.filter(v => v.id !== envVar.id && v.key.trim() === key);
      if (duplicates.length > 0) {
        return {
          isValid: false,
          error: "Duplicate environment variable key"
        };
      }

      return { isValid: true };
    });

    const invalidEnvVars = result.environment.filter(v => !v.isValid);
    if (invalidEnvVars.length > 0) {
      result.overall.isValid = false;
      result.overall.errors.push(`${invalidEnvVars.length} invalid environment variables`);
    }

    return result;
  }, [settings, allowRules, denyRules, envVars]);

  return validation;
};

/**
 * Helper function to check if settings are ready to save
 */
export const useCanSaveSettings = (validation: SettingsValidation): boolean => {
  return useMemo(() => {
    return validation.overall.isValid;
  }, [validation.overall.isValid]);
};

/**
 * Helper function to get all validation messages
 */
export const useValidationMessages = (validation: SettingsValidation): string[] => {
  return useMemo(() => {
    const messages: string[] = [];
    
    // Add errors
    messages.push(...validation.overall.errors);
    
    // Add warnings
    if (validation.overall.warnings.length > 0) {
      messages.push(...validation.overall.warnings.map(w => `Warning: ${w}`));
    }
    
    return messages;
  }, [validation.overall.errors, validation.overall.warnings]);
};