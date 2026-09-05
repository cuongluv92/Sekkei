import { SOURCES, type Cell } from '@/lib/calc/motorSelection/catalogSelection';
export function SelectionCell({value}:{value:Cell}) {
  const source=Object.values(SOURCES).find(s=>s.url===value.source);
  return <div className="space-y-1 whitespace-pre-line text-[11px] leading-relaxed">
    <div>{value.amps!==null&&<strong className="font-mono text-[13px] font-extrabold">{value.amps} A</strong>}{value.amps!==null&&value.text&&!value.text.startsWith('（')&&<br/>}{value.text|| (value.amps===null?'要確認':'')}</div>
    {(value.note||value.source)&&<details className="text-muted"><summary className="cursor-pointer">出典・条件</summary><div>{value.note}</div>{value.source&&<a className="text-accent underline" href={value.source} target="_blank" rel="noreferrer">{source?.title??'ユーザー指定出典'}</a>}</details>}
  </div>;
}
