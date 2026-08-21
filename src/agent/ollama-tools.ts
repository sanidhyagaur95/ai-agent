import type { Tool } from "ollama";
import type { ToolDefinition } from "./tools.js";

export const toOllamaTools = (
  definitions: ToolDefinition[],
): Tool[] => {
  return definitions.map((tool) => ({
    type: "function",

    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}