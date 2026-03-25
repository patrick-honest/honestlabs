// ---------------------------------------------------------------------------
// Font Loader — loads Noto Sans JP TTF for jsPDF and chartjs-node-canvas
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import type jsPDF from "jspdf";

const FONT_DIR = path.resolve(__dirname, "fonts");
const NOTO_SANS_JP_PATH = path.join(FONT_DIR, "NotoSansJP-Regular.ttf");

let _fontBuffer: Buffer | null = null;
let _fontBase64: string | null = null;

/** Read font file once and cache */
function loadFontBuffer(): Buffer {
  if (!_fontBuffer) {
    if (!fs.existsSync(NOTO_SANS_JP_PATH)) {
      throw new Error(`Font file not found: ${NOTO_SANS_JP_PATH}`);
    }
    _fontBuffer = fs.readFileSync(NOTO_SANS_JP_PATH);
  }
  return _fontBuffer;
}

/** Base64 encoded font data (cached) */
export function getFontBase64(): string {
  if (!_fontBase64) {
    _fontBase64 = loadFontBuffer().toString("base64");
  }
  return _fontBase64;
}

/** Absolute path to the font TTF */
export function getFontPath(): string {
  return NOTO_SANS_JP_PATH;
}

/** Raw font buffer */
export function getFontBuffer(): Buffer {
  return loadFontBuffer();
}

/**
 * Register Noto Sans JP with a jsPDF document instance.
 * After calling this, use doc.setFont("NotoSansJP", "normal") for CJK text.
 */
export function registerFontWithJsPDF(doc: jsPDF): void {
  const base64 = getFontBase64();
  doc.addFileToVFS("NotoSansJP-Regular.ttf", base64);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
}

/**
 * Returns the registration callback for chartjs-node-canvas's
 * ChartJSNodeCanvas constructor option `chartCallback`.
 */
export function getChartJSFontRegistration(): {
  path: string;
  family: string;
} {
  return {
    path: NOTO_SANS_JP_PATH,
    family: "NotoSansJP",
  };
}
