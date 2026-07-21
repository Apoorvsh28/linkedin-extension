import type { ActionType } from "@lgx/shared";
import { applyLeadEvent } from "./leadStateMachine.js";

/** Centralizes the (actionType, messageType) -> lead-status-event mapping used at every approval-workflow stage. */
export async function onActionProposed(leadId: string, actionType: ActionType, messageType?: string): Promise<void> {
  if (actionType === "connect_request") {
    await applyLeadEvent(leadId, "CONNECT_PROPOSED");
  } else if (actionType === "send_message") {
    if (messageType === "welcome_message") await applyLeadEvent(leadId, "WELCOME_PROPOSED");
    else if (messageType === "qualification_question") await applyLeadEvent(leadId, "QUALIFY_PROPOSED");
  }
}

export async function onActionRejected(leadId: string, actionType: ActionType, messageType?: string): Promise<void> {
  if (actionType === "connect_request") {
    await applyLeadEvent(leadId, "CONNECT_REJECTED");
  } else if (actionType === "send_message") {
    if (messageType === "welcome_message") await applyLeadEvent(leadId, "WELCOME_REJECTED");
    else if (messageType === "qualification_question") await applyLeadEvent(leadId, "QUALIFY_REJECTED");
  }
}

export async function onActionSentSuccessfully(leadId: string, actionType: ActionType, messageType?: string): Promise<void> {
  if (actionType === "connect_request") {
    await applyLeadEvent(leadId, "CONNECT_REQUEST_SENT");
  } else if (actionType === "send_message") {
    if (messageType === "welcome_message") await applyLeadEvent(leadId, "WELCOME_SENT");
    else if (messageType === "qualification_question") await applyLeadEvent(leadId, "QUALIFY_SENT");
  }
}
