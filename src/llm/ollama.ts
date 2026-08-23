import { Ollama } from "ollama";
import type { ChatResponse, Message, Tool } from "ollama";

import type { LLMProvider, ChatMessage, AssistantResponse } from "./provider.js";

import type { ToolDefinition } from "../tools/types.js";
import { toOllamaTools } from "./ollama-tools.js";

export class OllamaProvider implements LLMProvider {
  private readonly client: Ollama;

  constructor(
    private readonly model: string,
    host: string,
  ) {
    this.client = new Ollama({ host });
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): Promise<AssistantResponse> {
    const ollamaMessages: Message[] =
      messages.map(toOllamaMessage);

    const ollamaTools: Tool[] =
      toOllamaTools(tools);

    const response: ChatResponse =
      await this.client.chat({
        model: this.model,
        messages: ollamaMessages,
        tools: ollamaTools,
      });

    return {
      role: "assistant",
      content: response.message.content,
      toolCalls:
        response.message.tool_calls?.map(
          (call) => ({
            name: call.function.name,
            arguments:
              call.function.arguments as Record<
                string,
                unknown
              >,
          }),
        ) ?? [],
    };
  }
}

function toOllamaMessage(
  message: ChatMessage,
): Message {
  switch (message.role) {
    case "system":
    case "user":
      return {
        role: message.role,
        content: message.content,
      };

    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        tool_calls: message.toolCalls?.map(
          (call) => ({
            function: {
              name: call.name,
              arguments: call.arguments,
            },
          }),
        ),
      };

    case "tool":
      return {
        role: "tool",
        content: message.content,
      };
  }
}