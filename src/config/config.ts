const port = Number.parseInt(
  process.env.PORT ?? "3000",
  10,
);

const projectRoot = process.env.PROJECT_ROOT;

if (!projectRoot) {
  throw new Error("PROJECT_ROOT is not configured");
}

export const config = {
  llm: {
    provider: process.env.LLM_PROVIDER ?? "ollama",
  },

  ollama: {
    host:
      process.env.OLLAMA_HOST ??
      "http://localhost:11434",

    codingModel:
      process.env.OLLAMA_CODING_MODEL ??
      "deepseek-coder-v2:latest",

    formattingModel:
      process.env.OLLAMA_FORMATTING_MODEL ??
      "gemma4:latest",
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    codingModel:
      process.env.OPENAI_CODING_MODEL ??
      "gpt-5",
  },

  server: {
    port,
  },

  project: {
    root: projectRoot,
  },
} as const;