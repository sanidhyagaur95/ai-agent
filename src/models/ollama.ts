import { Ollama } from "ollama";
import { config } from "../config/config.js";

const ollama = new Ollama({
  host: config.ollama.host,
});

type Message = {
  role: "system" | "user" | "assistant",
  content: string,
}

export const chat = async(
  model: string,
  messages: Message[]
): Promise<string> => {
  const response = await ollama.chat({
    model,
    messages,
  });

  return response.message.content;
}


export const codingChat = async(messages: Message[]): Promise<string> => chat(config.ollama.codingModel, messages);

export const formattingChat = async(messages: Message[]): Promise<string> => chat(config.ollama.formattingModel, messages);