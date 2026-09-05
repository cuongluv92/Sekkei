'use client';
import { useEffect, useState } from 'react';
import { catalogue, FIELD_LABELS, FIELDS, keyOf, METHODS, STANDARD_KW, validateValues, type Correction, type Field, type SelectionKey, type Values } from '@/lib/calc/motorSelection/catalogSelection';
import { selectionCorrectionService, changedFields } from '@/lib/services/selectionCorrectionService';
import { SelectionCell } from '@/components/selection/SelectionCell';
import { downloadSelectionWorkbook, parseSelectionWorkbook, type SpreadsheetPreview } from '@/lib/services/selectionSpreadsheet';
import { catalogService } from '@/lib/services/catalogService';
import { uploadPartFile } from '@/lib/services/fileUploadService';

export function SelectionDataEditor() {
  const [key,setKey]=useState<SelectionKey>({maker:'mitsubishi',voltage:'200V',method:'direct',kw:0.1});
  const [kw,setKw]=useState('0.1');
  const [corrections,setCorrections]=useState<Correction[]>([]);
  const [values,setValues]=useState<Values>(()=>catalogue(key));
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const [preview,setPreview]=useState<SpreadsheetPreview|null>(null);
  const [sourceTitle,setSourceTitle]=useState(''),[sourceVersion,setSourceVersion]=useState(''),[sourcePage,setSourcePage]=useState(''),[sourceFile,setSourceFile]=useState<File|null>(null),[uploadedSource,setUploadedSource]=useState<{url:string;note:string}|null>(null);
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
  async function importFile(file:File) {setBusy(true);setError('');setStatus('');try{setPreview(await parseSelectionWorkbook(file,corrections));}catch(e){setPreview(null);setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function saveImport() {if(!preview||preview.errors.length)return;setBusy(true);setError('');try{for(const row of preview.rows)await selectionCorrectionService.save(row.key,row.values,row.before,row.existing);await reload();setStatus(`${preview.rows.length}件のユーザー修正値を保存しました`);setPreview(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function uploadSource() {if(!sourceFile||!sourceTitle.trim()){setError('資料名とPDFファイルを指定してください');return;}setBusy(true);setError('');try{const note=[sourceTitle.trim(),sourceVersion.trim(),sourcePage.trim()].filter(Boolean).join(' / ');const catalog=await catalogService.create({manufacturerId:'',category:'選定データ資料',model:note,fileName:sourceFile.name,files:[]});const asset=await uploadPartFile('catalog',catalog.id,sourceFile);if(!asset.url)throw new Error('アップロード先URLを取得できませんでした');setUploadedSource({url:asset.url,note});setStatus('カタログPDFを保存しました。必要な項目へ出典を適用できます');setSourceFile(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  function applySourceToCurrent(){if(!uploadedSource)return;setValues(prev=>Object.fromEntries(FIELDS.map(f=>[f,{...prev[f],source:uploadedSource.url,note:[prev[f].note,uploadedSource.note].filter(Boolean).join(' / ')}])) as Values);setStatus('編集中の8項目へ出典を設定しました。内容確認後にユーザー修正値を保存してください');}
  return <section className="space-y-4" aria-label="選定データ編集">
    <h2 className="panel-title">選定データ編集</h2>
    <p className="text-xs text-muted">ユーザー修正値はメーカー・電圧・kW・始動方式ごとにデータベースへ保存し、選定・分岐計算で優先します。原本カタログは変更しません。三相用。</p>
    <div className="rounded border border-border p-3 space-y-2"><h3 className="font-semibold">Excel一括編集</h3><p className="text-xs text-muted">全メーカー・電圧・kW・始動方式と8項目をExcelで編集できます。アップロード後に変更行とエラーを確認してから保存します。</p><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={busy||!loaded} onClick={()=>void downloadSelectionWorkbook(corrections)}>Excelテンプレートをダウンロード</button><label className="btn-secondary cursor-pointer">編集済みExcelを読み込む<input className="sr-only" type="file" accept=".xlsx" disabled={busy||!loaded} onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value='';}}/></label></div>
    {preview&&<div className="space-y-2 text-sm"><p>変更 {preview.rows.length}件・変更なし {preview.skipped}件・エラー {preview.errors.length}件</p>{preview.rows.length>0&&<div className="max-h-48 overflow-auto"><table className="data-table"><thead><tr><th>行</th><th>メーカー</th><th>電圧</th><th>kW</th><th>始動方式</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.row}><td>{r.row}</td><td>{makerLabel(r.key.maker)}</td><td>{r.key.voltage}</td><td>{r.key.kw}</td><td>{METHODS[r.key.method]}</td></tr>)}</tbody></table></div>}{preview.errors.length>0&&<ul role="alert" className="text-danger max-h-40 overflow-auto">{preview.errors.map(e=><li key={e}>{e}</li>)}</ul>}<div className="flex gap-2"><button type="button" className="btn-primary" disabled={busy||preview.rows.length===0||preview.errors.length>0} onClick={()=>void saveImport()}>変更を一括保存</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>setPreview(null)}>取消</button></div></div>}
    </div>
    <div className="rounded border border-border p-3 space-y-2"><h3 className="font-semibold">カタログ資料を登録</h3><p className="text-xs text-muted">PDFをカタログ保管庫へ保存し、編集中データの出典URL・資料情報として使用できます。数値は確認後に手入力またはExcelで登録します。</p><div className="grid gap-2 md:grid-cols-4"><label className="text-xs">資料名<input className="field-input" value={sourceTitle} onChange={e=>setSourceTitle(e.target.value)} placeholder="例：MS-T/N総合カタログ"/></label><label className="text-xs">版・発行日<input className="field-input" value={sourceVersion} onChange={e=>setSourceVersion(e.target.value)} placeholder="例：24A版"/></label><label className="text-xs">ページ・表<input className="field-input" value={sourcePage} onChange={e=>setSourcePage(e.target.value)} placeholder="例：p.52 表4-3"/></label><label className="text-xs">PDF<input className="field-input" type="file" accept="application/pdf,.pdf" onChange={e=>setSourceFile(e.target.files?.[0]??null)}/></label></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={busy||!sourceFile||!sourceTitle.trim()} onClick={()=>void uploadSource()}>PDFを保存</button>{uploadedSource&&<button type="button" className="btn-secondary" disabled={busy} onClick={applySourceToCurrent}>現在の8項目へ出典を適用</button>}</div>{uploadedSource&&<a className="text-xs text-accent underline" href={uploadedSource.url} target="_blank" rel="noreferrer">登録済み資料を開く：{uploadedSource.note}</a>}</div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <label>メーカー<select className="field-input" value={key.maker} disabled={busy} onChange={e=>select({...key,maker:e.target.value as SelectionKey['maker']})}><option value="mitsubishi">三菱電機</option><option value="fuji">富士電機</option></select></label>
      <label>電圧<select className="field-input" value={key.voltage} disabled={busy} onChange={e=>select({...key,voltage:e.target.value as SelectionKey['voltage']})}><option>200V</option><option>400V</option></select></label>
      <label>電動機 kW<input className="field-input" type="number" min="0.1" step="any" list="editor-kw" value={kw} onChange={e=>setKw(e.target.value)}/><datalist id="editor-kw">{[...new Set([...STANDARD_KW,...corrections.map(c=>c.kw)])].sort((a,b)=>a-b).map(n=><option key={n} value={n}/>)}</datalist></label>
      <button type="button" className="btn-secondary" disabled={busy||!loaded} onClick={()=>{const n=Number(kw);if(!Number.isFinite(n)||n<0.1){setError('kWは0.1以上を入力してください');return;}select({...key,kw:n});}}>組合せを開く</button>
    </div>
    <div role="tablist" aria-label="運転方式" className="flex flex-wrap gap-2 border-b border-border pb-2">{Object.entries(METHODS).map(([method,label])=><button key={method} type="button" role="tab" aria-selected={key.method===method} className={key.method===method?'btn-primary':'btn-secondary'} disabled={busy} onClick={()=>select({...key,method:method as SelectionKey['method']})}>{label}</button>)}</div>
    <p className="text-xs">編集中: {key.maker} / {key.voltage} / {key.kw} kW / {METHODS[key.method]} {existing&&`・修正済み ${new Date(existing.updated_at).toLocaleString('ja-JP')}`}</p>
    <div className="space-y-3">{FIELDS.map((f,index)=><fieldset className="rounded border border-border p-3" key={f}><legend className="px-1 font-semibold">{index+1}. {FIELD_LABELS[f]}</legend><div className="grid gap-3 md:grid-cols-4">
      {(['load','starting','breaker','thermal'] as Field[]).includes(f)&&<label className="block text-xs">主電流 A（空欄＝要確認）<input className="field-input" type="number" min="0" step="any" value={values[f].amps??''} onChange={e=>edit(f,'amps',e.target.value)}/></label>}
      <label className="block text-xs">型式・表示補足{f==='thermal'?'（例： （18～26 A）改行 TH-T25）':f==='mc'&&key.method==='starDelta'?'（MC-M・MC-S・MC-Δ）':f==='mc'&&key.method==='inverter'?'（INV上流MC1、下流MC1・MC2）':''}<textarea className="field-input" rows={f==='mc'&&key.method!=='direct'?3:2} value={values[f].text} onChange={e=>edit(f,'text',e.target.value)}/></label>
      <label className="block text-xs">出典URL<input className="field-input" type="url" value={values[f].source} onChange={e=>edit(f,'source',e.target.value)}/></label>
      <label className="block text-xs">資料名・版・頁/表・条件/備考<textarea className="field-input" rows={2} value={values[f].note} onChange={e=>edit(f,'note',e.target.value)}/></label>
      </div>
    </fieldset>)}</div>
    {error&&<p role="alert" className="text-danger text-sm">{error}</p>}{status&&<p role="status" className="text-accent text-sm">{status}</p>}
    <div className="flex gap-2"><button type="button" className="btn-primary" onClick={()=>void save()} disabled={busy||!loaded}>ユーザー修正値を保存</button><button type="button" className="btn-secondary" onClick={()=>void reset()} disabled={busy||!loaded||!existing}>カタログ値に戻す</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void reload().then(data=>{if(data)setValues(structuredClone(data.find(c=>keyOf(c)===keyOf(key))?.values??catalogue(key)));})}>再読込</button></div>
    {existing&&<details><summary>修正済み・変更前／変更後（{new Date(existing.updated_at).toLocaleString('ja-JP')}）</summary><table className="data-table"><thead><tr><th>項目</th><th>変更前</th><th>変更後</th></tr></thead><tbody>{changedFields(existing).map(f=><tr key={f}><th>{FIELD_LABELS[f]}</th><td><SelectionCell value={existing.before[f]}/></td><td><SelectionCell value={existing.values[f]}/></td></tr>)}</tbody></table></details>}
  </section>;
}

function makerLabel(maker:SelectionKey['maker']) {return maker==='mitsubishi'?'三菱電機':'富士電機';}
