import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';

/**
 * ZTTeamPuppeteerService — Renders HTML templates into transparent PNG overlays.
 * Uses headless Chromium to capture a single screenshot of the template layout.
 */
@Injectable()
export class ZTTeamPuppeteerService {
  private readonly logger = new Logger('ZTTeamPuppeteerService');

  /**
   * Helper method to launch Chromium with optimized memory flags and retry support
   */
  private async ztteam_launchBrowser(): Promise<puppeteer.Browser> {
    const ztteam_launchOptions = {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-breakpad',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--force-color-profile=srgb',
      ],
    };

    try {
      return await puppeteer.launch(ztteam_launchOptions);
    } catch (ztteam_firstError: any) {
      this.logger.warn(`Puppeteer initial launch failed (${ztteam_firstError.message}). Retrying in 1s...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await puppeteer.launch(ztteam_launchOptions);
    }
  }

  /**
   * Render a template HTML string into a PNG image/overlay.
   *
   * @param htmlContent - The complete HTML template (with CSS included)
   * @param outputPath - Where to save the overlay PNG
   * @param width - Viewport width
   * @param height - Viewport height
   */
  async ztteam_renderOverlay(htmlContent: string, outputPath: string, width: number = 1080, height: number = 1920): Promise<void> {
    this.logger.log(`Launching Puppeteer for render (${width}x${height})...`);

    let browser: puppeteer.Browser | null = null;

    try {
      browser = await this.ztteam_launchBrowser();

      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });

      /**
       * Master Vietnamese font definitions and style overrides
       */
      const masterFontStyles = `
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;600;700;800;900&family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;600;700;800;900&family=Roboto:wght@400;500;700;900&display=swap');
          
          *, html, body, div, span, p, h1, h2, h3, .pname, .hook, .line, .header, .title, .excerpt {
            font-family: 'Montserrat', 'Plus Jakarta Sans', 'Inter', 'Roboto', 'Noto Sans', 'DejaVu Sans', sans-serif !important;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${width}px;
            height: ${height}px;
            background: transparent !important;
            overflow: hidden;
          }
          .video-frame {
            background: transparent !important;
          }
        </style>
      `;

      let wrappedHtml = htmlContent;
      if (wrappedHtml.includes('<head>')) {
        wrappedHtml = wrappedHtml.replace('<head>', `<head><meta charset="UTF-8">${masterFontStyles}`);
      } else if (wrappedHtml.includes('<html')) {
        wrappedHtml = wrappedHtml.replace(/<html[^>]*>/, `$&<head><meta charset="UTF-8">${masterFontStyles}</head>`);
      } else {
        wrappedHtml = `
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            ${masterFontStyles}
          </head>
          <body>
            ${htmlContent}
          </body>
          </html>
        `;
      }

      try {
        await page.setContent(wrappedHtml, { waitUntil: 'load', timeout: 10000 });
      } catch (e) {
        /** Fallback to domcontentloaded if load event times out */
        await page.setContent(wrappedHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }

      /** Ensure all web fonts are fully rendered */
      try {
        await page.evaluateHandle('document.fonts.ready');
      } catch (e) {
        /** Ignore if fonts ready check is unsupported */
      }

      /** Small buffer for any remaining CSS paint */
      await new Promise(resolve => setTimeout(resolve, 300));

      /** Screenshot with transparent background */
      await page.screenshot({
        path: outputPath,
        omitBackground: true,
        type: 'png',
      });

      this.logger.log(`Overlay rendered: ${outputPath}`);
    } catch (error: any) {
      this.logger.error(`Puppeteer render failed: ${error.message}`);
      throw new Error('Lỗi render overlay: ' + error.message);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr: any) {
          this.logger.warn(`Failed to close browser cleanly: ${closeErr.message}`);
        }
      }
    }
  }
}
