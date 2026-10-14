export type MemoryMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

export type ToolCall = {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ProjectFact = {
  category: "architecture" | "dependency" | "pattern" | "decision" | "file_structure";
  fact: string;
  sourceFile?: string;
  confidence: number;
};

export type Session = {
  id: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type MemoryStats = {
  totalSessions: number;
  totalMessages: number;
  totalProjectFacts: number;
  totalEntities: number;
  totalRelationships: number;
  totalSnapshots: number;
  totalEvents: number;
  oldestSessionAt: string | null;
  newestSessionAt: string | null;
};

// ---------------------------------------------------------------------------
// Rich memory model — durable repo model
// ---------------------------------------------------------------------------

/** A point-in-time snapshot of the repository structure. */
export type RepoSnapshot = {
  id?: number;
  root: string;
  gitCommit?: string;
  gitBranch?: string;
  fileCount: number;
  manifest: string; // JSON array of file paths
  capturedAt: string;
};

/** A recognized code entity (class, function, module, type, etc.). */
export type Entity = {
  id?: number;
  name: string;
  kind: "class" | "function" | "module" | "type" | "constant" | "interface" | "enum" | "file";
  filePath: string;
  signature?: string;
  description?: string;
  discoveredAt: string;
  discoveredBy?: string; // session or tool that discovered it
};

/** A directed relationship between two entities. */
export type Relationship = {
  id?: number;
  fromEntityId: number;
  toEntityId: number;
  kind: "imports" | "extends" | "implements" | "calls" | "uses" | "exports" | "contains" | "depends_on";
  discoveredAt: string;
};

/** Audit log entry for agent actions. */
export type AgentEvent = {
  id?: number;
  sessionId: string | null;
  action: string;
  details?: string;
  occurredAt: string;
};
