import "dotenv/config";
import express, { Application } from "express";
import { config } from "./config/config.js";
import { runAgent } from "./agent/agent.js";

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

app.listen(PORT, () => {
  console.log(`AI Agent running on http://localhost:${PORT}`);
});