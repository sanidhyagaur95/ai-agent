import "dotenv/config";
import express, { Application } from "express";
import { config } from "./config/config.js";
import { runAgent } from "./agent/agent.js";
import { listFiles, readFile } from "./tools/filesystem.js";
import { getProjectFiles } from "./tools/git.js";

const app: Application = express();

app.use(express.json());

const PORT = config.server.port;

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.post("/api/v1/agent", async (req, res) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        error: "Message must be a non-empty string",
      });
    }

    const response = await runAgent(message);

    return res.json({
      response,
    });
  } catch (error) {
    console.error("Agent error:", error);

    return res.status(500).json({
      error: "Agent failure error",
    });
  }
});

app.get("/api/v1/files", async (_req, res) => {
  try {
    const files = await listFiles(".");

    return res.json({
      files,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to list files",
    });
  }
});

app.get("/api/v1/files/read", async (req, res) => {
  try {
    const filePath = req.query.path;

    if (typeof filePath !== "string") {
      return res.status(400).json({
        error: "path query parameter is required",
      });
    }

    const content = await readFile(filePath);

    return res.json({
      path: filePath,
      content,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to read file",
    });
  }
});


app.get("/api/v1/project/files", async (_req, res) => {
  try {
    const files = await getProjectFiles();

    return res.json({
      files,
    });
  } catch (error) {
    console.error("Git error:", error);

    return res.status(500).json({
      error: "Unable to get project files",
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI Agent running on http://localhost:${PORT}`);
});