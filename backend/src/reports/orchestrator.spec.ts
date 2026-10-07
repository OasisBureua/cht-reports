import { ReportGenerationOrchestrator } from './orchestrator';
import type { ContentHubClient } from './packet/content-hub.client';
import type { CompanionClient } from '../companion/companion.client';
import type { ReportDocService } from './render/report-doc.service';
import type { ReportStorageService } from './storage/report-storage.service';
import type { ReportReadyNotifier } from './notify/report-ready.service';
import type { GenerationState, GenerationStateService } from './state/generation-state.service';
import type { TemplateStore } from './templates/template-store.service';

function stateRow(overrides: Partial<GenerationState> = {}): GenerationState {
  return {
    requestId: 'rep-1',
    campaignId: '9',
    sources: [],
    windowStart: null,
    windowEnd: null,
    status: 'queued',
    attemptCount: 0,
    lastError: null,
    s3KeyPdf: null,
    editAttempts: 0,
    version: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function setup(row: GenerationState) {
  const calls: string[] = [];
  const state = {
    get: jest.fn().mockResolvedValue(row),
    initialize: jest.fn(),
    beginAttempt: jest.fn().mockResolvedValue(row),
    markStatus: jest.fn().mockResolvedValue(row),
    markComplete: jest.fn().mockImplementation(async () => {
      calls.push('markComplete');
      return row;
    }),
    markFailed: jest.fn().mockResolvedValue(row),
  };
  const storage = {
    uploadReport: jest.fn().mockImplementation(async (_c: string, _r: string, version: number) => {
      calls.push('upload');
      return `reports/9/rep-1/v${version}.pdf`;
    }),
    saveModelReply: jest.fn(),
  };
  const notifier = {
    notify: jest.fn().mockImplementation(async () => {
      calls.push('notify');
      return true;
    }),
  };
  const contentHub = { fetchReportPacket: jest.fn().mockResolvedValue({ campaignId: 9, template: null }) };
  const templates = {
    load: jest.fn().mockResolvedValue({ template: { systemPrompt: 'prompt', html: undefined }, note: null }),
  };
  const reportDoc = { renderExecutiveSummary: jest.fn().mockResolvedValue('<html></html>') };

  const orchestrator = new ReportGenerationOrchestrator(
    contentHub as unknown as ContentHubClient,
    {} as unknown as CompanionClient,
    reportDoc as unknown as ReportDocService,
    storage as unknown as ReportStorageService,
    notifier as unknown as ReportReadyNotifier,
    state as unknown as GenerationStateService,
    templates as unknown as TemplateStore,
  );
  const generate = jest
    .spyOn(orchestrator as unknown as { generateContent: (...args: unknown[]) => Promise<unknown> }, 'generateContent')
    .mockResolvedValue({ title: 'T' });

  return { orchestrator, state, storage, notifier, generate, calls };
}

describe('ReportGenerationOrchestrator', () => {
  it('writes v1 for a first report, marks it complete, then notifies Platform', async () => {
    const { orchestrator, storage, state, notifier, calls } = setup(stateRow());

    await orchestrator.handle({ requestId: 'rep-1', campaignId: '9' });

    expect(storage.uploadReport).toHaveBeenCalledWith('9', 'rep-1', 1, '<html></html>', { title: 'T' });
    expect(state.markComplete).toHaveBeenCalledWith('rep-1', 'reports/9/rep-1/v1.pdf', 1);
    expect(notifier.notify).toHaveBeenCalledWith({ requestId: 'rep-1', campaignId: '9', version: 1 });
    expect(calls).toEqual(['upload', 'markComplete', 'notify']);
  });

  it('writes the next version after Regenerate (edit_attempts from Platform)', async () => {
    const { orchestrator, storage, state, notifier, generate } = setup(stateRow({ editAttempts: 2 }));

    await orchestrator.handle({ requestId: 'rep-1', campaignId: '9' });

    expect(generate).toHaveBeenCalledWith(expect.anything(), 'prompt', 'rep-1', 3);
    expect(storage.uploadReport.mock.calls[0][2]).toBe(3);
    expect(state.markComplete).toHaveBeenCalledWith('rep-1', 'reports/9/rep-1/v3.pdf', 3);
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ version: 3 }));
  });

  it('does not notify when generation fails', async () => {
    const { orchestrator, state, notifier, generate } = setup(stateRow());
    generate.mockRejectedValue(new Error('companion down'));

    await expect(orchestrator.handle({ requestId: 'rep-1', campaignId: '9' })).rejects.toThrow('companion down');

    expect(state.markFailed).toHaveBeenCalledWith('rep-1', 'companion down');
    expect(state.markComplete).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('does not notify again for an already-complete redelivery', async () => {
    const { orchestrator, notifier, storage } = setup(stateRow({ status: 'complete', version: 1 }));

    await orchestrator.handle({ requestId: 'rep-1', campaignId: '9' });

    expect(storage.uploadReport).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
