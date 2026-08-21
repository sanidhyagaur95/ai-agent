import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

import { config } from "../config/config.js";
import { loadAiIgnore } from "./aiignore.js";

const execFileAsync = promisify(execFile);

export async function getProjectFiles(): Promise<string[]> {
  const projectRoot = path.resolve(config.project.root);
  const aiIgnore = await loadAiIgnore();

  const [trackedResult, untrackedResult] = await Promise.all([
    execFileAsync(
      "git",
      ["ls-files"],
      {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024,
      },
    ),

    execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024,
      },
    ),
  ]);

  const files = new Set([
    ...trackedResult.stdout.split(/\r?\n/),
    ...untrackedResult.stdout.split(/\r?\n/),
  ]);

  const result: string[] = [];

  for (const file of files) {
    const normalizedFile = file.trim();

    if (!normalizedFile) {
      continue;
    }

    if (aiIgnore.ignores(normalizedFile)) {
      continue;
    }

    const absolutePath = path.join(
      projectRoot,
      normalizedFile,
    );

    try {
      const stats = await fs.stat(absolutePath);

      if (stats.isFile()) {
        result.push(normalizedFile);
      }
    } catch {
      // File no longer exists in the working tree.
    }
  }

  return result.sort();
}

export async function getGitStatus(): Promise<string> {
  const projectRoot = path.resolve(config.project.root);

  const { stdout } = await execFileAsync(
    "git",
    ["status", "--short"],
    {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return stdout;
}