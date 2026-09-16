import React from 'react';
import { render,screen,within,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { CatalogComparison } from './CatalogComparison';
import { SelectionCell } from './SelectionCell';
import { catalogue } from '@/lib/calc/motorSelection/catalogSelection';
const list=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/services/selectionCorrectionService',()=>({selectionCorrectionService:{list},changedFields:()=>['load']}));
beforeEach(()=>{list.mockResolvedValue([]);});
const props={kw:5.5,voltage:'200V',method:'direct' as const,phase:'three',company:null,makerId:()=> 'maker-id',onAdopt:vi.fn()};
describe('comparison rendering and adoption',()=>{
  it('has exactly eight data rows and only primary amperes are bold',async()=>{
    render(<CatalogComparison {...props}/>);await waitFor(()=>expect(screen.queryByText(/修正値未確認/)).not.toBeInTheDocument());
    const table=screen.getByRole('table',{name:'kW選定 比較結果'});expect(within(table).getAllByRole('row')).toHaveLength(9);
    const thermal=within(table).getByRole('rowheader',{name:'サーマル リレー'}).closest('tr')!;expect(thermal.querySelector('strong')?.textContent).toBe('22 A');
    for(const strong of table.querySelectorAll('strong'))expect(strong.textContent).toMatch(/^\d+(\.\d+)? A$/);
  });
  it('adopts corrected values into branch calculation and responds to voltage changes',async()=>{
    const key={maker:'mitsubishi' as const,voltage:'200V' as const,method:'direct' as const,kw:5.5},values=catalogue(key);values.load.amps=24;
    list.mockResolvedValue([{...key,id:'override',updated_at:'2026-09-04T00:00:00Z',values,before:catalogue(key)}]);
    const adopt=vi.fn();const {rerender}=render(<CatalogComparison {...props} onAdopt={adopt}/>);
    await waitFor(()=>expect(screen.getAllByRole('button',{name:'＋ 分岐回路を追加'})[0]).toBeEnabled());
    await userEvent.click(screen.getAllByRole('button',{name:'＋ 分岐回路を追加'})[0]);expect(adopt).toHaveBeenCalledWith(expect.objectContaining({ratedCurrentA:24,voltageClass:'200V'}));
    rerender(<CatalogComparison {...props} voltage="400V" onAdopt={adopt}/>);await userEvent.click(screen.getAllByRole('button',{name:'＋ 分岐回路を追加'})[0]);expect(adopt).toHaveBeenLastCalledWith(expect.objectContaining({ratedCurrentA:11.2,voltageClass:'400V'}));
  });
  it('fails closed for adoption when correction retrieval fails',async()=>{list.mockRejectedValue(new Error('network'));render(<CatalogComparison {...props}/>);await screen.findByRole('alert');for(const b of screen.getAllByRole('button',{name:'＋ 分岐回路を追加'}))expect(b).toBeDisabled();});
  it('formats adjustment range and model without bold',()=>{const {container}=render(<SelectionCell value={{amps:22,text:'（18～26 A）\nTH-T25 / 7.5 kA',source:'',note:''}}/>);expect(container.querySelector('strong')?.textContent).toBe('22 A');expect(container.textContent).toBe('22 A（18～26 A）\nTH-T25 / 7.5 kA');});
});
