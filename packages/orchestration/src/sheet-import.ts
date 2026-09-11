import {CSV_FIELDS,parseCsvImport} from '../../domain/src/csv';

/** Map only explicitly named headers; never infer identity, dates, currency or consent. */
export function normalizeSheetRows(values: readonly (readonly unknown[])[], columns: Record<string,string>) {
  const headers=(values[0]??[]).map(value=>String(value).trim());
  if(new Set(headers).size!==headers.length)throw new Error('SHEET_DUPLICATE_HEADERS');
  const fields=[...CSV_FIELDS,...['account_id','gmail_thread_id'].filter(field=>headers.includes(columns[field]??field))];
  const indices=fields.map(field=>headers.indexOf(columns[field]??field));
  if(indices.some(index=>index<0))throw new Error('SHEET_MAPPING_REQUIRED: Map every required proposal field before ingestion.');
  const rows=values.slice(1).filter(row=>row.some(cell=>cell!==''&&cell!==null&&cell!==undefined));
  if(rows.length>500)throw new Error('SHEET_ROW_LIMIT: Bind a bounded range of at most 500 proposal rows plus its header.');
  const quote=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;
  const csv=[fields.map(quote).join(','),...rows.map(row=>indices.map(index=>quote(row[index])).join(','))].join('\n');
  const preview=parseCsvImport(csv);
  if(preview.errors.length)throw new Error(`SHEET_ROWS_INVALID: ${preview.errors.slice(0,3).map(error=>`row ${error.row}: ${error.message}`).join(' | ')}`);
  return preview.rows;
}
