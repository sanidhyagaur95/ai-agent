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

export async function writeFile(
  filePath: string,
  content: string,
): Promise<string> {
  const resolved = resolveProjectPath(filePath);

  try {
    await fs.access(resolved);

    throw new Error(
      `File already exists: ${filePath}. Use edit_file to modify it.`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("File already exists:")
    ) {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(resolved), {
    recursive: true,
  });

  await fs.writeFile(resolved, content, "utf8");

  return `Created file: ${filePath}`;
}

export async function editFile(
  filePath: string,
  oldText: string,
  newText: string,
): Promise<string> {
  const resolved = resolveProjectPath(filePath);

  const content = await fs.readFile(resolved, "utf8");

  if (!content.includes(oldText)) {
    throw new Error(
      `Could not find the specified text in ${filePath}`,
    );
  }

  const occurrences = content.split(oldText).length - 1;

  if (occurrences > 1) {
    throw new Error(
      `The specified text occurs ${occurrences} times in ${filePath}. ` +
        `Provide a larger, more specific section so the edit is unambiguous.`,
    );
  }

  const updatedContent = content.replace(
    oldText,
    newText,
  );

  await fs.writeFile(
    resolved,
    updatedContent,
    "utf8",
  );

  return `Updated file: ${filePath}`;
}