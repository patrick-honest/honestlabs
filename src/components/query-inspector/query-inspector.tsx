"use client";

import { useState, useCallback } from "react";
import { Code2, Copy, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueryParam {
  name: string;
  value: string | number;
  type: "STRING" | "INT64" | "DATE" | "FLOAT64";
}

export interface QueryInfo {
  /** Human-readable title for this query */
  title: string;
  /** The raw SQL template with @param placeholders */
  sql: string;
  /** Parameters and their resolved values */
  params: QueryParam[];
  /** Optional: estimated bytes that would be scanned */
  estimatedBytes?: number;
}

interface QueryInspectorButtonProps {
  query: QueryInfo;
  className?: string;
}

/** Small button that opens the query inspector modal */
export function QueryInspectorButton({ query, className }: QueryInspectorButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-[#6B6394] hover:text-[#7C4DFF] hover:bg-[#5B22FF]/10 transition-colors",
          className
        )}
        title="Inspect SQL query"
      >
        <Code2 className="h-3 w-3" />
        <span>SQL</span>
      </button>

      {open && <QueryInspectorModal query={query} onClose={() => setOpen(false)} />}
    </>
  );
}

interface QueryInspectorModalProps {
  query: QueryInfo;
  onClose: () => void;
}

function QueryInspectorModal({ query, onClose }: QueryInspectorModalProps) {
  const [copied, setCopied] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  // Build the resolved SQL (replace @param with actual values)
  const resolvedSql = query.params.reduce((sql, param) => {
    const value =
      param.type === "STRING" || param.type === "DATE"
        ? `'${param.value}'`
        : String(param.value);
    return sql.replace(new RegExp(`@${param.name}\\b`, "g"), value);
  }, query.sql);

  const displaySql = showResolved ? resolvedSql : query.sql;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(resolvedSql.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = resolvedSql.trim();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [resolvedSql]);

  const estimatedCost = query.estimatedBytes
    ? `~$${((query.estimatedBytes / 1_099_511_627_776) * 6.25).toFixed(4)}`
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-[#2D2955] bg-[#0B0A1A] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2D2955] px-5 py-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[#5B22FF]" />
            <h3 className="text-sm font-semibold text-[#F0EEFF]">{query.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {estimatedCost && (
              <span className="text-[10px] text-[#6B6394]">
                Est. cost: {estimatedCost}
              </span>
            )}
            <button onClick={onClose} className="text-[#6B6394] hover:text-[#F0EEFF]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[#2D2955] px-5 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResolved(false)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !showResolved ? "bg-[#5B22FF] text-white" : "text-[#6B6394] hover:text-[#F0EEFF]"
              )}
            >
              Template
            </button>
            <button
              onClick={() => setShowResolved(true)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                showResolved ? "bg-[#5B22FF] text-white" : "text-[#6B6394] hover:text-[#F0EEFF]"
              )}
            >
              Resolved
            </button>
          </div>
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              copied
                ? "bg-[#06D6A0]/20 text-[#06D6A0]"
                : "bg-[#1E1B3A] text-[#9B94C4] hover:text-[#F0EEFF]"
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied!" : "Copy resolved SQL"}</span>
          </button>
        </div>

        {/* SQL Body */}
        <div className="flex-1 overflow-auto p-5">
          <pre className="rounded-xl bg-[#141226] border border-[#2D2955] p-4 text-xs leading-relaxed overflow-x-auto">
            <code className="text-[#9B94C4]">
              {highlightSql(displaySql, !showResolved)}
            </code>
          </pre>
        </div>

        {/* Parameters */}
        {query.params.length > 0 && (
          <div className="border-t border-[#2D2955]">
            <button
              onClick={() => setShowParams(!showParams)}
              className="flex w-full items-center justify-between px-5 py-2 text-xs font-medium text-[#9B94C4] hover:text-[#F0EEFF]"
            >
              <span>Parameters ({query.params.length})</span>
              {showParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showParams && (
              <div className="px-5 pb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6B6394]">
                      <th className="text-left py-1 pr-4 font-medium">Name</th>
                      <th className="text-left py-1 pr-4 font-medium">Type</th>
                      <th className="text-left py-1 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.params.map((p) => (
                      <tr key={p.name} className="border-t border-[#2D2955]/50">
                        <td className="py-1.5 pr-4 text-[#7C4DFF] font-mono">@{p.name}</td>
                        <td className="py-1.5 pr-4 text-[#6B6394]">{p.type}</td>
                        <td className="py-1.5 text-[#F0EEFF] font-mono">{String(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Simple SQL syntax highlighter for dark theme */
function highlightSql(sql: string, highlightParams: boolean): React.ReactNode {
  const keywords = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|AS|WITH|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP|BY|ORDER|DESC|ASC|LIMIT|HAVING|CASE|WHEN|THEN|ELSE|END|DISTINCT|COUNT|SUM|AVG|MIN|MAX|ROUND|SAFE_DIVIDE|COALESCE|IF|BETWEEN|LIKE|IS|NULL|TRUE|FALSE|UNION|ALL|EXISTS|FORMAT_DATE|DATE_TRUNC|COUNTIF|CONCAT|TRIM|UPPER|LOWER|REGEXP_CONTAINS|REGEXP_EXTRACT|REGEXP_REPLACE)\b/gi;
  const strings = /'[^']*'/g;
  const params = /@\w+/g;
  const numbers = /\b\d+\.?\d*\b/g;

  const lines = sql.split("\n");

  return lines.map((line, i) => {
    // Apply highlighting
    let highlighted = line
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(keywords, '<kw>$1</kw>')
      .replace(strings, '<str>$&</str>')
      .replace(numbers, '<num>$&</num>');

    if (highlightParams) {
      highlighted = highlighted.replace(params, '<param>$&</param>');
    }

    // Convert markers to spans
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const tagRegex = /<(kw|str|num|param)>(.*?)<\/\1>/g;
    let match;

    while ((match = tagRegex.exec(highlighted)) !== null) {
      if (match.index > lastIdx) {
        parts.push(highlighted.slice(lastIdx, match.index));
      }
      const colorMap: Record<string, string> = {
        kw: "#7C4DFF",
        str: "#06D6A0",
        num: "#FFD166",
        param: "#FF6B6B",
      };
      parts.push(
        <span key={`${i}-${match.index}`} style={{ color: colorMap[match[1]] }}>
          {match[2]}
        </span>
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < highlighted.length) {
      parts.push(highlighted.slice(lastIdx));
    }

    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}
