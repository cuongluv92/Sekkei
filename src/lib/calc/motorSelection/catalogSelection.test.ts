import { describe,it,expect } from 'vitest';
import { catalogue, FIELDS, FIELD_LABELS, STANDARD_KW, emptyValues, effectiveValues, validateValues, type Correction, type SelectionKey } from './catalogSelection';
import fuji from '@/data/fuji-msscale.json';
const base:SelectionKey={maker:'mitsubishi',voltage:'200V',method:'direct',kw:5.5};
describe('catalogue selection across all powers',()=>{
  it('keeps the exact eight rows in order',()=>expect(Object.values(FIELD_LABELS)).toEqual(['負荷電流','始動電流','定格電流','CT','AM','MC','サーマル リレー','INV']));
  for(const maker of ['mitsubishi','fuji'] as const)for(const voltage of ['200V','400V'] as const)for(const method of ['direct','starDelta','inverter'] as const){
    it(`${maker}/${voltage}/${method}: every registered power has valid cells and sources`,()=>{
      for(const kw of STANDARD_KW){const key={maker,voltage,method,kw},v=catalogue(key,2.5);expect(Object.keys(v)).toEqual(FIELDS);validateValues(key,v);for(const f of FIELDS){if(v[f].amps!==null)expect(v[f].source,`${kw}/${f}`).toMatch(/^https:\/\//);expect(v[f].text).not.toContain('undefined');expect(v[f].text).not.toContain('適用フレーム');}expect(v.ct.amps).toBeNull();expect(v.ct.text).toBe('要確認');expect(v.am.text).toBe('要確認');if(maker==='mitsubishi')expect(v.starting.amps).toBeNull();}
    });
  }
  const representative=[0.1,0.4,0.75,5.5,18.5,30,55,110];
  const fuji200=[0.68,2.3,3.5,21,68,116,200,380],start200=[5.4,18.4,23,203,548,921,1900,3800];
  it('matches independently transcribed representative Fuji 200V rows, without copying 5.5kW',()=>representative.forEach((kw,i)=>{const v=catalogue({...base,maker:'fuji',kw});expect(v.load.amps).toBe(fuji200[i]);expect(v.starting.amps).toBe(start200[i]);}));
  it('covers every official Fuji index including the top of each voltage/method table',()=>{
    for(const [key,data] of Object.entries(fuji))for(let i=0;i<data.電動機.出力.length;i++){
      const kw=parseFloat(data.電動機.出力[i]);const v=catalogue({maker:'fuji',voltage:key.endsWith('200V')?'200V':'400V',method:key.startsWith('DI')?'direct':'starDelta',kw},5);
      expect(v.load.amps).toBe(parseFloat(data.電動機.全負荷電流[i]));expect(v.starting.amps).toBe(parseFloat(data.電動機.始動電流[i]));
    }
  });
  it('separates 400V start methods in WS-V and retains voltage-specific Icu',()=>{
    const direct=catalogue({...base,voltage:'400V',kw:7.5},2.5),star=catalogue({...base,voltage:'400V',kw:7.5,method:'starDelta'},2.5);
    expect(direct.breaker.amps).toBe(30);expect(star.breaker.amps).toBe(40);expect(direct.mc.text).not.toBe(star.mc.text);
    expect(catalogue({...base,voltage:'400V'},30).breaker.amps).toBeNull();
    expect(catalogue(base).breaker.amps).toBeNull();expect(catalogue(base,5).breaker.text).toContain('NF63-CV');
  });
  it.each(['mitsubishi','fuji'] as const)('shows main, star and delta contactors separately for %s star-delta',maker=>{
    for(const voltage of ['200V','400V'] as const){const mc=catalogue({...base,maker,voltage,method:'starDelta'}).mc.text;expect(mc).toMatch(/^MC-M:/m);expect(mc).toMatch(/^MC-S:/m);expect(mc).toMatch(/^MC-Δ:/m);}
  });
  it.each(['mitsubishi','fuji'] as const)('shows one MC above and two MCs below INV for star operation with %s',maker=>{const mc=catalogue({...base,maker,method:'inverter'}).mc;expect(mc.text.split('\n')).toEqual(['MC1（INV上流）: 要確認','MC1（INV下流・スター）: 要確認','MC2（INV下流・スター）: 要確認']);});
  it('uses exact relay call/range and does not relabel load current as a heater',()=>{
    const v=catalogue(base);expect(v.load.amps).toBe(22.3);expect(v.thermal).toMatchObject({amps:22,text:'（18～26 A）\nTH-T25'});
    expect(catalogue({...base,maker:'fuji'}).thermal.amps).toBeNull();
  });
  it('resolves only supported inverter models and never transfers DOL current to INV',()=>{
    expect(catalogue({...base,kw:0.1,method:'inverter'}).inv.text).toBe('FR-E820-0.1K');
    expect(catalogue({...base,voltage:'400V',kw:0.1,method:'inverter'}).inv.text).toBe('要確認');
    expect(catalogue({...base,maker:'fuji',kw:30,method:'inverter'}).inv.text).toBe('FRN30G2S-2J');
    expect(catalogue({...base,maker:'fuji',kw:110,method:'inverter'}).inv.text).toBe('要確認');
    expect(catalogue({...base,maker:'fuji',voltage:'400V',kw:110,method:'inverter'}).inv.text).toBe('FRN110G2S-4J');
    for(const voltage of ['200V','400V'] as const) {
      const mitsubishi=catalogue({...base,voltage,method:'inverter'});
      const fujiValue=catalogue({...base,maker:'fuji',voltage,method:'inverter'});
      expect(mitsubishi.load.amps).toBeGreaterThan(0);
      expect(fujiValue.load.amps).toBeGreaterThan(0);
      expect(mitsubishi.starting.amps).toBeNull();
      expect(fujiValue.starting.amps).toBeNull();
    }
  });
  it('does not interpolate unknown or invalid powers',()=>{for(const kw of [-1,0,0.09,NaN,Infinity,5.6])expect(catalogue({...base,kw}).load.amps).toBeNull();});
});
describe('user corrections',()=>{
  it('takes precedence for only the exact combination, without mutating catalogue',()=>{
    const values=catalogue(base);values.load.amps=23;values.starting.amps=140;values.inv.text='要確認';
    const c:Correction={...base,id:'test',updated_at:'2026-09-04T00:00:00Z',values,before:catalogue(base)};
    expect(effectiveValues(base,[c]).load.amps).toBe(23);expect(catalogue(base).load.amps).toBe(22.3);
    for(const key of [{...base,voltage:'400V' as const},{...base,maker:'fuji' as const},{...base,kw:18.5},{...base,method:'starDelta' as const}])expect(effectiveValues(key,[c]).load.amps).not.toBe(23);
    expect(effectiveValues(base,[])).toEqual(catalogue(base));
  });
  it('accepts new powers from 0.1 and empty values as 要確認',()=>{expect(()=>validateValues({...base,kw:0.12},emptyValues())).not.toThrow();});
  it('rejects invalid amps, malformed sources and reversed/outside relay ranges',()=>{
    for(const amps of [-1,Infinity,NaN]){const v=emptyValues();v.load.amps=amps;expect(()=>validateValues(base,v)).toThrow();}
    const v=emptyValues();v.thermal={amps:22,text:'（26～18 A）',source:'',note:''};expect(()=>validateValues(base,v)).toThrow();
    v.thermal.text='（18～20 A）';expect(()=>validateValues(base,v)).toThrow();
    v.thermal.text='（18～26 A）';v.load.source='javascript:alert(1)';expect(()=>validateValues(base,v)).toThrow();
    expect(()=>validateValues({...base,kw:0.01},emptyValues())).toThrow();
  });
});
