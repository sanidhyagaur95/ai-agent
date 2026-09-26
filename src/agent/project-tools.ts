import { getProjectFiles } from "../tools/git.js";
import { editFile, readFile, writeFile } from "../tools/filesystem.js";
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

  {
    name: "create_file",

    description:
      "Create a new file in the target project. " +
      "The path must be relative to the project root. " +
      "Fails if the file already exists. " +
      "Use edit_file to modify an existing file.",

    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path of the new file relative to the project root.",
        },

        content: {
          type: "string",
          description:
            "Complete contents of the new file.",
        },
      },
      required: ["path", "content"],
    },

    execute: async (input) => {
      if (
        typeof input !== "object" ||
        input === null ||
        !("path" in input) ||
        typeof input.path !== "string" ||
        !("content" in input) ||
        typeof input.content !== "string"
      ) {
        throw new Error(
          "create_file requires path and content",
        );
      }

      return writeFile(
        input.path,
        input.content,
      );
    },
  },

  {
    name: "edit_file",

    description:
      "Edit an existing file by replacing one exact piece of text " +
      "with another. The old text must exist exactly once in the file. " +
      "Use read_file before editing so you know the exact existing content.",

    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path to the existing file relative to the project root.",
        },

        oldText: {
          type: "string",
          description:
            "The exact text currently present in the file that should be replaced.",
        },

        newText: {
          type: "string",
          description:
            "The replacement text.",
        },
      },
      required: ["path", "oldText", "newText"],
    },

    execute: async (input) => {
      if (
        typeof input !== "object" ||
        input === null ||
        !("path" in input) ||
        typeof input.path !== "string" ||
        !("oldText" in input) ||
        typeof input.oldText !== "string" ||
        !("newText" in input) ||
        typeof input.newText !== "string"
      ) {
        throw new Error(
          "edit_file requires path, oldText, and newText",
        );
      }

      return editFile(
        input.path,
        input.oldText,
        input.newText,
      );
    },
  },
];