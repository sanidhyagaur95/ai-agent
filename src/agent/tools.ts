import type { Tool } from "ollama";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Tool["function"]["parameters"];
  execute: (input: unknown) => Promise<unknown>;
};