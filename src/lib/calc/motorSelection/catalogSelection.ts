import currentFuji from '@/data/fuji-sc-next.json';
import legacyFuji from '@/data/fuji-msscale.json';

export const FIELD_LABELS = { load: '負荷電流', starting: '始動電流', breaker: '定格電流', ct: 'CT', am: 'AM', mc: 'MC', thermal: 'サーマル リレー', inv: 'INV' } as const;
export type Field = keyof typeof FIELD_LABELS;
export const FIELDS = Object.keys(FIELD_LABELS) as Field[];
export type Maker = 'mitsubishi' | 'fuji';
export type Voltage = '200V' | '400V';
export type Method = 'direct' | 'starDelta' | 'inverter';
export interface SelectionKey { maker: Maker; voltage: Voltage; method: Method; kw: number; }
export interface Cell { amps: number | null; text: string; source: string; note: string; }
export type Values = Record<Field, Cell>;
export interface Correction extends SelectionKey { id: string; values: Values; before: Values; updated_at: string; }
export const SOURCES = {
  wsv: { title: '三菱 WS-V 24B版・表4-11～4-14（印刷p.156–157）', url: 'https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/lvcb/yn-c-0701/y0701y2412.pdf' },
  mst: { title: '三菱 MS-T/N Y-0810 24A版・p.26–27,39,48,52,142–145', url: 'https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/lvsw/l02031/Y-0810_24A.pdf' },
  next: { title: '富士 MSスケール SC-NEXT V20250331・電圧/始動方式別選定表', url: 'https://f-net.fujielectric.co.jp/Catalog/FCS_appli/MSScale_SC-NEXT/MSScale_SC-NEXT.html' },
  nextModels: { title: '富士 SC-NEXT A24001（2024-06-27）添付カタログ・PDF p.15–16,19–20,52–54,75', url: 'https://www.fujielectric.co.jp/fcs/pdf/new/2024/2024_JUN_A24001.pdf' },
  legacy: { title: '富士 MSスケール・電圧/始動方式別選定表（2026-09-04取得）', url: 'https://f-net.fujielectric.co.jp/Catalog/FCS_appli/MSSCALE/MSSCALE.html' },
  e800: { title: '三菱 FREQROL-E800 L(名)06130-J・形名/標準仕様（ND）', url: 'https://www.mitsubishielectric.co.jp/fa/document/catalog/inv/l-06130/l060130j.pdf' },
  a800: { title: '三菱 FREQROL-A800 L(名)06074-B・PDF p.13–14 標準仕様（ND）', url: 'https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/inv/l06074/l06074b.pdf' },
  ace200: { title: '富士 FRENIC-Ace E2・標準形3相200V・HHD（Web仕様、2026-09-04確認）', url: 'https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-ace_specification_01.html' },
  ace400: { title: '富士 FRENIC-Ace E2・標準形3相400V・HHD（Web仕様、2026-09-04確認）', url: 'https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-ace_specification_02.html' },
  mega: { title: '富士 FRENIC-MEGA G2・形式一覧・標準形HHD（Web仕様、2026-09-04確認）', url: 'https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-megag2_specification.html' },
  jeac: { title: '日本電気協会 内線規程 第14版 JEAC8001-2022（2022-12-25）・3705-1/3表の原本未照合', url: 'https://store.denki.or.jp/products/%E5%86%85%E7%B7%9A%E8%A6%8F%E7%A8%8B-%E7%AC%AC14%E7%89%88' },
};
export function cell(amps: number | null = null, text = '要確認', source = '', note = ''): Cell { return { amps, text, source, note }; }
export function emptyValues(): Values { return Object.fromEntries(FIELDS.map(f => [f, cell()])) as Values; }
export function keyOf(k: SelectionKey) { return `${k.maker}:${k.voltage}:${k.method}:${k.kw}`; }
const STANDARD = [0.1,0.15,0.2,0.3,0.4,0.55,0.75,1,1.5,1.9,2.2,2.5,3,3.7,5.5,7.5,9,11,15,18.5,22,30,37,45,50,55,60,75,90,110,132,150,160,185,200,220,250,280,300,315,355,375,400,450,500,560,630];
export const STANDARD_KW = [...STANDARD];
export const METHODS: Record<Method,string> = { direct:'直入れ', starDelta:'スター・デルタ', inverter:'インバータ' };
const kwSmall = [0.1,0.2,0.4,0.75,1.5,2.2,3.7,5.5,7.5,11,15,18.5,22];
const kwWsv = [0.75,1.5,2.2,3.7,5.5,7.5,11,15,18.5,22,30,37,45,55];
const loadWsv = { '200V':[3.6,6.4,9.4,15,22.3,29.1,41.6,57.1,68.2,81.4,110,136,167,202], '400V':[1.8,3.2,4.7,7.5,11.2,14.6,20.8,28.6,34.1,40.7,55,68,83.5,101] };
// Explicitly transcribed MS-T/N p.48 heater selections; this is NOT motor load current.
const heaterKw = [0.1,0.15,0.2,0.3,0.4,0.55,0.75,1,1.5,1.9,2.2,2.5,3,3.7,5.5,7.5,9,11,15,18.5,22,30,37,45,50,55,60,75,90,110,132,150,160,200,300,400];
const heaters = { '200V':[0.7,0.9,1.3,1.7,2.1,2.5,3.6,5,6.6,9,9,11,11,15,22,29,35,42,54,67,82,105,125,150,180,180,180,250,330,330,500,500,500,660,null,null], '400V':[0.35,0.5,0.7,0.9,1.3,1.3,1.7,2.5,3.6,5,5,5,6.6,6.6,11,15,15,22,29,35,42,54,67,82,105,105,105,125,150,180,250,250,250,330,500,660] };
const ranges: Record<number,string> = { 0.35:'0.28～0.42',0.5:'0.4～0.6',0.7:'0.55～0.85',0.9:'0.7～1.1',1.3:'1～1.6',1.7:'1.4～2',2.1:'1.7～2.5',2.5:'2～3',3.6:'2.8～4.4',5:'4～6',6.6:'5.2～8',9:'7～11',11:'9～13',15:'12～18',22:'18～26',29:'24～34',35:'30～40',42:'34～50',54:'43～65',67:'54～80',82:'65～100',105:'85～125',125:'100～150',150:'120～180',180:'140～220',250:'200～300',330:'260～400',500:'400～600',660:'520～800' };
// Concrete AC-operated models checked against p.26–27/39/48. Standard AC-3, no inching.
const directKw = [0.1,0.2,0.4,0.75,1.5,2.2,3.7,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110];
const directModels = {
  '200V': ['S-T10','S-T10','S-T10','S-T10','S-T10','S-T10','S-T20','S-T25','S-T35','S-T50','S-T65','S-T80','S-T100','S-N125','S-N150','S-N180','S-N220','S-N300','S-N400','S-N400'],
  '400V': ['S-T10','S-T10','S-T10','S-T10','S-T10','S-T10','S-T12','S-T20','S-T20','S-T25','S-T35','S-T50','S-T50','S-T65','S-T80','S-T100','S-N125','S-N150','S-N180','S-N220'],
};
const directThermals = {
  '200V':['TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T25','TH-T50','TH-T50','TH-T65','TH-T100','TH-T100','TH-N120TA','TH-N120TA','TH-N220RH','TH-N220RH','TH-N400RH','TH-N400RH','TH-N400RH'],
  '400V':['TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T18','TH-T25','TH-T50','TH-T50','TH-T50','TH-T65','TH-T100','TH-T100','TH-N120TA','TH-N120TA','TH-N220RH','TH-N220RH'],
};
// MS-T/N p.52: line-current sensing, star-short connection, three contactors.
const starKw = [5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,300];
const starMain = { '200V':['S-T20','S-T21','S-T35','S-T50','S-T50','S-T65','S-T80','S-T100','S-N125','S-N150','S-N180','S-N220','S-N300','S-N300','S-N400','S-N600AB'], '400V':['S-T12','S-T20','S-T20','S-T21','S-T25','S-T35','S-T50','S-T50','S-T65','S-T65','S-T100','S-N125','S-N150','S-N180','S-N220','S-N300','S-N300','S-N400'] };
const starStar = { '200V':['S-T10','S-T12','S-T20','S-T25','S-T35','S-T35','S-T50','S-T65','S-T65','S-T80','S-T100','S-N125','S-N150','S-N180','S-N220','S-N300'], '400V':['S-T10','S-T10','S-T12','S-T20','S-T20','S-T20','S-T25','S-T35','S-T35','S-T50','S-T65','S-T65','S-T80','S-T100','S-N125','S-N150','S-N180','S-N220'] };
const starThermal = { '200V':['TH-T25','TH-T65','TH-T65','TH-T65','TH-N120','TH-N120','TH-N120TAHZ','TH-N120TAHZ','TH-N220HZ','TH-N220HZ','TH-N400HZ','TH-N400HZ','TH-N400HZ','TH-N600＋CT','TH-N600＋CT','TH-N600＋CT'], '400V':['TH-T25','TH-T25','TH-T25','TH-T65','TH-T65','TH-T65','TH-T65','TH-N120','TH-N120','TH-N120TAHZ','TH-N120TAHZ','TH-N220HZ','TH-N220HZ','TH-N400HZ','TH-N400HZ','TH-N400HZ','TH-N600＋CT','TH-N600＋CT'] };

interface FujiData {
  電動機: { 出力:string[]; 全負荷電流:string[]; 始動電流:string[]; 形式:string[] };
  配線用遮断器_MCCB: {形式: string[][][]}; 漏電遮断器_ELCB: {形式:string[][][]};
  電磁開閉器_MS?: {形式:string[][]; ヒートエレメント定格:string[]};
  電源用電磁接触器_MCm?: (string|string[])[]; スター用電磁接触器_MCs?: (string|string[])[][];
  デルタ用電磁接触器_MCd?: (string|string[])[];
  サーマルリレー_OLR?: {形式:(string|string[])[][]; ヒートエレメント定格:string[]};
}
const num = (s:string) => { const m=s?.match(/^\s*(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
const options = (v:string|string[]|undefined) => Array.isArray(v) ? v.filter(Boolean).join(' / ') : v || '要確認';
export function catalogue(k: SelectionKey, requiredKa?: number): Values {
  const v = emptyValues();
  if (requiredKa!==undefined&&(!Number.isFinite(requiredKa)||requiredKa<0)) requiredKa=undefined;
  if (!Number.isFinite(k.kw) || k.kw < 0.1) return v;
  v.ct.note = '計測位置・一次/二次電流・負担(VA)・精度・導体寸法が未指定';
  v.am.note = 'CT比・入力(1A/5A/直接)・最大目盛・計器形式が未指定';
  if (k.method === 'inverter') {
    const small = kwSmall.includes(k.kw) && (k.voltage==='200V'||k.kw>=0.4);
    const mitsuLarge = [30,37,45,55,75,90,...(k.voltage==='400V'?[110,132,160,185,220,250,280]:[])];
    const fujiLarge = [30,37,45,55,75,90,...(k.voltage==='400V'?[110,132,160,200,220,280,315,355,400,500,630]:[])];
    if (k.maker==='mitsubishi' && (small||mitsuLarge.includes(k.kw))) v.inv=cell(null, small?`FR-E${k.voltage==='200V'?'820':'840'}-${k.kw}K`:`FR-A${k.voltage==='200V'?'820':'840'}-${k.kw}K`,small?SOURCES.e800.url:SOURCES.a800.url,'ND定格。出力定格電流≧モータ銘板電流、過負荷/キャリア周波数を確認。A800は掲載版の基本形名、現行注文コードは別途照合');
    if (k.maker==='fuji' && (small||fujiLarge.includes(k.kw))) v.inv=cell(null,`FRN${k.kw}${small?'E2':'G2'}S-${k.voltage==='200V'?'2':'4'}J`,small?(k.voltage==='200V'?SOURCES.ace200.url:SOURCES.ace400.url):SOURCES.mega.url,'HHD仕様。出力定格電流≧モータ銘板電流。200V 110kWはHHD標準機種未確認');
    if (k.maker==='mitsubishi') {
      const wi=kwWsv.indexOf(k.kw);
      if(wi>=0) v.load=cell(loadWsv[k.voltage][wi],'',SOURCES.wsv.url,'SF-PR 4極のモータ全負荷電流。インバータ出力電流ではないため、銘板電流とINV定格を確認');
    } else {
      const direct=currentFuji.direct[k.voltage] as unknown as FujiData;
      const legacy=legacyFuji[`DI${k.voltage}` as keyof typeof legacyFuji] as unknown as FujiData;
      const data=direct.電動機.出力.some(s=>num(s)===k.kw)?direct:legacy;
      const i=data.電動機.出力.findIndex(s=>num(s)===k.kw);
      if(i>=0) v.load=cell(num(data.電動機.全負荷電流[i]),'',data===direct?SOURCES.next.url:SOURCES.legacy.url,`${data.電動機.形式[i]}・4極50Hzのモータ全負荷電流。インバータ出力電流ではないため、銘板電流とINV定格を確認`);
    }
    if(v.load.amps===null) v.load.note='インバータ入力/出力の測定位置とモータ銘板電流を確認';
    v.starting.note='加速時間・負荷トルク・電流制限による。直入始動の値を転用しない';
    v.breaker.note='INV入力側周辺機器表・DCR有無・必要遮断容量を確認';
    v.mc=cell(null,'MC1（INV上流）: 要確認\nMC1（INV下流・スター）: 要確認\nMC2（INV下流・スター）: 要確認','', 'スター運転時はINV上流にMC1、INV下流にMC1とMC2を個別指定。運転/停止方式、商用切替、インターロック、メーカー周辺機器表を確認');
    v.thermal.note='電子サーマル設定・外付け保護要否を確認';
    return v;
  }
  v.inv=cell(null,'—（対象外）','','直入れ/スター・デルタ回路');
  if (k.maker==='fuji') {
    const next = currentFuji[k.method][k.voltage] as unknown as FujiData;
    const old = legacyFuji[`${k.method==='direct'?'DI':'SD'}${k.voltage}` as keyof typeof legacyFuji] as unknown as FujiData;
    const data = next.電動機.出力.some(s=>num(s)===k.kw)?next:old;
    const i=data.電動機.出力.findIndex(s=>num(s)===k.kw);
    if(i<0) return v;
    const source=data===next?SOURCES.next.url:SOURCES.legacy.url;
    const note=`${data===next?'SC-NEXT':'MSスケール（従来機種）'}・${data.電動機.形式[i]}・4極50Hz。始動/保護条件は選定表注記参照`;
    v.load=cell(num(data.電動機.全負荷電流[i]),'',source,note);
    v.starting=cell(num(data.電動機.始動電流[i]),'',source,`${note}。メーカー表の「始動電流」を転記（独自倍率計算なし）`);
    const candidates=(groups:string[][][])=>groups.map(g=>g[i]).filter(r=>r?.[0] && num(r[2])!==null).filter((r,i,a)=>a.findIndex(x=>x.join('|')===r.join('|'))===i);
    const mccb=candidates(data.配線用遮断器_MCCB.形式), elcb=candidates(data.漏電遮断器_ELCB.形式);
    const pick=(rows:string[][])=>requiredKa!=null&&requiredKa>=0?rows.find(r=>num(r[2])!>=requiredKa):undefined;
    const m=pick(mccb),e=pick(elcb);
    v.breaker=cell(m?num(m[1]):null,m?`MCCB: ${m[0]} (${m[2]})\nELCB: ${e?`${e[0]} / ${e[1]} (${e[2]})`:'要確認'}`:'要確認',source,requiredKa==null?'必要遮断容量(kA)を指定してください':`必要遮断容量 ${requiredKa} kA。${note}`);
    if (mccb.length) v.breaker.note += '\nカタログ候補: '+mccb.map(r=>`${r[0]} / ${r[1]} / ${r[2]}`).join('、');
    if(k.method==='direct') {
      // The source names a complete MS, not a standalone MC: keep that distinction visible.
      v.mc=cell(null,'要確認',source,'単体MC型式は未照合。公式MS組合せ: '+data.電磁開閉器_MS!.形式.map(g=>g[i]).filter(Boolean).join(' / '));
      v.thermal=cell(null,'要確認',source,'MSヒートエレメント調整範囲: '+data.電磁開閉器_MS!.ヒートエレメント定格[i]+'。単体リレー型式/整定値は未照合');
      const assemblies:Record<string,[string,string]> = {SW09XA:['SC09XA','TR18X2'],SW12XA:['SC12XA','TR18X2'],SW18XA:['SC18XA','TR18X2'],SW20XA:['SC20XA','TR38X2'],SW26XA:['SC26XA','TR38X2'],SW38XA:['SC38XA','TR38X2'],SW40XA:['SC40XA','TR65X2'],SW50XA:['SC50XA','TR65X2'],SW65XA:['SC65XA','TR65X2']};
      const ms=data.電磁開閉器_MS!.形式[0][i],assembly=assemblies[ms?.split('-')[0]];
      if(data===next&&assembly) {
        v.mc=cell(null,assembly[0],SOURCES.nextModels.url,`${note}。PDF p.15–16/52–54のMS/MC対応。コイル電圧・補助接点コード別途指定。MS組合せ: ${ms}。選定元: ${source}`);
        v.thermal=cell(null,`要確認（整定A）\n調整範囲: ${data.電磁開閉器_MS!.ヒートエレメント定格[i].replace('-','～')}\n${assembly[1]}`,SOURCES.nextModels.url,`標準2素子・MS取付形（PDF p.15–16,20,75）。ヒート定格コードはMSスケールの範囲を指定。実整定Aは銘板で確認。選択肢：3素子/欠相検出形、単独設置形は別形式。${source}`);
      }
    } else {
      v.mc=cell(null,`MC-M: ${options(data.電源用電磁接触器_MCm?.[i])}\nMC-S: ${options(data.スター用電磁接触器_MCs?.[0]?.[i])}\nMC-Δ: ${options(data.デルタ用電磁接触器_MCd?.[i])}`,source,note);
      v.thermal=cell(null,options(data.サーマルリレー_OLR?.形式[0][i]),source,'調整範囲: '+data.サーマルリレー_OLR?.ヒートエレメント定格[i]+'。主整定Aは要確認');
    }
    return v;
  }
  const wi=kwWsv.indexOf(k.kw);
  if(wi>=0 && (k.method==='direct'||k.kw>=5.5)) v.load=cell(loadWsv[k.voltage][wi],'',SOURCES.wsv.url,'SF-PR 4極・WS-V 表4-11～4-14（p.156–157）');
  v.starting.note='WS-Vの倍率は遮断器選定条件。実モータの始動電流Aとして換算しない';
  const hi=heaterKw.indexOf(k.kw), heater=hi>=0?heaters[k.voltage][hi]:null;
  const mi=directKw.indexOf(k.kw), si=starKw.indexOf(k.kw);
  if(k.method==='direct'&&mi>=0) {
    v.mc=cell(null,directModels[k.voltage][mi],SOURCES.mst.url,'MS-T/N p.26–27,39,48・AC操作/標準AC-3、インチングなし。コイル電圧別途指定');
    if(heater!=null) v.thermal=cell(heater,`（${ranges[heater]} A）\n${directThermals[k.voltage][mi]}`,SOURCES.mst.url,'MS-T/N p.48,142–145・標準モータのヒータ呼び。銘板電流で整定確認');
  } else if(k.method==='starDelta'&&si>=0&&starMain[k.voltage][si]) {
    v.mc=cell(null,`MC-M: ${starMain[k.voltage][si]}\nMC-S: ${starStar[k.voltage][si]}\nMC-Δ: ${starMain[k.voltage][si]}`,SOURCES.mst.url,'MS-T/N p.52・3接触器式/スター短絡。線電流検出、標準モータ。SF-PR適用時は要照合');
    if(heater!=null) v.thermal=cell(heater,`（${ranges[heater]} A）\n${starThermal[k.voltage][si]}`,SOURCES.mst.url,'MS-T/N p.52・線電流検出。CT組合せを含む場合は専用CT条件を確認');
  } else if(k.method==='direct'&&heater!=null) v.thermal=cell(heater,`（${ranges[heater]} A）\n型式：要確認`,SOURCES.mst.url,'MS-T/N p.48・標準/特殊容量モータ。組合せ型式は未照合');
  // Explicit WS-V candidate selections; Icu differs by voltage. No current-to-frame heuristic.
  const ratings = k.voltage==='200V'?[10,15,20,30,50,60,75,100,100,150,175,225,400,500]:[5,10,10,20,30,30,50,60,60,75,100,100,125,175];
  if(k.voltage==='400V'&&k.method==='starDelta') {ratings[5]=40;ratings[12]=150;}
  if(wi>=0&&(k.method==='direct'||k.kw>=5.5)) {
    const nf200=['NF32-SV','NF32-SV','NF32-SV','NF32-SV','NF63-CV','NF63-CV','NF125-CV','NF125-CV','NF125-CV','NF250-CV','NF250-CV','NF250-CV','NF400-CW','NF630-CW'];
    const nv200=['NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV125-CV','NV125-CV','NV125-CV','NV250-CV','NV250-CV','NV250-CV','NV400-CW','NV630-CW'];
    const nf400=['NF32-SV','NF32-SV','NF32-SV','NF32-SV','NF32-SV','NF32-SV','NF63-CV','NF63-CV','NF125-CV','NF125-CV','NF125-CV','NF125-CV','NF250-CV','NF250-CV'];
    const nv400=['NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV63-CV','NV125-CV','NV125-CV','NV125-CV','NV125-CV','NV250-CV','NV250-CV'];
    const icu200=[7.5,7.5,7.5,7.5,7.5,7.5,30,30,30,36,36,36,50,50];
    const icu400=[2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,10,10,10,10,25,25];
    const icu=(k.voltage==='200V'?icu200:icu400)[wi];
    const nf=k.voltage==='400V'&&k.method==='starDelta'&&(wi===4||wi===5)?'NF63-CV':(k.voltage==='200V'?nf200:nf400)[wi],nv=(k.voltage==='200V'?nv200:nv400)[wi];
    const nvA=k.voltage==='400V'&&wi===0?10:ratings[wi];
    const candidate=`MCCB: ${nf} / ${ratings[wi]} A\nELCB: ${nv} / ${nvA} A\nIcu: ${icu} kA`;
    v.breaker=cell(requiredKa!=null&&requiredKa<=icu?ratings[wi]:null,requiredKa!=null&&requiredKa<=icu?candidate:'要確認',SOURCES.wsv.url,`WS-V p.156–157・SF-PR/4極・40℃コールドスタート。必要遮断容量を確認。\n照合済み候補: ${candidate}`);
  }
  return v;
}
export function effectiveValues(k:SelectionKey, corrections:Correction[], requiredKa?:number) { return corrections.find(c=>keyOf(c)===keyOf(k))?.values ?? catalogue(k,requiredKa); }
export function validateValues(k:SelectionKey, values:Values): void {
  if(!['mitsubishi','fuji'].includes(k.maker)||!['200V','400V'].includes(k.voltage)||!Object.keys(METHODS).includes(k.method)||!Number.isFinite(k.kw)||k.kw<0.1) throw new Error('メーカー・電圧・始動方式を確認し、kWは0.1以上を入力してください');
  for(const f of FIELDS) {
    const c=values[f];
    if(!c || (c.amps!==null&&(typeof c.amps!=='number'||!Number.isFinite(c.amps)||c.amps<0))) throw new Error(`${FIELD_LABELS[f]}: 電流は0以上の有限数を入力してください`);
    if(['text','source','note'].some(p=>typeof c[p as 'text'|'source'|'note']!=='string')) throw new Error(`${FIELD_LABELS[f]}: データ形式が不正です`);
    if(c.text.length>4000||c.note.length>12000||c.source.length>2000) throw new Error('入力が長すぎます');
    if(c.source) { let u:URL; try {u=new URL(c.source);}catch{throw new Error('出典URLの形式を確認してください');} if(!['https:','http:'].includes(u.protocol)) throw new Error('出典はhttp/https URLで指定してください'); }
    if(/(?:^|[\s（(])[-−]\s*\d+(?:\.\d+)?\s*(?:A|～|~)/i.test(c.text)) throw new Error('負の電流値は入力できません');
    for(const m of c.text.matchAll(/(\d+(?:\.\d+)?)\s*[～~]\s*(\d+(?:\.\d+)?)\s*A/g)) if(Number(m[1])>Number(m[2]) || (f==='thermal'&&c.amps!==null&&(c.amps<Number(m[1])||c.amps>Number(m[2])))) throw new Error('調整範囲と整定電流を確認してください');
  }
}
