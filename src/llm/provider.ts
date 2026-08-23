import type { ToolDefinition } from "../tools/types.js";

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatMessage =
  | {
      role: "system";
      content: string;
    }
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string;
      toolCalls?: ToolCall[];
    }
  | {
      role: "tool";
      content: string;
      toolCallId: string;
    };

export type AssistantResponse = {
  role: "assistant";
  content: string;
  toolCalls: ToolCall[];
};

export interface LLMProvider {
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): Promise<AssistantResponse>;
}