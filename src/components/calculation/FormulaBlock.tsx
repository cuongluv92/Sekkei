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
      <span className="w-fit rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">{badge}</span>
      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11.5px]">
          <span className="text-muted-2">{line.formula}</span>
          {line.substituted && <span className="text-muted-2">= {line.substituted}</span>}
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
      <span className="text-[11px] font-bold text-foreground">{title}</span>
      <p className="text-[11px] leading-relaxed text-muted-2">{body}</p>
    </div>
  );
}
