import { getProjectFiles } from "../tools/git.js";
import { readFile } from "../tools/filesystem.js";
import { searchFiles } from "../tools/search.js";
import { ToolDefinition } from "../tools/types.js";

export const projectTools: ToolDefinition[] = [
  {
    name: "get_project_files",

    description:
      "Get the files available in the target project. " +
      "Use this to understand the project's structure before reading files.",

    parameters: {
      type: "object",
      properties: {},
      required: [],
    },

    execute: async () => {
      return getProjectFiles();
    },
  },

  {
    name: "read_file",

    description:
      "Read the contents of a specific file in the target project. " +
      "The path must be relative to the project root.",

    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file relative to the project root.",
        },
      },
      required: ["path"],
    },

    execute: async (input) => {
      if (
        typeof input !== "object" ||
        input === null ||
        !("path" in input) ||
        typeof input.path !== "string"
      ) {
        throw new Error("read_file requires a path");
      }

      return readFile(input.path);
    },
  },

  {
    name: "search_files",

    description:
      "Search project files for a text string. " +
      "Use this to find functions, classes, variables, imports, " +
      "or other code references.",

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to search for.",
        },
      },
      required: ["query"],
    },

    execute: async (input) => {
      if (
        typeof input !== "object" ||
        input === null ||
        !("query" in input) ||
        typeof input.query !== "string"
      ) {
        throw new Error("search_files requires a query");
      }

      return searchFiles(input.query);
    },
  },
];