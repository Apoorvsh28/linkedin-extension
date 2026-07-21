import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { getSafetyConfig, SINGLETON_ID } from "../src/services/safetyConfig.service.js";

const app = createApp();

const campaignIds: string[] = [];
const leadIds: string[] = [];

async function createCampaign(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/campaigns")
    .send({
      name: "Test campaign",
      keywords: ["radiologist"],
      locations: [],
      engagementIntervalHours: 0, // advance every tick in tests, no waiting
      dailySearchLimit: 2,
      ...overrides,
    });
  expect(res.status).toBe(201);
  campaignIds.push(res.body.id);
  return res.body;
}

async function createLead(campaignId: string | null, overrides: Record<string, unknown> = {}) {
  const url = `https://www.linkedin.com/in/test-${Math.random().toString(36).slice(2)}`;
  const res = await request(app)
    .post("/api/leads")
    .send([
      {
        linkedinProfileUrl: url,
        fullName: "Test Lead",
        headline: "Radiologist",
        location: "Mumbai",
        persona: "radiologist",
        ...(campaignId ? { campaignId } : {}),
      },
    ]);
  expect(res.status).toBe(201);
  const lead = res.body.leads[0];
  if (overrides && Object.keys(overrides).length > 0) {
    await prisma.lead.update({ where: { id: lead.id }, data: overrides });
  }
  leadIds.push(lead.id);
  return lead;
}

beforeAll(async () => {
  // Make active-hours/caps permissive so dispatch-related assertions aren't time-of-day-dependent.
  await getSafetyConfig();
  await prisma.safetyConfig.update({
    where: { id: SINGLETON_ID },
    data: {
      killSwitch: false,
      activeHoursStartHour: 0,
      activeHoursEndHour: 24,
      connectionRequestsPerDay: 100,
      connectionRequestsPerWeek: 700,
      likesPerDay: 100,
      commentsPerDay: 100,
      messagesPerDay: 100,
      profileVisitsPerDay: 100,
      maxActionAttempts: 3,
    },
  });
});

afterAll(async () => {
  if (leadIds.length > 0) await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  if (campaignIds.length > 0) await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
  await prisma.$disconnect();
});

describe("health", () => {
  it("responds ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("campaigns", () => {
  it("creates, lists, and fetches a campaign", async () => {
    const campaign = await createCampaign({ name: "Radiologists India" });
    expect(campaign.status).toBe("active");

    const list = await request(app).get("/api/campaigns");
    expect(list.status).toBe(200);
    expect(list.body.some((c: { id: string }) => c.id === campaign.id)).toBe(true);

    const detail = await request(app).get(`/api/campaigns/${campaign.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe("Radiologists India");
  });

  it("rejects invalid campaign input with 400, not 500", async () => {
    const res = await request(app).post("/api/campaigns").send({ name: "", keywords: [] });
    expect(res.status).toBe(400);
    expect(res.body.issues).toBeDefined();
  });
});

describe("search tasks", () => {
  it("generates and dispatches search tasks respecting the daily search cap", async () => {
    const campaign = await createCampaign({ keywords: ["radiologist", "diagnostic centre"], dailySearchLimit: 1 });

    const gen = await request(app).post(`/api/campaigns/${campaign.id}/generate-search-tasks`);
    expect(gen.status).toBe(201);
    expect(gen.body.created).toBe(2);

    const next = await request(app).get("/api/search-tasks/next");
    expect(next.status).toBe(200);
    expect(next.body.task).not.toBeNull();
    expect(next.body.task.campaignId).toBe(campaign.id);

    // Report success — this consumes the daily cap of 1.
    await request(app).post(`/api/search-tasks/${next.body.task.taskId}/report`).send({ status: "success", leadsFound: 3 });

    // The second task should now be blocked by the daily cap.
    const next2 = await request(app).get("/api/search-tasks/next");
    expect(next2.status).toBe(200);
    expect(next2.body.task).toBeNull();
    expect(next2.body.reason).toBe("no_eligible_task");
  });
});

describe("full lead lifecycle through the state machine", () => {
  it("advances NEW -> ... -> CONNECT_APPROVAL via the engagement engine, then through approval to CONNECT_PENDING, WELCOME_PENDING, CONNECTED, QUALIFIED", async () => {
    const campaign = await createCampaign({
      connectionNoteTemplate: "Hi {{name}}, let's connect!",
      welcomeMessageTemplate: "Welcome, {{name}}!",
    });
    const lead = await createLead(campaign.id);
    expect(lead.status).toBe("NEW");

    // Default sequence is 4 steps — tick 4 times (engagementIntervalHours: 0 means always due).
    let leadState = lead;
    for (let i = 0; i < 4; i++) {
      const tick = await request(app).post("/api/engine/tick");
      expect(tick.status).toBe(200);
      const detail = await request(app).get(`/api/leads/${lead.id}`);
      leadState = detail.body;
    }

    expect(leadState.status).toBe("CONNECT_APPROVAL");
    expect(leadState.engagementDay).toBe(4);

    const pending = await request(app).get("/api/actions/pending-approval");
    const connectAction = pending.body.find((a: { leadId: string; actionType: string }) => a.leadId === lead.id && a.actionType === "connect_request");
    expect(connectAction).toBeDefined();

    // Approve — template should render with the lead's name.
    const approved = await request(app).post(`/api/actions/${connectAction.id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("queued");
    expect(approved.body.details.content).toContain("Hi Test Lead");

    // Drain the day1-3 engagement actions ahead of it in the FIFO queue (view_profile/like_post/comment_post),
    // the way the background worker would over several ticks, then the connect_request becomes next.
    for (let i = 0; i < 10; i++) {
      const next = await request(app).get("/api/actions/next");
      if (!next.body.action) break;
      if (next.body.action.actionId === connectAction.id) break;
      await request(app).post(`/api/actions/${next.body.action.actionId}/report`).send({ status: "success" });
    }
    const dispatched = await request(app).get("/api/actions/next");
    expect(dispatched.body.action.actionId).toBe(connectAction.id);

    // Report success -> CONNECT_PENDING.
    await request(app).post(`/api/actions/${connectAction.id}/report`).send({ status: "success" });
    let detail = await request(app).get(`/api/leads/${lead.id}`);
    expect(detail.body.status).toBe("CONNECT_PENDING");

    // Simulate the connection-acceptance monitor.
    const accepted = await request(app).post(`/api/leads/${lead.id}/events`).send({ event: "CONNECTION_ACCEPTED" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("WELCOME_PENDING");

    // Queue the welcome message the way the extension's monitor does.
    const welcomeAction = await request(app)
      .post("/api/actions")
      .send({ leadId: lead.id, actionType: "send_message", details: { messageType: "welcome_message" } });
    expect(welcomeAction.status).toBe(201);
    expect(welcomeAction.body.status).toBe("pending_approval");

    detail = await request(app).get(`/api/leads/${lead.id}`);
    expect(detail.body.status).toBe("WELCOME_PENDING"); // no-op, already there

    const approvedWelcome = await request(app).post(`/api/actions/${welcomeAction.body.id}/approve`);
    expect(approvedWelcome.body.details.content).toContain("Welcome, Test Lead");

    await request(app).post(`/api/actions/${welcomeAction.body.id}/report`).send({ status: "success" });
    detail = await request(app).get(`/api/leads/${lead.id}`);
    expect(detail.body.status).toBe("CONNECTED");

    // Manual qualification -> QUALIFIED.
    const qualified = await request(app).post(`/api/leads/${lead.id}/events`).send({ event: "QUALIFIED" });
    expect(qualified.body.status).toBe("QUALIFIED");
  });

  it("stops a lead at day-2 filtering when it no longer matches campaign targeting filters", async () => {
    const campaign = await createCampaign({ currentCompanies: ["Acme Health"] });
    const lead = await createLead(campaign.id, { company: "Some Other Company" });

    await request(app).post("/api/engine/tick"); // day 1 always runs
    let detail = await request(app).get(`/api/leads/${lead.id}`);
    expect(detail.body.engagementDay).toBe(1);
    expect(detail.body.status).toBe("ENGAGING");

    await request(app).post("/api/engine/tick"); // day 2 — filter should now reject
    detail = await request(app).get(`/api/leads/${lead.id}`);
    expect(detail.body.status).toBe("MANUAL_FOLLOWUP");
    expect(detail.body.engagementDay).toBe(1); // never advanced past day 1
  });
});

describe("duplicate prevention", () => {
  it("rejects a second live action of the same type for the same lead", async () => {
    const lead = await createLead(null);

    const first = await request(app).post("/api/actions").send({ leadId: lead.id, actionType: "view_profile" });
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/actions").send({ leadId: lead.id, actionType: "view_profile" });
    expect(second.status).toBe(409);

    const logs = await request(app).get("/api/logs?category=duplicate_skip");
    expect(logs.body.logs.some((l: { leadId: string }) => l.leadId === lead.id)).toBe(true);
  });
});

describe("bulk approve/reject", () => {
  it("approves and rejects multiple pending actions in one call", async () => {
    const leadA = await createLead(null);
    const leadB = await createLead(null);

    const a = await request(app).post("/api/actions").send({ leadId: leadA.id, actionType: "connect_request" });
    const b = await request(app).post("/api/actions").send({ leadId: leadB.id, actionType: "connect_request" });

    const approveRes = await request(app).post("/api/actions/bulk-approve").send({ ids: [a.body.id] });
    expect(approveRes.body.succeeded).toEqual([a.body.id]);

    const rejectRes = await request(app).post("/api/actions/bulk-reject").send({ ids: [b.body.id] });
    expect(rejectRes.body.succeeded).toEqual([b.body.id]);

    const afterA = await request(app).get(`/api/actions?leadId=${leadA.id}`);
    expect(afterA.body.actions[0].status).toBe("queued");
    const afterB = await request(app).get(`/api/actions?leadId=${leadB.id}`);
    expect(afterB.body.actions[0].status).toBe("blocked");
  });
});

describe("retry with exponential backoff and dead-letter", () => {
  it("retries on failure and lands in dead_letter after exhausting attempts, then can be requeued", async () => {
    const lead = await createLead(null);
    const created = await request(app).post("/api/actions").send({ leadId: lead.id, actionType: "view_profile" });
    const actionId = created.body.id;

    // maxActionAttempts is 3 (set in beforeAll) — 3 failures should exhaust it.
    let last;
    for (let i = 0; i < 3; i++) {
      last = await request(app).post(`/api/actions/${actionId}/report`).send({ status: "failed", errorMessage: "boom" });
    }
    expect(last!.body.status).toBe("dead_letter");
    expect(last!.body.attempts).toBe(3);

    const requeued = await request(app).post(`/api/actions/${actionId}/requeue`);
    expect(requeued.status).toBe(200);
    expect(requeued.body.status).toBe("queued");
    expect(requeued.body.attempts).toBe(0);
  });
});

describe("emergency stop", () => {
  it("pauses every active campaign and engages the kill switch", async () => {
    await createCampaign({ name: "Will be paused" });

    const res = await request(app).post("/api/campaigns/pause-all");
    expect(res.status).toBe(200);
    expect(res.body.killSwitchEngaged).toBe(true);
    expect(res.body.pausedCampaigns).toBeGreaterThan(0);

    const campaigns = await request(app).get("/api/campaigns");
    expect(campaigns.body.every((c: { status: string }) => c.status !== "active")).toBe(true);

    const config = await request(app).get("/api/safety-config");
    expect(config.body.killSwitch).toBe(true);

    // Reset for any tests that might run after (none currently, but keep state sane).
    await prisma.safetyConfig.update({ where: { id: SINGLETON_ID }, data: { killSwitch: false } });
  });
});

describe("analytics", () => {
  it("returns a well-shaped summary", async () => {
    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      searches: expect.any(Number),
      leadsFound: expect.any(Number),
      connectionsSent: expect.any(Number),
      connectionsAccepted: expect.any(Number),
      replies: expect.any(Number),
      meetingsBooked: expect.any(Number),
      dealsWon: expect.any(Number),
    });
  });
});

describe("queue summary", () => {
  it("returns counts for all four queues", async () => {
    const res = await request(app).get("/api/queues/summary");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["search", "engagement", "connection", "message"]);
  });
});
