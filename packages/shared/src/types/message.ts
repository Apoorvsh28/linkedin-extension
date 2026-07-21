export type MessageDirection = "outbound" | "inbound";

export type MessageType =
  | "connection_note"
  | "welcome_message"
  | "qualification_question"
  | "follow_up"
  | "ai_reply"
  | "manual";

export interface Message {
  id: string;
  leadId: string;
  direction: MessageDirection;
  messageType: MessageType;
  content: string;
  sentAt: string;
  linkedinMessageId: string | null;
  aiModelUsed: string | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
}

export type WaitingOn = "us" | "them";

export interface ConversationState {
  leadId: string;
  currentStage: string;
  waitingOn: WaitingOn;
  qualificationScore: number | null;
  isQualified: boolean | null;
  disqualifiedReason: string | null;
  lastMessageAt: string | null;
  updatedAt: string;
}
