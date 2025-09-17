/**
 * Legacy types from the old settings system
 * These should be gradually phased out in favor of the new settings system
 * @deprecated Use the new settings system instead
 */

export interface PermissionRule {
  id: string;
  value: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}