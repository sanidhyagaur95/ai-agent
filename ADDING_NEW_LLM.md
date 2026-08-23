# Adding an LLM Provider

The project uses the LLMProvider interface to keep the agent independent of any specific LLM.

```
runAgent()
    │
    ▼
LLMProvider
    ├── OllamaProvider
    ├── OpenAIProvider
    └── OtherProvider
```
## 1. Create the provider

Create:

```
src/llm/<provider>.ts
```

Implement LLMProvider:

```
export class OpenAIProvider implements LLMProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): Promise<AssistantResponse> {
    // Convert messages/tools to provider format.
    // Call the provider API.
    // Convert the response to AssistantResponse.
  }
}
```

The provider is responsible for translating between the project's generic types and the provider's API.

## 2. Keep provider-specific code isolated

The provider should handle:

* Message conversion
* Tool conversion
* API calls
* Tool-call response conversion
* Response normalization

Do not add provider-specific code to agent.ts or the project tools.

## 3. Add configuration

Add provider settings to:
```
src/config/config.ts
```

For example:
```
openai: {
  apiKey: process.env.OPENAI_API_KEY,
  codingModel:
    process.env.OPENAI_CODING_MODEL ?? "gpt-5",
},
```

Add corresponding variables to .env and dummy values to .env.example:
```
OPENAI_API_KEY=
OPENAI_CODING_MODEL=gpt-5
```

Never commit API keys.

## 4. Add the provider to the factory

Update:
```
src/llm/factory.ts
```

For example:
```
case "openai":
  if (!config.openai.apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured",
    );
  }

  return new OpenAIProvider(
    config.openai.codingModel,
    config.openai.apiKey,
  );
```

## 5. Install the SDK

If the provider has an official SDK:
```
pnpm add <provider-sdk>
```

Keep SDK imports inside the provider implementation.

## 6. Verify

A new provider should support:

* Normal chat responses
* Tool calls
* Tool results
* Multiple agent/tool iterations
* Missing credentials and API errors

The following should not require provider-specific changes:
```
src/agent/
src/tools/
```

The final usage should remain:
```
const llm = createCodingLLM();

await runAgent(message, llm);
```

Adding a provider should only require a new adapter, configuration, factory entry, and its SDK.