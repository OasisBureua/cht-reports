/**
 * Loads the report template (system prompt + HTML skeleton) the packet points
 * at: `{s3Key}system-prompt.md` and `{s3Key}template.html` in the reports
 * bucket (CPR-25). Versions are immutable, so loaded files are cached per key.
 *
 * Never fails generation: no pointer or a failed load falls back to the
 * built-in template, with a note for the input-completeness section.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { AwsClients } from '../../aws/aws-clients';
import type { ReportPacketTemplate } from '../packet/report-packet.types';
import { BUILTIN_HTML_TEMPLATE, BUILTIN_SYSTEM_PROMPT } from './builtin';

export interface LoadedTemplate {
  systemPrompt: string;
  html: string;
  source: 's3' | 'builtin';
  semver: string | null;
}

export interface TemplateLoadResult {
  template: LoadedTemplate;
  /** Set when a pointer existed but its files couldn't be used. */
  note: string | null;
}

const BUILTIN: LoadedTemplate = {
  systemPrompt: BUILTIN_SYSTEM_PROMPT,
  html: BUILTIN_HTML_TEMPLATE,
  source: 'builtin',
  semver: null,
};

@Injectable()
export class TemplateStore {
  private readonly logger = new Logger(TemplateStore.name);
  private readonly cache = new Map<string, Promise<LoadedTemplate>>();

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
  ) {}

  async load(pointer: ReportPacketTemplate | null | undefined): Promise<TemplateLoadResult> {
    if (!pointer?.s3Key) {
      // Hub already reports `template: missing` in inputCompleteness.
      return { template: BUILTIN, note: null };
    }

    const prefix = pointer.s3Key.endsWith('/') ? pointer.s3Key : `${pointer.s3Key}/`;
    let pending = this.cache.get(prefix);
    if (!pending) {
      pending = this.fetch(prefix, pointer.semver);
      this.cache.set(prefix, pending);
    }

    try {
      return { template: await pending, note: null };
    } catch (err) {
      this.cache.delete(prefix);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Template ${pointer.type} ${pointer.semver} (${prefix}) not loaded: ${message}`);
      return {
        template: BUILTIN,
        note: `template: ${pointer.type} ${pointer.semver} could not be loaded; the built-in template was used`,
      };
    }
  }

  private async fetch(prefix: string, semver: string): Promise<LoadedTemplate> {
    const [systemPrompt, html] = await Promise.all([
      this.getText(`${prefix}system-prompt.md`),
      this.getText(`${prefix}template.html`),
    ]);
    if (!systemPrompt.trim() || !html.trim()) {
      throw new Error('template file is empty');
    }
    return { systemPrompt: systemPrompt.trim(), html, source: 's3', semver };
  }

  private async getText(key: string): Promise<string> {
    const response = await this.aws.s3.send(
      new GetObjectCommand({ Bucket: this.env.reportsBucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`empty body for ${key}`);
    }
    return response.Body.transformToString('utf-8');
  }
}
