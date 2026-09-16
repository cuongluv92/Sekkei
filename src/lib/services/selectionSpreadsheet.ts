import ExcelJS from 'exceljs';
import { catalogue, FIELDS, FIELD_LABELS, METHODS, STANDARD_KW, validateValues, type Correction, type Field, type Maker, type Method, type SelectionKey, type Values, type Voltage } from '@/lib/calc/motorSelection/catalogSelection';

const BASE=['メーカー','電圧','kW','始動方式'] as const;
const PARTS=['主電流A','表示値・型式','出典URL','資料名・版・頁・条件・備考'] as const;
const HEADERS=[...BASE,...FIELDS.flatMap(f=>PARTS.map(p=>`${FIELD_LABELS[f]}_${p}`))];
const makerLabel:Record<Maker,string>={mitsubishi:'三菱電機',fuji:'富士電機'};
const makerValue:Record<string,Maker>={mitsubishi:'mitsubishi',fuji:'fuji','三菱電機':'mitsubishi','富士電機':'fuji'};
const methodValue:Record<string,Method>={direct:'direct',starDelta:'starDelta',inverter:'inverter','直入れ':'direct','スター・デルタ':'starDelta','インバータ':'inverter'};
const text=(v:ExcelJS.CellValue)=>v==null?'':typeof v==='object'&&'text' in v?String(v.text):String(v);
const same=(a:Values,b:Values)=>JSON.stringify(a)===JSON.stringify(b);

export interface SpreadsheetRow { row:number; key:SelectionKey; values:Values; before:Values; existing?:Correction; }
export interface SpreadsheetPreview { rows:SpreadsheetRow[]; errors:string[]; skipped:number; }

export async function createSelectionWorkbook(corrections:Correction[]) {
  const workbook=new ExcelJS.Workbook();workbook.creator='OKU-pro';
  const ws=workbook.addWorksheet('選定データ');ws.views=[{state:'frozen',ySplit:1}];
  ws.addRow(HEADERS);ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1F4E78'}};ws.autoFilter={from:'A1',to:`AJ1`};
  for(const maker of ['mitsubishi','fuji'] as const)for(const voltage of ['200V','400V'] as const)for(const method of ['direct','starDelta','inverter'] as const)for(const kw of STANDARD_KW){
    const key={maker,voltage,method,kw};const correction=corrections.find(c=>c.maker===maker&&c.voltage===voltage&&c.method===method&&c.kw===kw);const values=correction?.values??catalogue(key);
    ws.addRow([makerLabel[maker],voltage,kw,METHODS[method],...FIELDS.flatMap(f=>[values[f].amps,values[f].text,values[f].source,values[f].note])]);
  }
  ws.columns=HEADERS.map((h,i)=>({header:h,key:String(i),width:i<4?16:i%4===0?14:i%4===1?24:i%4===2?38:50}));
  ws.getColumn(3).numFmt='0.###';ws.eachRow((row,n)=>{if(n>1){row.alignment={vertical:'top',wrapText:true};if(n%2===0)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F6F9'}};}});
  const guide=workbook.addWorksheet('使い方');guide.addRows([['選定データ一括編集'],['1','選定データシートの値を編集します。'],['2','0.1kW以上の新しい組合せは末尾に行を追加します。'],['3','列名は変更しないでください。空欄の主電流Aは要確認として扱います。'],['4','スター・デルタのMCは、MC-M（主回路）、MC-S（スター）、MC-Δ（デルタ）を改行して記入します。'],['5','インバータでスター運転する場合、INV上流のMC1、INV下流のMC1とMC2を別行で記入します。'],['6','アップロード時はカタログ値または保存済み値から変更された行だけを確認・保存します。'],['7','カタログ原本は上書きされず、ユーザー修正値として保存されます。']]);guide.getColumn(1).width=8;guide.getColumn(2).width=100;guide.getRow(1).font={bold:true,size:16};
  return workbook;
}

export async function downloadSelectionWorkbook(corrections:Correction[]) {const wb=await createSelectionWorkbook(corrections);const data=await wb.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`選定データ_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(url);}

export async function parseSelectionWorkbook(file:File,corrections:Correction[]):Promise<SpreadsheetPreview>{
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());const ws=wb.getWorksheet('選定データ')??wb.worksheets[0];if(!ws)throw new Error('選定データシートがありません');
  const actual=(ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(text);if(HEADERS.some((h,i)=>actual[i]!==h))throw new Error('列名または列順がテンプレートと異なります');
  const rows:SpreadsheetRow[]=[],errors:string[]=[];let skipped=0;
  for(let r=2;r<=ws.rowCount;r++){const cells=(ws.getRow(r).values as ExcelJS.CellValue[]).slice(1);if(cells.every(v=>text(v)===''))continue;
    try{const maker=makerValue[text(cells[0]).trim()],voltage=text(cells[1]).trim() as Voltage,kw=Number(cells[2]),method=methodValue[text(cells[3]).trim()];if(!maker||!['200V','400V'].includes(voltage)||!method||!Number.isFinite(kw)||kw<0.1)throw new Error('メーカー・電圧・kW・始動方式を確認してください');const key={maker,voltage,kw,method};const existing=corrections.find(c=>c.maker===maker&&c.voltage===voltage&&c.method===method&&c.kw===kw);const before=existing?.values??catalogue(key);const values=structuredClone(before);let col=4;for(const f of FIELDS){const amp=text(cells[col++]).trim();values[f]={amps:amp===''?null:Number(amp),text:text(cells[col++]),source:text(cells[col++]).trim(),note:text(cells[col++])};}validateValues(key,values);if(same(values,before)){skipped++;continue;}rows.push({row:r,key,values,before:structuredClone(before),existing});}catch(e){errors.push(`行 ${r}: ${e instanceof Error?e.message:String(e)}`);}
  }
  return {rows,errors,skipped};
}
