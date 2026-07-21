export type ReminderStatus = "pending" | "done" | "dismissed";

export interface Reminder {
  id: string;
  leadId: string;
  reminderType: string;
  dueAt: string;
  status: ReminderStatus;
  note: string | null;
}
