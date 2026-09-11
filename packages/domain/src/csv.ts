import { ProposalRecord } from '../../contracts/src/index';

export const CSV_FIELDS = ['proposal_id', 'opportunity_id', 'contact_id', 'contact_name', 'email', 'account', 'status', 'owner', 'version', 'reference', 'issued_at', 'valid_until', 'amount_minor', 'currency', 'value_kind', 'scope_summary', 'source_verified_at'] as const;
export type CsvPreview = { valid: number; errors: {row: number; message: string}[]; rows: Record<string, string>[] };
/** RFC-4180 style parser; retains original cells and rejects malformed quoting/duplicate fields. */
export function parseCsvImport(csv: string): CsvPreview {
  const errors: CsvPreview['errors'] = []; const records: string[][] = []; let record: string[] = []; let cell = ''; let quoted = false; let afterQuote = false;
  if (csv.length > 1_000_000) return { valid: 0, errors: [{ row: 0, message: 'Import exceeds 1 MB.' }], rows: [] };
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) { if (char === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (char === '"') { quoted = false; afterQuote = true; } else cell += char; continue; }
    if (char === '"') { if (cell || afterQuote) errors.push({ row: records.length + 1, message: 'Unexpected quote in unquoted field.' }); quoted = true; continue; }
    if (char === ',' || char === '\n' || char === '\r') {
      record.push(cell); cell = ''; afterQuote = false;
      if (char !== ',') { if (record.some(value => value !== '')) records.push(record); record = []; if (char === '\r' && csv[i + 1] === '\n') i++; }
    } else { if (afterQuote) errors.push({ row: records.length + 1, message: 'Unexpected text after closing quote.' }); cell += char; }
  }
  if (quoted) errors.push({row: records.length + 1, message: 'Unterminated quoted field.'});
  if (cell || record.length) { record.push(cell); records.push(record); }
  const headers = records.shift()?.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim()) ?? [];
  if (new Set(headers).size !== headers.length) errors.push({ row: 1, message: 'Duplicate column names are not allowed.' });
  const missing = CSV_FIELDS.filter(field => !headers.includes(field));
  if (missing.length) errors.push({ row: 1, message: `Missing required mapped columns: ${missing.join(', ')}` });
  if (records.length > 2000) errors.push({ row: 0, message: 'Maximum 2,000 rows per batch.' });
  const rows = records.map((cells, index) => { if (cells.length !== headers.length) errors.push({ row: index + 2, message: `Expected ${headers.length} fields; received ${cells.length}.` }); return Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ''])); });
  const seenProposals = new Set<string>(); const contactIdentities = new Map<string, string>(); const emailIdentities = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const messages: string[] = [];
    for (const key of ['proposal_id', 'opportunity_id', 'contact_id', 'contact_name', 'email', 'account', 'status', 'owner', 'version', 'reference', 'issued_at', 'currency', 'value_kind', 'scope_summary', 'source_verified_at']) if (!row[key]?.trim()) messages.push(`${key} is required`);
    for (const key of ['proposal_id', 'opportunity_id', 'contact_id']) if (row[key] && !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(row[key])) messages.push(`${key} must be a stable source identifier`);
    if (!['open','accepted','declined','on_hold','expired'].includes(row.status)) messages.push('Status must use a reviewed mapping; unknown values require owner review');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email ?? '')) messages.push('Selected email channel is invalid');
    if (!/^[1-9]\d*$/.test(row.version ?? '') || !Number.isSafeInteger(Number(row.version))) messages.push('Version must be a positive integer');
    if (row.amount_minor && (!/^\d+$/.test(row.amount_minor) || !Number.isSafeInteger(Number(row.amount_minor)))) messages.push('Amount must be nonnegative integer minor units or blank for unknown');
    if (!/^[A-Z]{3}$/.test(row.currency ?? '')) messages.push('Currency must be a three-letter uppercase code');
    if (!['one_time','monthly_recurring','total_contract','unknown'].includes(row.value_kind)) messages.push('Value kind needs an explicit reviewed mapping');
    for (const key of ['issued_at','source_verified_at', ...(row.valid_until ? ['valid_until'] : [])]) if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(row[key] ?? '') || !Number.isFinite(Date.parse(row[key]))) messages.push(`${key} must be a UTC timestamp`);
    if (row.valid_until && Date.parse(row.valid_until) < Date.parse(row.issued_at)) messages.push('Validity cannot end before proposal issuance');
    if (seenProposals.has(row.proposal_id)) messages.push('Duplicate proposal_id in batch');
    seenProposals.add(row.proposal_id);
    const email = (row.email ?? '').trim().toLowerCase();
    if (contactIdentities.has(row.contact_id) && contactIdentities.get(row.contact_id) !== email) messages.push('Contact ID has conflicting email identities');
    if (emailIdentities.has(email) && emailIdentities.get(email) !== row.contact_id) messages.push('Email is mapped to multiple contact IDs; resolve ownership');
    contactIdentities.set(row.contact_id, email); emailIdentities.set(email, row.contact_id);
    if (messages.length) errors.push({row:index + 2, message:messages.join('; ')});
  }
  const invalidRows = new Set(errors.filter(error => error.row >= 2).map(error => error.row));
  return { valid: errors.some(error => error.row < 2) ? 0 : rows.length - invalidRows.size, errors, rows };
}

export function normalizedProposal(row: Record<string,string>, binding: {workspaceId:string; proposalId:string; opportunityId:string; contactId:string; now:string; fixture:boolean; evidence:ProposalRecord['evidence']}) {
  return ProposalRecord.parse({schemaVersion:1,id:binding.proposalId,workspaceId:binding.workspaceId,opportunityId:binding.opportunityId,contactId:binding.contactId,version:Number(row.version),reference:row.reference,issuedAt:row.issued_at,validUntil:row.valid_until||null,amountMinor:row.amount_minor ? Number(row.amount_minor):null,currency:row.currency,valueKind:row.value_kind,scopeSummary:row.scope_summary,status:row.status,rawStatus:row.status,owner:row.owner,sourceUrl:null,sourceVerifiedAt:row.source_verified_at,syncedAt:binding.now,evidence:binding.evidence,fixture:binding.fixture});
}
