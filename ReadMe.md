# AI Coding Agent

A TypeScript-based AI coding agent that can inspect and reason about a local project using tools such as filesystem access, code search, and Git.

The agent is designed with an **LLM provider abstraction**, allowing the same agent and project tools to work with different LLM backends, including locally running models such as Ollama and cloud-based providers.

## Features

* 🤖 AI-powered coding assistance
* 🧠 Pluggable LLM providers
* 🏠 Local LLM support through Ollama
* ☁️ Designed for cloud LLM providers
* 📁 Project filesystem inspection
* 🔎 Code and file search
* 🌿 Git integration
* 🚫 `.aiignore` support for excluding files from AI access
* 🔧 Tool-based agent architecture
* 🔄 Multi-step agent/tool execution loop
* 📦 Node.js + TypeScript
* ⚡ Express.js server

## Requirements

* Node.js
* pnpm
* TypeScript
* An LLM provider

For local inference:

* Ollama
* A compatible coding model

If you have a cloud agent subscription you will need to add connection details such as keys/secrets in the `.env` file and create new provider for your agent.

## Installation

Clone the repository and install dependencies:

```bash
pnpm install
```

Create your environment file:

```bash
cp .env.example .env
```

Configure the required values in `.env`.

## Ollama Setup (Optional)
See [ADDING_NEW_LLM.md](ADDING_NEW_LLM.md) to configure your own LLM.<br>
Follow this step if you do not have any LLM subscription or want to run LLM locally.<br>
Install and run Ollama, then pull a suitable coding model.

For example:

```bash
ollama pull deepseek-coder-v2:latest
```

Configure the Ollama connection in `.env`.

Example configuration:

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_CODING_MODEL=<your-coding-model for example: deepseek-coder-v2:latest>
OLLAMA_FORMATTING_MODEL=<your-formatting-model>
```

The exact environment variable names should match `src/config/config.ts`.

## Running the Project

Start the development server using the package scripts defined in `package.json`.

For example:

```bash
pnpm dev
```

Build the project with:

```bash
pnpm build
```

Run the compiled application with:

```bash
pnpm start
```

If your `package.json` uses different script names, use the corresponding scripts from that file.

## Architecture

The project separates the agent's reasoning from the underlying LLM provider.

```text
                         Express Server
                               │
                               ▼
                         Coding Agent
                               │
                         LLMProvider
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
         OllamaProvider                Cloud Provider
                │                             │
                ▼                             ▼
             Ollama                   OpenAI / Other
                │
                ▼
           Local Model


                         Coding Agent
                              │
                         Tool Registry
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
     Filesystem              Git                Search
```

The agent itself does not need to know which LLM is being used.

### LLM abstraction

The agent depends on a generic interface:

```text
LLMProvider
    │
    ├── OllamaProvider
    ├── OpenAIProvider
    └── Future providers
```

Each provider is responsible for converting the application's generic messages and tool definitions into the format expected by the specific LLM API.

This keeps provider-specific code out of the agent.

## Project Structure

```text
src/
├── agent/
│   ├── agent.ts
│   ├── project-tools.ts
│   └── tools.ts
│
├── llm/
│   ├── provider.ts
│   ├── ollama.ts
│   ├── ollama-tools.ts
│   └── (other cloud LLM providers)      # based on requirement
│
├── config/
│   ├── config.ts
│   └── path.ts
│
├── tools/
│   ├── aiignore.ts
│   ├── filesystem.ts
│   ├── git.ts
│   └── search.ts
│
└── server.ts
```

### `agent/`

Contains the agent loop and the collection of project tools available to the agent.

The agent:

1. Receives a user request.
2. Sends the conversation and available tools to the LLM.
3. Checks whether the LLM requested a tool.
4. Executes the requested tool.
5. Sends the tool result back to the LLM.
6. Repeats until the LLM produces a final response.
7. Stops after a configurable maximum number of iterations.

### `llm/`

Contains the LLM abstraction and provider implementations.

`provider.ts` defines the provider-independent interface.

`ollama.ts` implements that interface for Ollama.

`ollama-tools.ts` converts the application's generic tool definitions into Ollama's tool format.

Additional providers can be implemented without changing the agent loop.

### `tools/`

Contains the actual capabilities exposed to the coding agent.

Examples include:

* Reading files
* Writing files
* Searching the project
* Inspecting Git state
* Working with `.aiignore`

These tools are independent of the LLM provider.

## Agent Flow

A typical request follows this flow:

```text
User
 │
 ▼
Express
 │
 ▼
runAgent()
 │
 ▼
LLMProvider
 │
 ▼
LLM decides whether a tool is needed
 │
 ├── No ───────────────► Final response
 │
 └── Yes
       │
       ▼
   Tool call
       │
       ▼
   ToolRegistry
       │
       ▼
   Execute tool
       │
       ▼
   Tool result
       │
       └──────────────► LLM
                            │
                            ▼
                       Continue loop
```

For example, when asked to investigate a bug, the agent may:

```text
User:
"Find the authentication bug."

       ↓

LLM

       ↓

search_files("authentication")

       ↓

Tool result

       ↓

LLM

       ↓

read_file("src/auth.ts")

       ↓

Tool result

       ↓

LLM

       ↓

Final answer
```

## LLM Providers

The project uses dependency injection for the LLM provider.

The agent receives an `LLMProvider` rather than constructing an LLM client itself:

```typescript
const result = await runAgent(message, llm);
```

This means the agent does not depend directly on Ollama, OpenAI, or another specific provider.

### Ollama

The local Ollama provider can be created with a specific model:

```typescript
const llm = new OllamaProvider(
  config.ollama.codingModel,
  config.ollama.host,
);
```

### Cloud providers

Cloude providers can be implemented using the same interface:

```typescript
class OpenAIProvider implements LLMProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): Promise<AssistantResponse> {
    // Convert generic messages/tools
    // into the provider's API format.

    // Call the cloud LLM.

    // Convert the response back into
    // AssistantResponse.
  }
}
```

Once implemented, it can be passed to the same agent:

```typescript
const llm = new OpenAIProvider(...);

await runAgent(message, llm);
```

No changes to the agent's tool execution loop are required.

## Tool Definitions

Tools are defined independently of the LLM provider.

A tool has a name, description, parameter schema, and execution function:

```typescript
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
};
```

For example:

```typescript
const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read a file from the project.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
      },
    },
    required: ["path"],
  },

  execute: async (input) => {
    // Read file...
  },
};
```

The tool definition is provider-independent.

Provider adapters are responsible for converting it to the format required by a particular LLM.

## `.aiignore`

The project supports an `.aiignore` mechanism for controlling which files should be accessible to the agent.

This is useful for excluding files that should not be inspected by the AI, such as:

```text
.env
secrets/
credentials/
node_modules/
dist/
```

The exact behavior is implemented by `src/tools/aiignore.ts`.

## Design Principles

### Provider independence

The agent should depend on:

```text
LLMProvider
```

rather than:

```text
Ollama
OpenAI
Anthropic
etc.
```

### Provider-specific adapters

Provider-specific API formats should stay inside the provider implementation.

For example:

```text
Generic ToolDefinition
        │
        ├── Ollama adapter
        │       ↓
        │    Ollama Tool
        │
        └── OpenAI adapter
                ↓
             OpenAI Tool
```

### Tools are independent from the model

Filesystem, Git, and search tools should not contain Ollama/OpenAI-specific code.

### Dependency injection

The LLM is created at the application boundary and passed to the agent:

```typescript
const llm = createCodingLLM();

await runAgent(message, llm);
```

This makes the system easier to test and makes switching providers straightforward.

## Security

This project is an AI coding agent with access to project files and development tools.

Before running it against sensitive or untrusted projects, review the available tools and permissions.

When using cloud LLM providers, project source code and tool results may be sent to the provider as part of the conversation.

See [SECURITY.md](SECURITY.md) for security considerations, safe usage guidelines, and reporting information.

## Roadmap

* [x] Local Ollama support
* [x] Tool-based agent loop
* [x] Filesystem tools
* [x] Project search
* [x] Git tools
* [x] `.aiignore` support
* [x] LLM provider abstraction
* [ ] Cloud LLM provider
* [ ] Streaming responses
* [ ] Better conversation/session management
* [ ] Tool execution permissions
* [ ] Automated tests
* [ ] VS Code integration
* [ ] Configurable model/provider selection
* [ ] Improved error handling and retries

## Security Considerations

This agent can potentially access files and execute project-related operations.

When running it against an untrusted project or exposing it through a network service, consider:

* Restricting filesystem access to the target project.
* Respecting `.aiignore`.
* Validating tool arguments.
* Restricting dangerous shell/Git operations.
* Adding explicit permission controls for write operations.
* Keeping API keys in environment variables.
* Avoiding sending sensitive project files to cloud LLM providers without user consent.

When using a cloud LLM, remember that information supplied to the model may leave the local machine. Provider-specific data retention and privacy policies should be considered before enabling cloud inference.

## License

No license.
