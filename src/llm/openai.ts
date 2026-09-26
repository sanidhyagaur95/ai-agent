import OpenAI from "openai";
import type {  ChatCompletionMessageParam,  ChatCompletionTool } from "openai/resources/chat/completions";

import type {  LLMProvider,  ChatMessage,  AssistantResponse } from "./provider.js";

import type { ToolDefinition } from "../tools/types.js";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor(
    private readonly model: string,
    apiKey: string,
    baseURL?: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      ... (baseURL ? {baseURL} : {}),
    });
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): Promise<AssistantResponse> {
    const openaiMessages: ChatCompletionMessageParam[] =
      messages.map(toOpenAIMessage);

    const openaiTools: ChatCompletionTool[] =
      tools.map(toOpenAITool);

    const response =
      await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        ...(openaiTools.length > 0
          ? { tools: openaiTools }
          : {}),
      });

    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error("OpenAI returned no message");
    }

    return {
      role: "assistant",
      content: message.content ?? "",
      toolCalls:
        message.tool_calls
          ?.filter(
            (call) => call.type === "function",
          )
          .map((call) => ({
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(
              call.function.arguments,
            ) as Record<string, unknown>,
          })) ?? [],
    };
  }
}

function toOpenAIMessage(
  message: ChatMessage,
): ChatCompletionMessageParam {
  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: message.content,
      };

    case "user":
      return {
        role: "user",
        content: message.content,
      };

    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map(
                (call) => {
                  if (!call.id) {
                    throw new Error(
                      `OpenAI requires an id for tool call "${call.name}"`,
                    );
                  }

                  return {
                    id: call.id,
                    type: "function",
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(
                        call.arguments,
                      ),
                    },
                  }
                },
              ),
            }
          : {}),
      };

    case "tool": {
      if (!message.toolCallId) {
        throw new Error(
          "OpenAI requires toolCallId for tool messages",
        );
      }

      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
      };
    }
  }
}

function toOpenAITool(
  tool: ToolDefinition,
): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
