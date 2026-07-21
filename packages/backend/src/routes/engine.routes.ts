import { Router } from "express";
import { runEngagementEngineTick } from "../services/engagementEngine.js";

export const engineRouter: Router = Router();

// POST /api/engine/tick — called by the extension's background alarm loop on every cycle.
engineRouter.post("/tick", async (_req, res, next) => {
  try {
    const result = await runEngagementEngineTick();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
