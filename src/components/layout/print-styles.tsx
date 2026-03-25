"use client";
import { useEffect } from "react";

const PRINT_CSS = `
@media print {
  @page {
    size: letter portrait;
    margin: 0.5in 0.5in 0.7in 0.5in;
  }
  nav, header, [data-print-hide], .no-print { display: none !important; }
  html, body { height: auto !important; overflow: visible !important; }
  body > div, main, [class*="overflow"] {
    height: auto !important; overflow: visible !important; position: static !important;
  }
  .flex.h-screen { height: auto !important; display: block !important; }
  body {
    background: white !important; color: #1a1a1a !important;
    font-size: 9pt; line-height: 1.35;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  /* Page break control */
  .chart-card-wrapper, [class*="rounded-xl"] { page-break-inside: avoid; margin-bottom: 8pt; }
  h1, h2, h3, h4 { page-break-after: avoid; }
  /* Preserve chart colors */
  svg, svg *, .recharts-surface, .recharts-surface * {
    color: inherit !important; fill: inherit !important; stroke: inherit !important;
  }
  /* Reset backgrounds */
  div:not([class*="recharts"]):not([style*="gradient"]),
  main, section, article, td, th { background: white !important; }
  /* Keep colored elements */
  [data-print-hero] {
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  /* Print-visible elements */
  [data-print-only] { display: block !important; }
}
[data-print-only] { display: none; }
`;

export function PrintStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
  return null;
}
