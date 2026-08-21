import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config/config.js";
import path from "node:path";

const execFileAsync = promisify(execFile);

export const getProjectFiles = async(): Promise<string[]> => {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files"],
    {
      cwd: path.resolve(config.project.root),
      maxBuffer: 10 * 1024 * 1024
    }
  );

  return stdout
      .split(/\r?\n/)
      .map(files => files.trim())
      .filter(Boolean);
}