import { existsSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import type { PdfPrinter } from './pdf-printer';

function chromiumPath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (existsSync('/usr/bin/chromium-browser')) {
    return '/usr/bin/chromium-browser';
  }
  return '/usr/bin/chromium';
}

@Injectable()
export class ChromiumPdfPrinter implements PdfPrinter {
  async print(html: string): Promise<Buffer> {
    const puppeteer = (await import('puppeteer-core')).default;
    const browser = await puppeteer.launch({
      executablePath: chromiumPath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
