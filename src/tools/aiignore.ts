import ignore, { Ignore } from "ignore";
import fs from "node:fs/promises";
import { aiIgnorePath } from "../config/path.js";

const DEFAULT_IGNORES = [
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "target/",
  "out/",
  ".gradle/",
  "coverage/",
  ".cache/",
  ".turbo/",
  ".next/",
  ".nuxt/",
  ".svelte-kit/",
  ".idea/",
  ".vscode/",
  "*.log",
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  ".DS_Store",
  "Thumbs.db",
];


export const loadAiIgnore = async(): Promise<Ignore> => {

  const rules = ignore();

  rules.add(DEFAULT_IGNORES);

  try {
    const content = await fs.readFile(aiIgnorePath, "utf8");

    rules.add(content);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return rules;
    }

    throw error;
  }
  
  return rules;
}