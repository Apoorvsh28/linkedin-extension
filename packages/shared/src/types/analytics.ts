export interface AnalyticsSummaryDto {
  searches: number;
  leadsFound: number;
  connectionsSent: number;
  connectionsAccepted: number;
  acceptanceRate: number | null;
  replies: number;
  meetingsBooked: number;
  dealsWon: number;
}
