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

/** Survey question schema (CPR-43). Answers are keyed by `id`. */
export interface ReportPacketSurveyQuestion {
  id: string;
  prompt: string;
  /** Native survey types: single_choice, multi_choice, text, long_text, info. */
  type: string;
  /** Option order as the survey shows it. */
  options?: string[] | null;
  surveyType?: string | null;
}

/** Hub KOL record (CPR-45): from the campaign's attached KOLs and linked shoots. */
export interface ReportPacketKol {
  name: string;
  title: string | null;
  institution: string | null;
}

/** One attendee, without identity (CPR-42). */
export interface ReportPacketAttendee {
  specialty: string | null;
  institution: string | null;
  minutesWatched: number | null;
}

export interface ReportPacketPlatformSlice {
  platform: string;
  fetchDate: string;
  status: string;
  rowCount: number | null;
  rows: Record<string, unknown>[];
  syncedAt: string | null;
}

/** CPR-25: Hub catalog pointer to the template body in the reports bucket. */
export interface ReportPacketTemplate {
  id: number;
  type: string;
  semver: string;
  s3Key: string;
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
  /** CPR-43. Absent until Hub exports the schema. */
  surveyQuestions?: ReportPacketSurveyQuestion[];
  kols?: ReportPacketKol[];
  /** CPR-42 attendance metrics. Absent until Hub exports them. */
  registeredCount?: number | null;
  attendedCount?: number | null;
  avgMinutesWatched?: number | null;
  attendees?: ReportPacketAttendee[];
  /** Absent on older Hub deploys; null when Hub has no template row. */
  template?: ReportPacketTemplate | null;
  inputCompleteness: Record<string, SourceCompleteness>;
}

export interface FetchReportPacketInput {
  campaignId: number | string;
  windowStart?: string | null;
  windowEnd?: string | null;
  sources?: string[];
  /** Spine id (SQS reportId). Sent as X-Request-Id. */
  requestId?: string;
}