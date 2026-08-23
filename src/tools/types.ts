export type JSONSchema = {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (input: unknown) => Promise<unknown>;
};