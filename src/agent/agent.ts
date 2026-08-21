import { codingChat } from "../models/ollama.js";
import { projectTools } from "./project-tools.js";
import { toOllamaTools } from "./ollama-tools.js";
import { Message } from "ollama";

const ollamaTools = toOllamaTools(projectTools);

export async function runAgent(message: string): Promise<string> {
  const messages: Message[] = [
    {
      role: "system",
      content: `
You are a coding agent.

You have access to tools that allow you to inspect the target project.

When you need information about the project:
- Use get_project_files to understand its structure.
- Use search_files to locate relevant code.
- Use read_file to inspect specific files.

Do not assume the contents of files.
Use the available tools when project information is needed.

Do not expose tool implementation details to the user.
      `.trim(),
    },

    {
      role: "user",
      content: message,
    },
  ];

  for (let iteration = 0; iteration < 20; iteration++) {
    const response = await codingChat(
      messages,
      ollamaTools,
    );

    messages.push(response.message);

    if (!response.message.tool_calls?.length) {
      return response.message.content;
    }

    for (const toolCall of response.message.tool_calls) {
      const tool = projectTools.find(
        (candidate) =>
          candidate.name === toolCall.function.name,
      );

      if (!tool) {
        throw new Error(
          `Unknown tool: ${toolCall.function.name}`,
        );
      }

      let result: unknown;

      try {
        result = await tool.execute(
          toolCall.function.arguments,
        );
      } catch (error) {
        result = {
          error:
            error instanceof Error
              ? error.message
              : "Tool execution failed",
        };
      }

      messages.push({
        role: "tool",
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Agent exceeded maximum tool iterations");
}