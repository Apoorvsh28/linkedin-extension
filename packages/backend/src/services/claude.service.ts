import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { OFFERING_SUMMARY } from "../config/offering.js";
import type {
  ClaudeConversationResult,
  Message,
  MessageType,
  Persona,
} from "@lgx/shared";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

const MODEL = "claude-opus-4-8";

const PERSONA_CONTEXT: Record<Persona, string> = {
  radiologist:
    "An individual radiologist. Speak clinician-to-clinician; lead with clinical/workflow value, not business jargon.",
  diagnostic_centre_owner:
    "Owns or operates a diagnostic imaging centre. Frame value in terms of throughput, cost, and turnaround time for their centre.",
  teleradiology_founder:
    "Founder/exec at a teleradiology company. Frame value in terms of scaling reporting capacity and radiologist network economics.",
};

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    replyMessage: { type: "string" },
    qualification: {
      type: "object",
      properties: {
        isQualified: { type: ["boolean", "null"] },
        personaMatchConfidence: { type: "number" },
        keyAnswers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionKey: { type: "string" },
              answer: { type: "string" },
            },
            required: ["questionKey", "answer"],
            additionalProperties: false,
          },
        },
        disqualifyReason: { type: ["string", "null"] },
        nextStatusRecommendation: {
          type: "string",
          enum: ["ENGAGING", "QUALIFIED", "MANUAL_FOLLOWUP", "CLOSED"],
        },
      },
      required: [
        "isQualified",
        "personaMatchConfidence",
        "keyAnswers",
        "disqualifyReason",
        "nextStatusRecommendation",
      ],
      additionalProperties: false,
    },
  },
  required: ["replyMessage", "qualification"],
  additionalProperties: false,
} as const;

function personaSystemPrompt(persona: Persona): string {
  return [
    "You are a professional B2B sales development rep conducting outreach on LinkedIn.",
    OFFERING_SUMMARY,
    `Persona context: ${PERSONA_CONTEXT[persona]}`,
    "Write like a real person, not a template. Keep connection-note-style messages under 300 characters and full messages under 800 characters. Never use generic filler phrases like 'I hope this finds you well'.",
  ].join("\n\n");
}

function formatHistory(history: Message[]): string {
  if (history.length === 0) return "(no messages yet)";
  return history
    .map((m) => `${m.direction === "outbound" ? "Us" : "Them"}: ${m.content}`)
    .join("\n");
}

export async function generateNextMessage(params: {
  persona: Persona;
  fullName: string;
  headline: string | null;
  messageType: MessageType;
  conversationHistory: Message[];
}): Promise<ClaudeConversationResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: personaSystemPrompt(params.persona),
    output_config: { format: { type: "json_schema", schema: REPLY_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          `Lead: ${params.fullName} (${params.headline ?? "no headline"})`,
          `Message type to generate: ${params.messageType}`,
          "",
          "Conversation so far:",
          formatHistory(params.conversationHistory),
          "",
          "Generate the next message and a qualification assessment based on everything said so far.",
        ].join("\n"),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text block");
  }
  return JSON.parse(textBlock.text) as ClaudeConversationResult;
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    reason: { type: "string" },
  },
  required: ["score", "reason"],
  additionalProperties: false,
} as const;

export async function scoreLead(params: {
  persona: Persona;
  fullName: string;
  headline: string | null;
  currentPosition: string | null;
  company: string | null;
  aboutText: string | null;
  postCountLast30Days: number;
}): Promise<{ score: number; reason: string }> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: personaSystemPrompt(params.persona),
    output_config: { format: { type: "json_schema", schema: SCORE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          "Score this lead's fit for outreach from 0 (poor fit) to 100 (ideal fit), weighing persona/role fit, ",
          "seniority implied by their title, and engagement signal (recent posting suggests they're active and ",
          "more likely to respond).",
          "",
          `Name: ${params.fullName}`,
          `Headline: ${params.headline ?? "unknown"}`,
          `Current position: ${params.currentPosition ?? "unknown"}`,
          `Company: ${params.company ?? "unknown"}`,
          `About: ${(params.aboutText ?? "unknown").slice(0, 1000)}`,
          `Posts in last 30 days: ${params.postCountLast30Days}`,
          "",
          "Return an integer score 0-100 and a one-sentence reason.",
        ].join("\n"),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text block");
  }
  return JSON.parse(textBlock.text) as { score: number; reason: string };
}

export async function generateNextComment(params: {
  persona: Persona;
  fullName: string;
  postSummary: string;
}): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: personaSystemPrompt(params.persona),
    messages: [
      {
        role: "user",
        content: [
          `Lead: ${params.fullName}`,
          `They posted: ${params.postSummary}`,
          "",
          "Write a short, genuine, specific LinkedIn comment (1-2 sentences, no hashtags, no emoji) reacting to their post. Return only the comment text, nothing else.",
        ].join("\n"),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text block");
  }
  return textBlock.text.trim();
}
