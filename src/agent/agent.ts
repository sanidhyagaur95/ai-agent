import type { ChatMessage, LLMProvider } from "../llm/provider.js";
import { projectTools } from "./project-tools.js";

const SYSTEM_PROMPT = `
You are a coding agent.

You have access to tools that allow you to inspect the target project.

When you need information about the project:
- Use get_project_files to understand its structure.
- Use search_files to locate relevant code.
- Use read_file to inspect specific files.

Do not assume the contents of files.
Use the available tools when project information is needed.

Do not expose tool implementation details to the user.
`.trim();

export async function runAgent(
  message: string,
  llm: LLMProvider,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: message,
    },
  ];

  for (let iteration = 0; iteration < 20; iteration++) {
    const response = await llm.chat(
      messages,
      projectTools,
    );

    messages.push(response);

    if (response.toolCalls.length === 0) {
      return response.content;
    }

    for (const toolCall of response.toolCalls) {
      const tool = projectTools.find(
        (candidate) => candidate.name === toolCall.name,
      );

      if (!tool) {
        throw new Error(`Unknown tool: ${toolCall.name}`);
      }

      let result: unknown;

      try {
        result = await tool.execute(toolCall.arguments);
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
        toolCallId: toolCall.id,
      });
    }
  }

  throw new Error("Agent exceeded maximum tool iterations");
}