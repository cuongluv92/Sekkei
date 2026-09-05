'use client';
import { useEffect, useState } from 'react';
import { catalogue, FIELD_LABELS, FIELDS, keyOf, METHODS, STANDARD_KW, validateValues, type Correction, type Field, type SelectionKey, type Values } from '@/lib/calc/motorSelection/catalogSelection';
import { selectionCorrectionService, changedFields } from '@/lib/services/selectionCorrectionService';
import { SelectionCell } from '@/components/selection/SelectionCell';

export function SelectionDataEditor() {
  const [key,setKey]=useState<SelectionKey>({maker:'mitsubishi',voltage:'200V',method:'direct',kw:0.1});
  const [kw,setKw]=useState('0.1');
  const [corrections,setCorrections]=useState<Correction[]>([]);
  const [values,setValues]=useState<Values>(()=>catalogue(key));
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const existing=corrections.find(c=>keyOf(c)===keyOf(key));
  async function reload() {try {const data=await selectionCorrectionService.list();setCorrections(data);setLoaded(true);return data;}catch(e){setLoaded(false);setError(String(e));return null;}}
  useEffect(()=>{void reload().then(data=>{if(data)setValues(structuredClone(data.find(c=>keyOf(c)===keyOf(key))?.values??catalogue(key)));});},[]);
  function select(next:SelectionKey) {setKey(next);setKw(String(next.kw));setValues(structuredClone(corrections.find(c=>keyOf(c)===keyOf(next))?.values??catalogue(next)));setStatus('');setError('');}
  function edit(f:Field,p:'amps'|'text'|'source'|'note',value:string) {setValues(prev=>({...prev,[f]:{...prev[f],[p]:p==='amps'?(value===''?null:Number(value)):value}}));}
  async function save() {
    setBusy(true);setError('');setStatus('');
    try {if(Number(kw)!==key.kw)throw new Error('kW変更後は「組合せを開く」を押してください');validateValues(key,values);await selectionCorrectionService.save(key,values,structuredClone(existing?.values??catalogue(key)),existing);await reload();setStatus('ユーザー修正値を保存しました');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  async function reset() {setBusy(true);setError('');try{await selectionCorrectionService.reset(key);await reload();setValues(catalogue(key));setStatus('カタログ値に戻しました');}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <section className="space-y-4" aria-label="選定データ編集">
    <h2 className="panel-title">選定データ編集</h2>
    <p className="text-xs text-muted">ユーザー修正値はメーカー・電圧・kW・始動方式ごとにデータベースへ保存し、選定・分岐計算で優先します。原本カタログは変更しません。三相用。</p>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <label>メーカー<select className="field-input" value={key.maker} disabled={busy} onChange={e=>select({...key,maker:e.target.value as SelectionKey['maker']})}><option value="mitsubishi">三菱電機</option><option value="fuji">富士電機</option></select></label>
      <label>電圧<select className="field-input" value={key.voltage} disabled={busy} onChange={e=>select({...key,voltage:e.target.value as SelectionKey['voltage']})}><option>200V</option><option>400V</option></select></label>
      <label>始動方式<select className="field-input" value={key.method} disabled={busy} onChange={e=>select({...key,method:e.target.value as SelectionKey['method']})}>{Object.entries(METHODS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>電動機 kW<input className="field-input" type="number" min="0.1" step="any" list="editor-kw" value={kw} onChange={e=>setKw(e.target.value)}/><datalist id="editor-kw">{[...new Set([...STANDARD_KW,...corrections.map(c=>c.kw)])].sort((a,b)=>a-b).map(n=><option key={n} value={n}/>)}</datalist></label>
      <button type="button" className="btn-secondary" disabled={busy||!loaded} onClick={()=>{const n=Number(kw);if(!Number.isFinite(n)||n<0.1){setError('kWは0.1以上を入力してください');return;}select({...key,kw:n});}}>組合せを開く</button>
    </div>
    <p className="text-xs">編集中: {key.maker} / {key.voltage} / {key.kw} kW / {METHODS[key.method]} {existing&&`・修正済み ${new Date(existing.updated_at).toLocaleString('ja-JP')}`}</p>
    <div className="grid gap-3 md:grid-cols-2">{FIELDS.map(f=><fieldset className="rounded border border-border p-3 space-y-2" key={f}><legend>{FIELD_LABELS[f]}</legend>
      {(['load','starting','breaker','thermal'] as Field[]).includes(f)&&<label className="block text-xs">主電流 A（空欄＝要確認）<input className="field-input" type="number" min="0" step="any" value={values[f].amps??''} onChange={e=>edit(f,'amps',e.target.value)}/></label>}
      <label className="block text-xs">型式・表示補足{f==='thermal'?'（例： （18～26 A）改行 TH-T25）':''}<textarea className="field-input" rows={2} value={values[f].text} onChange={e=>edit(f,'text',e.target.value)}/></label>
      <label className="block text-xs">出典URL<input className="field-input" type="url" value={values[f].source} onChange={e=>edit(f,'source',e.target.value)}/></label>
      <label className="block text-xs">資料名・版・頁/表・条件/備考<textarea className="field-input" rows={2} value={values[f].note} onChange={e=>edit(f,'note',e.target.value)}/></label>
    </fieldset>)}</div>
    {error&&<p role="alert" className="text-danger text-sm">{error}</p>}{status&&<p role="status" className="text-accent text-sm">{status}</p>}
    <div className="flex gap-2"><button type="button" className="btn-primary" onClick={()=>void save()} disabled={busy||!loaded}>ユーザー修正値を保存</button><button type="button" className="btn-secondary" onClick={()=>void reset()} disabled={busy||!loaded||!existing}>カタログ値に戻す</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void reload().then(data=>{if(data)setValues(structuredClone(data.find(c=>keyOf(c)===keyOf(key))?.values??catalogue(key)));})}>再読込</button></div>
    {existing&&<details><summary>修正済み・変更前／変更後（{new Date(existing.updated_at).toLocaleString('ja-JP')}）</summary><table className="data-table"><thead><tr><th>項目</th><th>変更前</th><th>変更後</th></tr></thead><tbody>{changedFields(existing).map(f=><tr key={f}><th>{FIELD_LABELS[f]}</th><td><SelectionCell value={existing.before[f]}/></td><td><SelectionCell value={existing.values[f]}/></td></tr>)}</tbody></table></details>}
  </section>;
}
