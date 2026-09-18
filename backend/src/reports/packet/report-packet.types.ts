export interface SourceCompleteness {
  fetchedAt: string | null;
  rowCount: number;
  status: 'ok' | 'missing' | 'error';
}

export interface ReportPacketSession {
  platformToolProgramId: string | null;
  kind: string | null;
  title: string | null;
  sessionDate: string | null;
  zoomMeetingUuid: string | null;
  transcriptText: string;
}

export interface ReportPacketSurvey {
  respondentId: string | null;
  source: string;
  surveyType: string | null;
  submittedAt: string | null;
  answers: Record<string, unknown>;
}

export interface ReportPacketPlatformSlice {
  platform: string;
  fetchDate: string;
  status: string;
  rowCount: number | null;
  rows: Record<string, unknown>[];
  syncedAt: string | null;
}

export interface ReportInputPacket {
  campaignId: number;
  campaignName: string;
  windowStart: string | null;
  windowEnd: string | null;
  sources: string[];
  hubspotRawData: unknown;
  platformSlices: ReportPacketPlatformSlice[];
  sessions: ReportPacketSession[];
  surveyResponses: ReportPacketSurvey[];
  inputCompleteness: Record<string, SourceCompleteness>;
}

export interface FetchReportPacketInput {
  campaignId: number | string;
  windowStart?: string | null;
  windowEnd?: string | null;
  sources?: string[];
}