"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * 計算結果の横に、実際に使った式と代入値をそのまま表示する共通部品 —
 * 数値だけでなく計算過程を追えるようにする (耐震計算・換気計算 共通)。
 */
export interface FormulaLine {
  formula: string;
  substituted?: string;
  result: string;
}

export function FormulaBlock({ badge, lines }: { badge: string; lines: FormulaLine[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/10 px-3 py-2.5">
      <span className="w-fit rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-muted">{badge}</span>
      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2 font-mono text-[13px]">
          <span className="text-muted">{line.formula}</span>
          {line.substituted && <span className="text-muted">= {line.substituted}</span>}
          <span className="font-semibold text-foreground">= {line.result}</span>
        </div>
      ))}
    </div>
  );
}

/** 出典・計算根拠を明示する専用セクション (根拠を持たない数値をあたかも標準値であるかのように見せない)。 */
export function SourceNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/10 px-3 py-2.5">
      <span className="text-[12.5px] font-bold text-foreground">{title}</span>
      <p className="text-[12.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

/**
 * 「なぜこの値・この表になるのか」を、対象の項目・式のすぐ隣に置く小さな
 * 折りたたみ開閉部品。クリックするまでは1行のリンクだけを表示し、開くと
 * 短い理由説明（＋必要なら参照表）を表示する。入力の仕方そのもの（どれを
 * 選ぶか）は各項目下の既存ヒントで案内済みなので、ここに重複させない —
 * 中身は「なぜその区分・その数値になっているか」の根拠だけに絞る。
 */
export function WhyDisclosure({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
      {open && (
        <div className="mt-1 flex max-w-md flex-col gap-1.5 rounded-md border border-border bg-muted/10 px-2.5 py-2">
          <span className="text-[12.5px] font-bold text-foreground">{title}</span>
          <div className="text-[12.5px] leading-relaxed text-muted">{children}</div>
        </div>
      )}
    </div>
  );
}

/** WhyDisclosure内で参照表を表示するための共通テーブル (横スクロール対応)。 */
export function WhyTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-1.5 text-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
