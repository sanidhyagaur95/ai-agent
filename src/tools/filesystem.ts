import fs from "node:fs/promises";
import path from "node:path"
import { config } from "../config/config.js"

const resolveProjectPath = (relativePath: string): string => {
  const projectRoot = path.resolve(config.project.root);
  const targetPath = path.resolve(projectRoot, relativePath);

  if(targetPath !== projectRoot && !targetPath.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error("Access denied: path is outside project root");
  }

  return targetPath;
}

export const listFiles = async(relativePath = "."): Promise<string[]> => {
  const targetPath = resolveProjectPath(relativePath);

  const entries = await fs.readdir(targetPath, {
    withFileTypes: true,
  });

  return entries.map((entry) =>
    path.join(relativePath, entry.name),
  );
}

export const readFile = async(relativePath: string): Promise<string> => {
  const targetPath = resolveProjectPath(relativePath);

  const stats = await fs.stat(targetPath);

  if (!stats.isFile()) {
    throw new Error("The requested path is not a file");
  }

  return fs.readFile(targetPath, "utf8");
}