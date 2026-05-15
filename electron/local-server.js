const http = require("node:http");
const express = require("express");
const cors = require("cors");
const { AgentManager } = require("./agent-manager");
const { readUsage } = require("./usage-store");
const {
  readSettings,
  updateSettings,
  readCloudBridge,
  updateCloudBridge,
} = require("./settings-store");

function createLocalServer({ electronApp }) {
  const app = express();
  const server = http.createServer(app);
  const agent = new AgentManager({ electronApp });
  const sseClients = new Set();

  function publish(event, payload) {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
      res.write(body);
    }
  }

  agent.on("status", (payload) => publish("status", payload));
  agent.on("log", (payload) => publish("log", payload));
  agent.on("exit", (payload) => publish("exit", payload));

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "typeup-local", time: Date.now() });
  });

  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(`event: status\ndata: ${JSON.stringify(agent.status())}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  });

  app.get("/api/status", (_req, res) => {
    res.json(agent.status());
  });

  app.get("/api/logs", (_req, res) => {
    res.json({ logs: agent.logs() });
  });

  app.post("/api/agent/start", async (_req, res) => {
    await agent.start();
    res.json(agent.status());
  });

  app.post("/api/agent/stop", async (_req, res) => {
    await agent.stop();
    res.json(agent.status());
  });

  app.post("/api/agent/restart", async (_req, res) => {
    await agent.restart();
    res.json(agent.status());
  });

  app.get("/api/devices", async (_req, res) => {
    try {
      const output = await agent.listDevices();
      res.json({ ok: true, output });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/usage", (_req, res) => {
    res.json(readUsage());
  });

  app.get("/api/settings", (_req, res) => {
    res.json(readSettings());
  });

  app.put("/api/settings", async (req, res) => {
    const settings = updateSettings(req.body || {});
    if (req.query.restart === "1") {
      await agent.restart();
    }
    res.json(settings);
  });

  app.get("/api/cloud", (_req, res) => {
    res.json(readCloudBridge());
  });

  app.put("/api/cloud", (req, res) => {
    res.json(updateCloudBridge(req.body || {}));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve({
        port: server.address().port,
        agent,
        close: async () => {
          await agent.stop();
          await new Promise((done) => server.close(done));
        },
      });
    });
  });
}

module.exports = { createLocalServer };
