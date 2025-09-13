// Keep only the ClaudeStreamMessage type export
// All polling functionality has been removed as it's unused with Claude Code integration

export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result" | "status";
  subtype?: string;
  message?: {
    content?: any[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: any;
}