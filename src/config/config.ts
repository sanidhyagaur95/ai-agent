import { LLMProvider } from "../llm/provider.js";
import { OllamaProvider } from "../llm/ollama.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const projectRoot = process.env.PROJECT_ROOT;

if (!projectRoot) {
  throw new Error("PROJECT_ROOT is not configured");
}

export const config = {

  llm: {
    provider: process.env.LLM_PROVIDER ?? "ollama"
  },

  // openai: {
  //   apiKey: process.env.OPENAI_KEY,
  //   codingModel: process.env.OPENAI_CODING_MODEL ?? "deepseek-coder-v2:latest",
  // },

  ollama: {
    host: process.env.OLLAMA_HOST ?? "http://localhost:11434",
    codingModel: process.env.DEEPSEEK_CODING_MODEL ?? "deepseek-coder-v2:latest",
    formattingModel: process.env.FORMATTING_MODEL ?? "gemma4:latest"
  },

  server: {
    port: port,
  },

  project: {
    root: projectRoot,
  }
} as const;

export function createCodingLLM(): LLMProvider {
  switch (config.llm.provider) {
    case "ollama":
      return new OllamaProvider(
        config.ollama.codingModel,
        config.ollama.host,
      );

    // case "openai":
    //   return new OpenAIProvider(
    //     config.openai.apiKey,
    //     config.openai.codingModel,
    //   );

    default:
      throw new Error(
        `Unsupported LLM provider: ${config.llm.provider}`,
      );
  }
}