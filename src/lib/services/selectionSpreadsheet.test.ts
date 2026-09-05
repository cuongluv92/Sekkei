import { describe,expect,it } from 'vitest';
import { createSelectionWorkbook,parseSelectionWorkbook } from './selectionSpreadsheet';
import type ExcelJS from 'exceljs';

async function fileOf(edit?:(ws:ExcelJS.Worksheet)=>void){
  const wb=await createSelectionWorkbook([]);const ws=wb.getWorksheet('選定データ')!;edit?.(ws);const data=await wb.xlsx.writeBuffer();return new File([data],'selection.xlsx');
}

describe('selection spreadsheet',()=>{
  it('exports every maker, voltage, method and standard power with 36 fixed columns',async()=>{const wb=await createSelectionWorkbook([]);const ws=wb.getWorksheet('選定データ')!;expect(ws.columnCount).toBe(36);expect(ws.rowCount).toBeGreaterThan(500);expect(ws.getCell('A1').text).toBe('メーカー');expect(ws.getCell('AJ1').text).toContain('INV_');});
  it('imports only changed rows and accepts a new power level',async()=>{const file=await fileOf(ws=>{ws.getCell('E2').value=1.23;const row=ws.addRow([]);row.getCell(1).value='富士電機';row.getCell(2).value='400V';row.getCell(3).value=0.12;row.getCell(4).value='直入れ';row.getCell(5).value=0.5;row.getCell(6).value='';for(let c=7;c<=36;c++)row.getCell(c).value='';});const result=await parseSelectionWorkbook(file,[]);expect(result.errors).toEqual([]);expect(result.rows).toHaveLength(2);expect(result.rows[0].values.load.amps).toBe(1.23);expect(result.rows[1].key.kw).toBe(0.12);});
  it('reports negative currents by Excel row and blocks malformed headers',async()=>{const bad=await fileOf(ws=>{ws.getCell('E2').value=-1;});const result=await parseSelectionWorkbook(bad,[]);expect(result.errors[0]).toMatch(/行 2/);const header=await fileOf(ws=>{ws.getCell('A1').value='wrong';});await expect(parseSelectionWorkbook(header,[])).rejects.toThrow('列名');});
});
