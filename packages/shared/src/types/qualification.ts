export interface QualificationAnswer {
  id: string;
  leadId: string;
  questionKey: string;
  questionText: string;
  answerText: string;
  extractedValue: Record<string, unknown> | null;
  confidence: number | null;
  answeredAt: string;
}

export interface QualificationExtraction {
  isQualified: boolean | null;
  personaMatchConfidence: number;
  keyAnswers: Array<{ questionKey: string; answer: string }>;
  disqualifyReason: string | null;
  nextStatusRecommendation:
    | "ENGAGING"
    | "QUALIFIED"
    | "MANUAL_FOLLOWUP"
    | "CLOSED";
}

export interface ClaudeConversationResult {
  replyMessage: string;
  qualification: QualificationExtraction;
}
