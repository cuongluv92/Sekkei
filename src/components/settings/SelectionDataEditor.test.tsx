import React from 'react';
import { render,screen,within,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { SelectionDataEditor } from './SelectionDataEditor';
import { catalogue, type Correction, type SelectionKey, type Values } from '@/lib/calc/motorSelection/catalogSelection';
const service=vi.hoisted(()=>({list:vi.fn(),save:vi.fn(),reset:vi.fn()}));
vi.mock('@/lib/services/selectionCorrectionService',()=>({selectionCorrectionService:service,changedFields:()=>['load']}));
beforeEach(()=>{vi.clearAllMocks();service.list.mockResolvedValue([]);});
describe('selection data editor',()=>{
  it('persists a new kW combination, reloads all eight fields, and restores catalogue',async()=>{
    let rows:Correction[]=[];service.list.mockImplementation(async()=>structuredClone(rows));
    service.save.mockImplementation(async(key:SelectionKey,values:Values,before:Values)=>{rows=[{...key,id:'saved',values:structuredClone(values),before,updated_at:'2026-09-04T00:00:00Z'}];return rows[0];});
    service.reset.mockImplementation(async()=>{rows=[];});
    const user=userEvent.setup();const view=render(<SelectionDataEditor/>);
    const open=screen.getByRole('button',{name:'組合せを開く'});await waitFor(()=>expect(open).toBeEnabled());
    const kw=screen.getByRole('spinbutton',{name:'電動機 kW'});await user.clear(kw);await user.type(kw,'0.12');await user.click(open);
    const load=within(screen.getByRole('group',{name:'負荷電流'})).getByRole('spinbutton');await user.type(load,'1.25');
    await user.click(screen.getByRole('button',{name:'ユーザー修正値を保存'}));await screen.findByText('ユーザー修正値を保存しました');
    expect(service.save).toHaveBeenCalledWith(expect.objectContaining({kw:0.12}),expect.objectContaining({load:expect.objectContaining({amps:1.25})}),expect.anything(),undefined);
    expect(Object.keys(rows[0].values)).toHaveLength(8);
    view.unmount();render(<SelectionDataEditor/>);await waitFor(()=>expect(screen.getByRole('button',{name:'組合せを開く'})).toBeEnabled());
    const kwAgain=screen.getByRole('spinbutton',{name:'電動機 kW'});await user.clear(kwAgain);await user.type(kwAgain,'0.12');await user.click(screen.getByRole('button',{name:'組合せを開く'}));
    expect(within(screen.getByRole('group',{name:'負荷電流'})).getByRole('spinbutton')).toHaveValue(1.25);
    await user.click(screen.getByRole('button',{name:'カタログ値に戻す'}));await screen.findByText('カタログ値に戻しました');expect(rows).toEqual([]);
    expect(within(screen.getByRole('group',{name:'負荷電流'})).getByRole('spinbutton')).toHaveValue(null);
  });
  it('blocks negative current before reaching persistence',async()=>{
    const user=userEvent.setup();render(<SelectionDataEditor/>);const save=screen.getByRole('button',{name:'ユーザー修正値を保存'});await waitFor(()=>expect(save).toBeEnabled());
    await user.type(within(screen.getByRole('group',{name:'負荷電流'})).getByRole('spinbutton'),'-2');await user.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('0以上');expect(service.save).not.toHaveBeenCalled();
  });
  it('loads saved edits on initial open instead of displaying original defaults',async()=>{
    const key:SelectionKey={maker:'mitsubishi',voltage:'200V',method:'direct',kw:0.1},values=catalogue(key);values.load.amps=0.8;
    service.list.mockResolvedValue([{...key,id:'saved',values,before:catalogue(key),updated_at:'2026-09-04T00:00:00Z'}]);
    render(<SelectionDataEditor/>);await waitFor(()=>expect(within(screen.getByRole('group',{name:'負荷電流'})).getByRole('spinbutton')).toHaveValue(0.8));
  });
});
