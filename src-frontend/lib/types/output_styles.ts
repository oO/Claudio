/**
 * Output Style type definitions
 */

export interface OutputStyle {
  name: string;
  description?: string;
  content: string;
  created_at: string;
  updated_at: string;
  file_path?: string;
}

export interface OutputStyleCreate {
  name: string;
  description?: string;
  content: string;
}

export interface OutputStyleUpdate {
  name: string;
  description?: string;
  content: string;
}
