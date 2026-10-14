import { v4 as uuid } from "node:crypto";
import { config } from "../config/config.js";
import { MemoryStore } from "./store.js";
import type {
  MemoryMessage,
  ProjectFact,
  Session,
  RepoSnapshot,
  Entity,
  Relationship,
  AgentEvent,
} from "./types.js";

/**
 * Manages the agent's memory lifecycle.
 *
 * Responsibilities:
 * 1. Create and manage conversation sessions.
 * 2. Persist messages during agent execution.
 * 3. Store long-term project facts.
 * 4. Expose relevant memory to the agent loop
 *    (session history + project facts → injected into system prompt).
 * 5. Expose tools the agent can call to query/update memory.
 */
export class AgentMemoryManager {
  private store: MemoryStore;
  private currentSessionId: string | null = null;

  constructor(store?: MemoryStore) {
    this.store = store ?? new MemoryStore();
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start a new conversation session.
   * Returns the session ID so callers can reference it later.
   */
  startSession(metadata?: Record<string, unknown>): string {
    const now = new Date().toISOString();

    const session: Session = {
      id: uuid(),
      createdAt: now,
      updatedAt: now,
      metadata,
    };

    this.store.saveSession(session);
    this.currentSessionId = session.id;

    return session.id;
  }

  /**
   * Resume an existing session.
   * Returns false if the session does not exist.
   */
  resumeSession(sessionId: string): boolean {
    const session = this.store.getSession(sessionId);

    if (!session) return false;

    this.currentSessionId = session.id;
    return true;
  }

  /**
   * Get the current active session ID.
   */
  getActiveSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * End the current session (does not delete data).
   */
  endSession(): void {
    this.currentSessionId = null;
  }

  // ---------------------------------------------------------------------------
  // Message persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a single message to the current session.
   * Throws if no session is active.
   */
  saveMessage(message: MemoryMessage): void {
    const sessionId = this.requireSession();
    this.store.saveMessage(sessionId, message);
  }

  /**
   * Save all messages in a batch to the current session.
   */
  saveMessages(messages: MemoryMessage[]): void {
    const sessionId = this.requireSession();
    this.store.saveMessages(sessionId, messages);
  }

  /**
   * Retrieve all messages from the current session.
   * Returns an empty array if no session is active.
   */
  getMessages(): MemoryMessage[] {
    if (!this.currentSessionId) return [];
    return this.store.getSessionMessages(this.currentSessionId);
  }

  // ---------------------------------------------------------------------------
  // Repository snapshots (memory model)
  // ---------------------------------------------------------------------------

  /**
   * Create a repository snapshot.
   */
  createRepoSnapshot(snapshot: RepoSnapshot): number {
    return this.store.createRepoSnapshot(snapshot);
  }

  /**
   * Get a repository snapshot by ID.
   */
  getRepoSnapshot(id: number): RepoSnapshot | null {
    return this.store.getRepoSnapshot(id);
  }

  /**
   * List repository snapshots.
   */
  listRepoSnapshots(gitCommit?: string): RepoSnapshot[] {
    return this.store.listRepoSnapshots(gitCommit);
  }

  /**
   * Delete a repository snapshot.
   */
  deleteRepoSnapshot(id: number): void {
    this.store.deleteRepoSnapshot(id);
  }

  // ---------------------------------------------------------------------------
  // Entities (memory model)
  // ---------------------------------------------------------------------------

  /**
   * Create or update an entity.
   */
  upsertEntity(entity: Entity): number {
    return this.store.upsertEntity(entity);
  }

  /**
   * Get an entity by ID.
   */
  getEntity(id: number): Entity | null {
    return this.store.getEntity(id);
  }

  /**
   * Query entities.
   */
  queryEntities(kind?: Entity["kind"], filePath?: string): Entity[] {
    return this.store.queryEntities(kind, filePath);
  }

  /**
   * Delete an entity.
   */
  deleteEntity(id: number): void {
    this.store.deleteEntity(id);
  }

  // ---------------------------------------------------------------------------
  // Relationships (memory model)
  // ---------------------------------------------------------------------------

  /**
   * Create or update a relationship.
   */
  upsertRelationship(relationship: Relationship): number {
    return this.store.upsertRelationship(relationship);
  }

  /**
   * Get a relationship by ID.
   */
  getRelationship(id: number): Relationship | null {
    return this.store.getRelationship(id);
  }

  /**
   * Query relationships.
   */
  queryRelationships(kind?: Relationship["kind"], fromEntityId?: number, toEntityId?: number): Relationship[] {
    return this.store.queryRelationships(kind, fromEntityId, toEntityId);
  }

  /**
   * Delete a relationship.
   */
  deleteRelationship(id: number): void {
    this.store.deleteRelationship(id);
  }

  // ---------------------------------------------------------------------------
  // Agent events (memory model)
  // ---------------------------------------------------------------------------

  /**
   * Create an agent event.
   */
  createAgentEvent(event: AgentEvent): number {
    return this.store.createAgentEvent(event);
  }

  /**
   * Query agent events.
   */
  queryAgentEvents(sessionId?: string, action?: string): AgentEvent[] {
    return this.store.queryAgentEvents(sessionId, action);
  }

  /**
   * Delete an agent event.
   */
  deleteAgentEvent(id: number): void {
    this.store.deleteAgentEvent(id);
  }

  // ---------------------------------------------------------------------------
  // Project facts (long-term memory)
  // ---------------------------------------------------------------------------

  /**
   * Store a project fact in long-term memory.
   */
  rememberFact(fact: ProjectFact): number {
    return this.store.upsertProjectFact(fact);
  }

  /**
   * Store multiple facts atomically.
   */
  rememberFacts(facts: ProjectFact[]): void {
    this.store.upsertProjectFacts(facts);
  }

  /**
   * Retrieve known project facts, optionally filtered by category.
   */
  recallFacts(category?: ProjectFact["category"]): ProjectFact[] {
    return this.store.getProjectFacts(category);
  }

  // ---------------------------------------------------------------------------
  // Agent-facing tools
  // ---------------------------------------------------------------------------

  /**
   * Memory-related tools the agent can invoke.
   *
   * These follow the same ToolDefinition shape as project tools,
   * allowing them to be passed alongside the other tools.
   */
  getTools() {
    return [
      {
        name: "remember_project_fact",
        description:
          "Store a durable piece of knowledge about the project in long-term memory. " +
          "Use this after learning something important about the codebase structure, " +
          "architecture, dependencies, patterns, or decisions. " +
          "Categories: architecture, dependency, pattern, decision, file_structure. " +
          "Confidence should be between 0 and 1.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["architecture", "dependency", "pattern", "decision", "file_structure"],
              description: "The category of the fact.",
            },
            fact: {
              type: "string",
              description: "The actual fact to remember.",
            },
            sourceFile: {
              type: "string",
              description: "Optional file where this fact was discovered.",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence level (0–1).",
            },
          },
          required: ["category", "fact", "confidence"],
        },
        execute: async (input: unknown) => {
          if (
            typeof input !== "object" ||
            input === null ||
            !("category" in input) ||
            !("fact" in input) ||
            !("confidence" in input)
          ) {
            throw new Error(
              "remember_project_fact requires category, fact, and confidence",
            );
          }

          const category = String(input.category);
          const fact = String(input.fact);
          const confidence = Number(input.confidence);
          const sourceFile =
            typeof input.sourceFile === "string" ? input.sourceFile : undefined;

          if (
            isNaN(confidence) ||
            confidence < 0 ||
            confidence > 1
          ) {
            throw new Error("confidence must be a number between 0 and 1");
          }

          const id = this.rememberFact({
            category: category as ProjectFact["category"],
            fact,
            sourceFile,
            confidence,
          });

          return { id, message: `Remembered fact #${id}` };
        },
      },
      {
        name: "query_memory",
        description:
          "Query the agent's memory for stored project facts or session history. " +
          "Use this to recall what you already know about the project " +
          "before starting a new task, or to review past conversation context.",
        parameters: {
          type: "object",
          properties: {
            queryType: {
              type: "string",
              enum: ["facts", "history", "stats"],
              description:
                "What to query: 'facts' for project knowledge, 'history' for recent messages, 'stats' for memory stats.",
            },
            category: {
              type: "string",
              enum: ["architecture", "dependency", "pattern", "decision", "file_structure"],
              description: "Filter facts by category (only for queryType='facts').",
            },
            limit: {
              type: "number",
              description: "Maximum results to return (default 50).",
            },
          },
          required: ["queryType"],
        },
        execute: async (input: unknown) => {
          if (
            typeof input !== "object" ||
            input === null ||
            !("queryType" in input)
          ) {
            throw new Error("query_memory requires queryType");
          }

          const queryType = String(input.queryType);
          const limit =
            typeof input.limit === "number" ? input.limit : 50;

          switch (queryType) {
            case "facts": {
              const category =
                typeof input.category === "string"
                  ? (input.category as ProjectFact["category"])
                  : undefined;
              return this.recallFacts(category).slice(0, limit);
            }

            case "history": {
              const messages = this.getMessages();
              return messages.slice(-limit);
            }

            case "stats": {
              return this.store.getStats();
            }

            default:
              throw new Error(`Unknown queryType: ${queryType}`);
          }
        },
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Prompt enrichment
  // ---------------------------------------------------------------------------

  /**
   * Build a context string that combines:
   * 1. Known project facts from long-term memory.
   * 2. Recent messages from the current session.
   *
   * This string is appended to the system prompt so the LLM
   * has access to remembered knowledge without needing
   * explicit tool calls.
   */
  buildContext(maxHistoryMessages = 10): string {
    const parts: string[] = [];

    // --- Long-term facts ---
    const facts = this.recallFacts();

    if (facts.length > 0) {
      const factLines = facts
        .map(
          (f) =>
            `[${f.category}] (${f.confidence}) ${f.fact}${f.sourceFile ? ` — source: ${f.sourceFile}` : ""}`,
        )
        .join("\n");

      parts.push(`[LONG-TERM MEMORY]\n${factLines}`);
    }

    // --- Recent session history ---
    const messages = this.getMessages();

    if (messages.length > 0) {
      const recent = messages.slice(-maxHistoryMessages);
      const historyLines = recent
        .map((m) => {
          if (m.role === "tool") {
            return `[tool] ${m.content}`;
          }
          return `[${m.role}] ${m.content}`;
        })
        .join("\n");

      parts.push(`[RECENT HISTORY]\n${historyLines}`);
    }

    return parts.join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // Stats / introspection
  // ---------------------------------------------------------------------------

  getStats() {
    return this.store.getStats();
  }

  close(): void {
    this.store.close();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private requireSession(): string {
    if (!this.currentSessionId) {
      throw new Error(
        "No active session. Call startSession() first.",
      );
    }
    return this.currentSessionId;
  }
}
