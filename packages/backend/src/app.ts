import express from "express";
import cors from "cors";
import { leadsRouter } from "./routes/leads.routes.js";
import { actionsRouter } from "./routes/actions.routes.js";
import { safetyRouter } from "./routes/safety.routes.js";
import { messagesRouter } from "./routes/messages.routes.js";
import { remindersRouter } from "./routes/reminders.routes.js";
import { campaignsRouter } from "./routes/campaigns.routes.js";
import { searchTasksRouter } from "./routes/searchTasks.routes.js";
import { engineRouter } from "./routes/engine.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { queuesRouter } from "./routes/queues.routes.js";
import { logsRouter } from "./routes/logs.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/leads/:leadId/messages", messagesRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/actions", actionsRouter);
  app.use("/api/safety-config", safetyRouter);
  app.use("/api/reminders", remindersRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/search-tasks", searchTasksRouter);
  app.use("/api/engine", engineRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/queues", queuesRouter);
  app.use("/api/logs", logsRouter);

  app.use(errorHandler);

  return app;
}
