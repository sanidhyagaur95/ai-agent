import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

import { config } from "../config/config.js";
import { loadAiIgnore } from "./aiignore.js";

const execFileAsync = promisify(execFile);

export type SearchMatch = {
  file: string;
  line: number;
  content: string;
};

export async function searchFiles(
  query: string,
): Promise<SearchMatch[]> {
  if (!query.trim()) {
    throw new Error("Search query must not be empty");
  }

  const projectRoot = path.resolve(config.project.root);
  const aiIgnore = await loadAiIgnore();

  const matches: SearchMatch[] = [];

  /*
   * Search tracked files with git grep.
   */
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "grep",
        "-n",
        "-I",
        "--fixed-strings",
        query,
      ],
      {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    parseGitGrepOutput(stdout, aiIgnore, matches);
  } catch (error) {
    /*
     * git grep exits with code 1 when there are simply
     * no matches. That's not an actual error.
     */
    if (!isGitGrepNoMatch(error)) {
      throw error;
    }
  }

  /*
   * Search untracked files.
   */
  const { stdout: untrackedOutput } = await execFileAsync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const untrackedFiles = untrackedOutput
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => !aiIgnore.ignores(file));

  for (const file of untrackedFiles) {
    const absolutePath = path.join(projectRoot, file);

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      continue;
    }

    if (!stats.isFile()) {
      continue;
    }

    // Don't try to load huge files into memory.
    if (stats.size > 1 * 1024 * 1024) {
      continue;
    }

    let content: string;

    try {
      content = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/).filter(Boolean);

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (line && line.includes(query)) {
        matches.push({
          file,
          line: index + 1,
          content: line.trim(),
        });
      }
    }
  }

  return matches;
}

function parseGitGrepOutput(
  output: string,
  aiIgnore: Awaited<ReturnType<typeof loadAiIgnore>>,
  matches: SearchMatch[],
): void {
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    /*
     * git grep -n output:
     *
     * file.ts:42:const something = ...
     */
    const match = line.match(/^(.+?):(\d+):(.*)$/);

    if (!match) {
      continue;
    }

    const [, file, lineNumber, content] = match;

    if(file && content) {
        
      if (aiIgnore.ignores(file)) {
        continue;
      }

      matches.push({
        file,
        line: Number(lineNumber),
        content: content.trim(),
      });
    }
  }
}

function isGitGrepNoMatch(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return error.code === 1;
  }

  return false;
}