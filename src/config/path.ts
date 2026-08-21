import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const configDirectory = path.dirname(currentFile);

export const aiProjectRoot = path.resolve(configDirectory, "../..");

export const aiIgnorePath = path.join(
  aiProjectRoot,
  ".aiignore"
);