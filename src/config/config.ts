const port = Number.parseInt(process.env.PORT ?? "3000", 10);

export const config = {
  ollama: {
    host: process.env.OLLAMA_HOST ?? "http://localhost:11434",
    codingModel: process.env.CODING_MODEL ?? "deepseek-coder-v2:latest",
    formattingModel: process.env.FORMATTING_MODEL ?? "gemma4:latest"
  },

  server: {
    port: Number(process.env.PORT) ?? 3000,
  }
} as const;