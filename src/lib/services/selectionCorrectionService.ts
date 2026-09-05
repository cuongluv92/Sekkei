import { requireSupabase } from '@/lib/supabase/client';
import { FIELDS, keyOf, validateValues, type Correction, type SelectionKey, type Values } from '@/lib/calc/motorSelection/catalogSelection';

// Dedicated, versioned user records in the existing editable company partition.
// Manufacturer catalogue rows are never updated or deleted by this service.
export const CORRECTION_PREFIX = 'SEKKEI_USER_CORRECTION_V1:';
interface Stored { key:SelectionKey; values:Values; before:Values; }
function decode(row:{id:string;remarks:string;updated_at:string}):Correction {
  const saved=JSON.parse(row.remarks.slice(CORRECTION_PREFIX.length)) as Stored;
  validateValues(saved.key,saved.values);
  return {...saved.key,id:row.id,values:saved.values,before:saved.before,updated_at:row.updated_at};
}
export const selectionCorrectionService = {
  async list():Promise<Correction[]> {
    const {data,error}=await requireSupabase().from('motor_kw_selection_rows').select('id,remarks,updated_at').eq('basis_kind','company').like('remarks',CORRECTION_PREFIX+'%').order('updated_at',{ascending:false});
    if(error) throw error;
    const result:Correction[]=[];
    for(const row of data??[]) result.push(decode(row));
    return result;
  },
  async save(key:SelectionKey, values:Values, before:Values, existing?:Correction):Promise<Correction> {
    validateValues(key,values);
    if(existing&&keyOf(existing)!==keyOf(key))throw new Error('編集対象が変更されました。再読込してください');
    const client=requireSupabase();
    const {data:maker,error:makerError}=await client.from('manufacturers').select('id').eq('name',key.maker==='mitsubishi'?'三菱電機':'富士電機').single();
    if(makerError)throw makerError;
    const payload={ basis_kind:'company', manufacturer_id:maker.id, phase:'three', voltage_class:key.voltage, start_method:key.method, motor_kw:key.kw,
      rated_current_a:values.load.amps, starting_current_a:values.starting.amps, breaker_rated_a:values.breaker.amps,
      breaker_model:values.breaker.text, contactor_model:values.mc.text, thermal_model:values.thermal.text, thermal_setting_a:values.thermal.amps,
      ct_model:values.ct.text, am_range:values.am.text, inverter_model:values.inv.text,
      remarks:CORRECTION_PREFIX+JSON.stringify({key,values,before} satisfies Stored),updated_at:new Date().toISOString(),sort_order:20000 };
    const query=existing?client.from('motor_kw_selection_rows').update(payload).eq('id',existing.id).eq('basis_kind','company').eq('updated_at',existing.updated_at).like('remarks',CORRECTION_PREFIX+'%'):client.from('motor_kw_selection_rows').insert(payload);
    const {data,error}=await query.select('id,remarks,updated_at').single();
    if(error)throw new Error('保存できませんでした。別画面で更新された可能性があります。再読込してください。 '+error.message);
    const saved=decode(data); window.dispatchEvent(new Event('selection-corrections-updated')); return saved;
  },
  async reset(key:SelectionKey):Promise<void> {
    const all=await this.list(); const matching=all.filter(c=>keyOf(c)===keyOf(key));
    for(const c of matching) {
      const {error}=await requireSupabase().from('motor_kw_selection_rows').delete().eq('id',c.id).eq('basis_kind','company').like('remarks',CORRECTION_PREFIX+'%');
      if(error)throw error;
    }
    window.dispatchEvent(new Event('selection-corrections-updated'));
  },
};
export function changedFields(c:Correction) { return FIELDS.filter(f=>JSON.stringify(c.before[f])!==JSON.stringify(c.values[f])); }
