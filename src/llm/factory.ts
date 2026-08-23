import type { LLMProvider } from "./provider.js";

import { OllamaProvider } from "./ollama.js";
// import { OpenAIProvider } from "./openai.js";

import { config } from "../config/config.js";

export function createCodingLLM(): LLMProvider {
  switch (config.llm.provider) {
    case "ollama":
      return new OllamaProvider(
        config.ollama.codingModel,
        config.ollama.host,
      );

    // case "openai":
    //   if (!config.openai.apiKey) {
    //     throw new Error(
    //       "OPENAI_API_KEY is not configured",
    //     );
    //   }

    //   return new OpenAIProvider(
    //     config.openai.codingModel,
    //     config.openai.apiKey,
    //   );

    default:
      throw new Error(
        `For ${config.llm.provider} kindly add configs`,
      );
  }
}