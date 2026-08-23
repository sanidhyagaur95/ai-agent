export type JSONSchemaProperty = {
  type?: string | string[];
  items?: unknown;
  description?: string;
  enum?: unknown[];
};

export type JSONSchema = {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (input: unknown) => Promise<unknown>;
};