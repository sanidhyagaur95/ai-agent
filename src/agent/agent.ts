import { codingChat } from "../models/ollama.js"

export const runAgent = async(useMessage: string): Promise<string> => {
  return codingChat([
    {
      role: "system",
      content: `
      You are a local software development AI agent.

      You help the user understand and develop software.

      You currently have no access to the user's files,
      terminal, or external systems.

      Never claim to have inspected a file unless its contents
      have actually been provided to you.
      `.trim()
    },
    {
      role: "user",
      content: useMessage,
    }
  ]);
}