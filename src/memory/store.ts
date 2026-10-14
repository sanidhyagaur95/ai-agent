import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config/config.js";
import type {
  MemoryMessage,
  ProjectFact,
  Session,
  MemoryStats,
  ToolCall,
  RepoSnapshot,
  Entity,
  Relationship,
  AgentEvent,
} from "./types.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

/**
 * Resolve the path to the SQLite database file.
 * Stores inside .ai-agent/ within the target project root.
 */
function resolveDbPath(): string {
  const projectRoot = path.resolve(config.project.root);
  return path.resolve(projectRoot, ".ai-agent", "memory.db");
}

/**
 * Durable, embedded memory store for the AI agent.
 *
 * Uses SQLite (via better-sqlite3) — a zero-config, transactional,
 * file-based database. This is ideal for a local coding agent because:
 *
 * 1. Zero external dependencies (runs in-process).
 * 2. Full ACID guarantees (durable across restarts).
 * 3. Fast read-heavy queries with optional in-memory caching.
 * 4. Supports both structured relational data (sessions)
 *    and semi-structured data (facts, messages via JSON).
 *
 * Schema:
 * - sessions:          Tracks conversation sessions for context continuity.
 * - messages:          Stores individual chat messages linked to sessions.
 * - project_facts:     Long-term structured knowledge extracted about the repo.
 * - repo_snapshots:    Point-in-time snapshots of repository structure.
 * - entities:          Recognized code entities (classes, functions, modules, etc.).
 * - relationships:     Directed relationships between entities.
 * - agent_events:      Audit log of agent actions.
 */
export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? resolveDbPath();
    const aiAgentDir = path.resolve(resolvedPath, "..");

    // Ensure the .ai-agent directory exists before opening the DB.
    if (!fs.existsSync(aiAgentDir)) {
      fs.mkdirSync(aiAgentDir, { recursive: true });
    }

    this.db = new Database(resolvedPath);

    // Enable WAL mode for better concurrent read performance.
    this.db.pragma("journal_mode = WAL");

    // Enforce foreign keys.
    this.db.pragma("foreign_keys = ON");

    this.initSchema();
  }

  /**
   * Create tables and indexes if they don't already exist.
   */
  private initSchema(): void {
    // Sessions table — each "conversation" with a start/end.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id            TEXT PRIMARY KEY,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        metadata      TEXT
      );
    `);

    // Messages table — every message in a session.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id    TEXT NOT NULL,
        role          TEXT NOT NULL,
        content       TEXT NOT NULL,
        tool_calls    TEXT,
        tool_call_id  TEXT,
        created_at    TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    // Project facts — durable, long-term learned knowledge.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_facts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        category      TEXT NOT NULL,
        fact          TEXT NOT NULL,
        source_file   TEXT,
        confidence    REAL DEFAULT 0.5,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );
    `);

    // Repo snapshots — point-in-time repository structure captures.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS repo_snapshots (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        root          TEXT NOT NULL,
        git_commit    TEXT,
        git_branch    TEXT,
        file_count    INTEGER NOT NULL,
        manifest      TEXT NOT NULL,
        captured_at   TEXT NOT NULL
      );
    `);

    // Index for snapshot time lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_repo_snapshots_captured_at
      ON repo_snapshots(captured_at);
    `);

    // Index for snapshot git commit lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_repo_snapshots_git_commit
      ON repo_snapshots(git_commit);
    `);

    // Entities — recognized code entities (classes, functions, modules, etc.).
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        name              TEXT NOT NULL,
        kind              TEXT NOT NULL,
        file_path         TEXT NOT NULL,
        signature         TEXT,
        description       TEXT,
        discovered_at     TEXT NOT NULL,
        discovered_by     TEXT
      );
    `);

    // Index for entity name lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_name
      ON entities(name);
    `);

    // Index for entity file path lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_file_path
      ON entities(file_path);
    `);

    // Index for entity kind lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_kind
      ON entities(kind);
    `);

    // Relationships — directed relationships between entities.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        from_entity_id    INTEGER NOT NULL,
        to_entity_id      INTEGER NOT NULL,
        kind              TEXT NOT NULL,
        discovered_at     TEXT NOT NULL,
        FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );
    `);

    // Index for relationship from-entity lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_relationships_from_entity
      ON relationships(from_entity_id);
    `);

    // Index for relationship to-entity lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_relationships_to_entity
      ON relationships(to_entity_id);
    `);

    // Index for relationship kind lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_relationships_kind
      ON relationships(kind);
    `);

    // Agent events — audit log of agent actions.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id    TEXT,
        action        TEXT NOT NULL,
        details       TEXT,
        occurred_at   TEXT NOT NULL
      );
    `);

    // Index for agent event session lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_events_session_id
      ON agent_events(session_id);
    `);

    // Index for agent event time lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_events_occurred_at
      ON agent_events(occurred_at);
    `);

    // Index for faster category lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_facts_category
      ON project_facts(category);
    `);

    // Index for source file lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_facts_source_file
      ON project_facts(source_file);
    `);

    // Index for session message lookups.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id
      ON messages(session_id);
    `);
  }

  // ---------------------------------------------------------------------------
  // Repository snapshot management
  // ---------------------------------------------------------------------------

  /**
   * Create a new repository snapshot.
   */
  createRepoSnapshot(snapshot: RepoSnapshot): number {
    const stmt = this.db.prepare(`
      INSERT INTO repo_snapshots (root, git_commit, git_branch, file_count, manifest, captured_at)
      VALUES (@root, @gitCommit, @gitBranch, @fileCount, @manifest, @capturedAt)
    `);

    const info = stmt.run({
      root: snapshot.root,
      gitCommit: snapshot.gitCommit ?? null,
      gitBranch: snapshot.gitBranch ?? null,
      fileCount: snapshot.fileCount,
      manifest: JSON.stringify(snapshot.manifest),
      capturedAt: snapshot.capturedAt,
    });

    return Number(info.lastInsertRowid);
  }

  /**
   * Retrieve a repository snapshot by ID.
   */
  getRepoSnapshot(id: number): RepoSnapshot | null {
    const row = this.db.prepare(
      "SELECT * FROM repo_snapshots WHERE id = ?",
    ).get(id) as
      | {
          id: number;
          root: string;
          git_commit: string | null;
          git_branch: string | null;
          file_count: number;
          manifest: string;
          captured_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      root: row.root,
      gitCommit: row.git_commit ?? undefined,
      gitBranch: row.git_branch ?? undefined,
      fileCount: row.file_count,
      manifest: JSON.parse(row.manifest),
      capturedAt: row.captured_at,
    };
  }

  /**
   * List repository snapshots, optionally filtered by git commit.
   */
  listRepoSnapshots(gitCommit?: string): RepoSnapshot[] {
    let rows: Array<{
      id: number;
      root: string;
      git_commit: string | null;
      git_branch: string | null;
      file_count: number;
      manifest: string;
      captured_at: string;
    }>;

    if (gitCommit) {
      rows = this.db.prepare(`
        SELECT * FROM repo_snapshots WHERE git_commit = ? ORDER BY captured_at DESC
      `).all(gitCommit) as Array<{
        id: number;
        root: string;
        git_commit: string | null;
        git_branch: string | null;
        file_count: number;
        manifest: string;
        captured_at: string;
      }>;
    } else {
      rows = this.db.prepare(`
        SELECT * FROM repo_snapshots ORDER BY captured_at DESC
      `).all() as Array<{
        id: number;
        root: string;
        git_commit: string | null;
        git_branch: string | null;
        file_count: number;
        manifest: string;
        captured_at: string;
      }>;
    }

    return rows.map((row) => ({
      id: row.id,
      root: row.root,
      gitCommit: row.git_commit ?? undefined,
      gitBranch: row.git_branch ?? undefined,
      fileCount: row.file_count,
      manifest: JSON.parse(row.manifest),
      capturedAt: row.captured_at,
    }));
  }

  /**
   * Delete a repository snapshot.
   */
  deleteRepoSnapshot(id: number): void {
    this.db.prepare("DELETE FROM repo_snapshots WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Entity management
  // ---------------------------------------------------------------------------

  /**
   * Create or update an entity.
   */
  upsertEntity(entity: Entity): number {
    const now = new Date().toISOString();

    // Try to find an existing entity with the same name and file path.
    const existing = this.db.prepare(
      "SELECT id FROM entities WHERE name = ? AND file_path = ?",
    ).get(entity.name, entity.filePath) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE entities
        SET kind = ?, signature = ?, description = ?, discovered_at = ?, discovered_by = ?
        WHERE id = ?
      `).run(
        entity.kind,
        entity.signature ?? null,
        entity.description ?? null,
        now,
        entity.discoveredBy ?? null,
        existing.id,
      );
      return existing.id;
    }

    const stmt = this.db.prepare(`
      INSERT INTO entities (name, kind, file_path, signature, description, discovered_at, discovered_by)
      VALUES (@name, @kind, @filePath, @signature, @description, @discoveredAt, @discoveredBy)
    `);

    const info = stmt.run({
      name: entity.name,
      kind: entity.kind,
      filePath: entity.filePath,
      signature: entity.signature ?? null,
      description: entity.description ?? null,
      discoveredAt: entity.discoveredAt ?? now,
      discoveredBy: entity.discoveredBy ?? null,
    });

    return Number(info.lastInsertRowid);
  }

  /**
   * Retrieve an entity by ID.
   */
  getEntity(id: number): Entity | null {
    const row = this.db.prepare(
      "SELECT * FROM entities WHERE id = ?",
    ).get(id) as
      | {
          id: number;
          name: string;
          kind: string;
          file_path: string;
          signature: string | null;
          description: string | null;
          discovered_at: string;
          discovered_by: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      kind: row.kind as Entity["kind"],
      filePath: row.file_path,
      signature: row.signature ?? undefined,
      description: row.description ?? undefined,
      discoveredAt: row.discovered_at,
      discoveredBy: row.discovered_by ?? undefined,
    };
  }

  /**
   * Query entities, optionally filtered by kind or file path.
   */
  queryEntities(kind?: string, filePath?: string): Entity[] {
    let query = "SELECT * FROM entities";
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (kind) {
      conditions.push("kind = ?");
      params.push(kind);
    }

    if (filePath) {
      conditions.push("file_path = ?");
      params.push(filePath);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY name";

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: number;
      name: string;
      kind: string;
      file_path: string;
      signature: string | null;
      description: string | null;
      discovered_at: string;
      discovered_by: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as Entity["kind"],
      filePath: row.file_path,
      signature: row.signature ?? undefined,
      description: row.description ?? undefined,
      discoveredAt: row.discovered_at,
      discoveredBy: row.discovered_by ?? undefined,
    }));
  }

  /**
   * Delete an entity.
   */
  deleteEntity(id: number): void {
    this.db.prepare("DELETE FROM entities WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Relationship management
  // ---------------------------------------------------------------------------

  /**
   * Create or update a relationship.
   */
  upsertRelationship(relationship: Relationship): number {
    const now = new Date().toISOString();

    const existing = this.db.prepare(
      "SELECT id FROM relationships WHERE from_entity_id = ? AND to_entity_id = ? AND kind = ?",
    ).get(relationship.fromEntityId, relationship.toEntityId, relationship.kind) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE relationships
        SET discovered_at = ?
        WHERE id = ?
      `).run(
        now,
        existing.id,
      );
      return existing.id;
    }

    const stmt = this.db.prepare(`
      INSERT INTO relationships (from_entity_id, to_entity_id, kind, discovered_at)
      VALUES (@fromEntityId, @toEntityId, @kind, @discoveredAt)
    `);

    const info = stmt.run({
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      kind: relationship.kind,
      discoveredAt: relationship.discoveredAt ?? now,
    });

    return Number(info.lastInsertRowid);
  }

  /**
   * Retrieve a relationship by ID.
   */
  getRelationship(id: number): Relationship | null {
    const row = this.db.prepare(
      "SELECT * FROM relationships WHERE id = ?",
    ).get(id) as
      | {
          id: number;
          from_entity_id: number;
          to_entity_id: number;
          kind: string;
          discovered_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      fromEntityId: row.from_entity_id,
      toEntityId: row.to_entity_id,
      kind: row.kind as Relationship["kind"],
      discoveredAt: row.discovered_at,
    };
  }

  /**
   * Query relationships, optionally filtered by kind or entity IDs.
   */
  queryRelationships(kind?: string, fromEntityId?: number, toEntityId?: number): Relationship[] {
    let query = "SELECT * FROM relationships";
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (kind) {
      conditions.push("kind = ?");
      params.push(kind);
    }

    if (fromEntityId !== undefined) {
      conditions.push("from_entity_id = ?");
      params.push(fromEntityId);
    }

    if (toEntityId !== undefined) {
      conditions.push("to_entity_id = ?");
      params.push(toEntityId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY discovered_at DESC";

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: number;
      from_entity_id: number;
      to_entity_id: number;
      kind: string;
      discovered_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      fromEntityId: row.from_entity_id,
      toEntityId: row.to_entity_id,
      kind: row.kind as Relationship["kind"],
      discoveredAt: row.discovered_at,
    }));
  }

  /**
   * Delete a relationship.
   */
  deleteRelationship(id: number): void {
    this.db.prepare("DELETE FROM relationships WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Agent event management
  // ---------------------------------------------------------------------------

  /**
   * Create an agent event.
   */
  createAgentEvent(event: AgentEvent): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_events (session_id, action, details, occurred_at)
      VALUES (@sessionId, @action, @details, @occurredAt)
    `);

    const info = stmt.run({
      sessionId: event.sessionId ?? null,
      action: event.action,
      details: event.details ?? null,
      occurredAt: event.occurredAt,
    });

    return Number(info.lastInsertRowid);
  }

  /**
   * Retrieve agent events, optionally filtered by session ID or action.
   */
  queryAgentEvents(sessionId?: string, action?: string): AgentEvent[] {
    let query = "SELECT * FROM agent_events";
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (sessionId) {
      conditions.push("session_id = ?");
      params.push(sessionId);
    }

    if (action) {
      conditions.push("action = ?");
      params.push(action);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY occurred_at DESC";

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: number;
      session_id: string | null;
      action: string;
      details: string | null;
      occurred_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id ?? null,
      action: row.action,
      details: row.details ?? undefined,
      occurredAt: row.occurred_at,
    }));
  }

  /**
   * Delete an agent event.
   */
  deleteAgentEvent(id: number): void {
    this.db.prepare("DELETE FROM agent_events WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /**
   * Persist a completed conversation session.
   * Replaces any existing session with the same ID (upsert semantics).
   */
  saveSession(session: Session): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, created_at, updated_at, metadata)
      VALUES (@id, @createdAt, @updatedAt, @metadata)
    `);

    stmt.run({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.metadata ? JSON.stringify(session.metadata) : null,
    });
  }

  /**
   * Retrieve a session by ID, returning parsed metadata if present.
   */
  getSession(sessionId: string): Session | null {
    const row = this.db.prepare(
      "SELECT id, created_at, updated_at, metadata FROM sessions WHERE id = ?",
    ).get(sessionId) as
      | {
          id: string;
          created_at: string;
          updated_at: string;
          metadata: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * List recent sessions, ordered by most recently updated.
   */
  listSessions(limit = 20): Session[] {
    const rows = this.db.prepare(`
      SELECT id, created_at, updated_at, metadata
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: string;
      created_at: string;
      updated_at: string;
      metadata: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Delete a session and all its messages (cascades).
   */
  deleteSession(sessionId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Message storage
  // ---------------------------------------------------------------------------

  /**
   * Append a single message to a session.
   */
  saveMessage(sessionId: string, message: MemoryMessage): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, created_at)
      VALUES (@sessionId, @role, @content, @toolCalls, @toolCallId, @createdAt)
    `);

    stmt.run({
      sessionId,
      role: message.role,
      content: message.content,
      toolCalls:
        message.role === "assistant" && message.toolCalls
          ? JSON.stringify(message.toolCalls)
          : null,
      toolCallId:
        message.role === "tool" && "toolCallId" in message
          ? message.toolCallId
          : null,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Batch-insert all messages for a session.
   * Uses a transaction for atomicity and performance.
   */
  saveMessages(sessionId: string, messages: MemoryMessage[]): void {
    this.db.transaction(() => {
      for (const msg of messages) {
        this.saveMessage(sessionId, msg);
      }
    }).call(this);
  }

  /**
   * Retrieve all messages for a session, ordered by insertion.
   */
  getSessionMessages(sessionId: string): MemoryMessage[] {
    const rows = this.db.prepare(`
      SELECT role, content, tool_calls, tool_call_id
      FROM messages
      WHERE session_id = ?
      ORDER BY id ASC
    `).all(sessionId) as Array<{
      role: string;
      content: string;
      tool_calls: string | null;
      tool_call_id: string | null;
    }>;

    return rows.map((row) => {
      if (row.role === "assistant") {
        const toolCalls: ToolCall[] | undefined = row.tool_calls
          ? JSON.parse(row.tool_calls)
          : undefined;

        return {
          role: "assistant" as const,
          content: row.content,
          toolCalls,
        };
      }

      if (row.role === "tool") {
        return {
          role: "tool" as const,
          content: row.content,
          toolCallId: row.tool_call_id ?? "",
        };
      }

      if (row.role === "system") {
        return { role: "system" as const, content: row.content };
      }

      return { role: "user" as const, content: row.content };
    });
  }

  // ---------------------------------------------------------------------------
  // Project fact management (long-term memory)
  // ---------------------------------------------------------------------------

  /**
   * Store or update a project fact. If a fact with the same category and
   * text already exists, it is updated (upsert on a logical key).
   * Otherwise a new row is inserted.
   */
  upsertProjectFact(fact: ProjectFact): number {
    const now = new Date().toISOString();

    // Try to find an existing fact with the same category + text.
    const existing = this.db.prepare(`
      SELECT id FROM project_facts
      WHERE category = ? AND fact = ?
    `).get(fact.category, fact.fact) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE project_facts
        SET fact = ?, source_file = ?, confidence = ?, updated_at = ?
        WHERE id = ?
      `).run(
        fact.fact,
        fact.sourceFile ?? null,
        fact.confidence,
        now,
        existing.id,
      );
      return existing.id;
    }

    const stmt = this.db.prepare(`
      INSERT INTO project_facts (category, fact, source_file, confidence, created_at, updated_at)
      VALUES (@category, @fact, @sourceFile, @confidence, @createdAt, @createdAt)
    `);

    const info = stmt.run({
      category: fact.category,
      fact: fact.fact,
      sourceFile: fact.sourceFile ?? null,
      confidence: fact.confidence,
      createdAt: now,
    });

    return Number(info.lastInsertRowid);
  }

  /**
   * Insert multiple project facts atomically.
   */
  upsertProjectFacts(facts: ProjectFact[]): void {
    this.db.transaction(() => {
      for (const fact of facts) {
        this.upsertProjectFact(fact);
      }
    }).call(this);
  }

  /**
   * Query project facts by category.
   */
  getProjectFacts(category?: string): ProjectFact[] {
    let rows: Array<{
      category: string;
      fact: string;
      source_file: string | null;
      confidence: number;
    }>;

    if (category) {
      rows = this.db.prepare(`
        SELECT category, fact, source_file, confidence
        FROM project_facts
        WHERE category = ?
        ORDER BY confidence DESC, created_at DESC
      `).all(category) as Array<{
        category: string;
        fact: string;
        source_file: string | null;
        confidence: number;
      }>;
    } else {
      rows = this.db.prepare(`
        SELECT category, fact, source_file, confidence
        FROM project_facts
        ORDER BY category, confidence DESC
      `).all() as Array<{
        category: string;
        fact: string;
        source_file: string | null;
        confidence: number;
      }>;
    }

    return rows.map((row) => ({
      category: row.category as ProjectFact["category"],
      fact: row.fact,
      sourceFile: row.source_file ?? undefined,
      confidence: row.confidence,
    }));
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Return aggregate statistics about stored memory.
   */
  getStats(): MemoryStats {
    const sessionCount = this.db
      .prepare("SELECT COUNT(*) as count FROM sessions")
      .get() as { count: number };

    const messageCount = this.db
      .prepare("SELECT COUNT(*) as count FROM messages")
      .get() as { count: number };

    const factCount = this.db
      .prepare("SELECT COUNT(*) as count FROM project_facts")
      .get() as { count: number };

    const snapshotCount = this.db
      .prepare("SELECT COUNT(*) as count FROM repo_snapshots")
      .get() as { count: number };

    const entityCount = this.db
      .prepare("SELECT COUNT(*) as count FROM entities")
      .get() as { count: number };

    const relationshipCount = this.db
      .prepare("SELECT COUNT(*) as count FROM relationships")
      .get() as { count: number };

    const eventCount = this.db
      .prepare("SELECT COUNT(*) as count FROM agent_events")
      .get() as { count: number };

    const oldest = this.db
      .prepare("SELECT created_at FROM sessions ORDER BY created_at ASC LIMIT 1")
      .get() as { created_at: string } | undefined;

    const newest = this.db
      .prepare("SELECT updated_at FROM sessions ORDER BY updated_at DESC LIMIT 1")
      .get() as { updated_at: string } | undefined;

    return {
      totalSessions: sessionCount.count,
      totalMessages: messageCount.count,
      totalProjectFacts: factCount.count,
      totalEntities: entityCount.count,
      totalRelationships: relationshipCount.count,
      totalSnapshots: snapshotCount.count,
      totalEvents: eventCount.count,
      oldestSessionAt: oldest?.created_at ?? null,
      newestSessionAt: newest?.updated_at ?? null,
    };
  }

  /**
   * Close the database connection gracefully.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Expose the underlying DB for advanced queries or migrations.
   */
  get database(): Database.Database {
    return this.db;
  }
}
