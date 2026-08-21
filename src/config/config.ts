const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const projectRoot = process.env.PROJECT_ROOT;

if (!projectRoot) {
  throw new Error("PROJECT_ROOT is not configured");
}

export const config = {
  ollama: {
    host: process.env.OLLAMA_HOST ?? "http://localhost:11434",
    codingModel: process.env.CODING_MODEL ?? "deepseek-coder-v2:latest",
    formattingModel: process.env.FORMATTING_MODEL ?? "gemma4:latest"
  },

  server: {
    port: port,
  },

  project: {
    root: projectRoot,
  }
} as const;