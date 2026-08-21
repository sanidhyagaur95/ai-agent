import { Ollama } from "ollama";
import type { ChatResponse, Message, Tool } from "ollama";

import { config } from "../config/config.js";

const ollama = new Ollama({
  host: config.ollama.host,
});

export async function chat(
  model: string,
  messages: Message[],
  tools?: Tool[],
): Promise<ChatResponse> {
  return ollama.chat({
    model,
    messages,
    tools,
  });
}

export async function codingChat(
  messages: Message[],
  tools?: Tool[],
): Promise<ChatResponse> {
  return chat(
    config.ollama.codingModel,
    messages,
    tools,
  );
}

export async function formattingChat(
  messages: Message[],
): Promise<ChatResponse> {
  const response = await chat(
    config.ollama.formattingModel,
    messages,
  );

  return response;
}