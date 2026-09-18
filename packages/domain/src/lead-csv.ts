export type LeadCsvPreview = {
  valid: number;
  errors: { row: number; message: string }[];
  rows: Record<string, string>[];
  headers: string[];
  mapping: Record<string, string>;
};

export const EMAIL_HEADERS = ['email','email address','work email','e-mail','e-mail address','mail','work_email','emailaddress'];
export const EMAIL_COLUMN_HELP = `Name the email column email. These also work: ${EMAIL_HEADERS.filter(name => name !== 'email').join(', ')}. A name column is fine. First name and company are optional.`;
export const CSV_MAX_BYTES = 1_000_000;

export function isLeadCsvFile(file: { name: string; type?: string }) {
  const name = file.name.replace(/^\uFEFF/, '').trim().toLowerCase();
  if (name.endsWith('.csv')) return true;
  return /^(text\/csv|application\/csv|text\/plain)$/i.test(file.type ?? '');
}

export function leadCsvFileError(file: { name: string; type?: string; size: number }, maxBytes = CSV_MAX_BYTES) {
  if (!isLeadCsvFile(file)) return 'Drop a .csv file.';
  if (file.size > maxBytes) return 'Choose a CSV smaller than 1 MB.';
  return '';
}
const FIRST_HEADERS = ['first name','firstname','first_name','given name','given_name','first'];
const NAME_HEADERS = ['name','full name','fullname','full_name','contact name','contact_name'];
const LAST_HEADERS = ['last name','lastname','last_name','surname','family name','last'];
const COMPANY_HEADERS = ['company','company name','company_name','account','organization','organisation','business'];
const TITLE_HEADERS = ['title','job title','job_title','role','position'];
const WEBSITE_HEADERS = ['website','domain','company website','company_website','url','site'];

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function pickHeader(headers: string[], aliases: string[]) {
  const normalized = aliases.map(normalizeHeader);
  return headers.find(header => normalized.includes(normalizeHeader(header))) ?? '';
}

function detectDelimiter(csv: string) {
  const line = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const char of line) {
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char in counts) counts[char as ',' | ';' | '\t'] += 1;
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] >= counts[';']) return '\t';
  return ',';
}

function isBlankRecord(cells: string[]) {
  return cells.every(value => !value.trim());
}

/** RFC-4180 records; shared with proposal CSV so messy files keep original cells. */
export function parseCsvRecords(csv: string): { headers: string[]; records: string[][]; errors: LeadCsvPreview['errors'] } {
  const errors: LeadCsvPreview['errors'] = [];
  const records: string[][] = [];
  const delimiter = detectDelimiter(csv);
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;
  if (csv.length > 1_000_000) return { headers: [], records: [], errors: [{ row: 0, message: 'Import exceeds 1 MB.' }] };
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else cell += char;
      continue;
    }
    if (char === '"') { if (cell || afterQuote) errors.push({ row: records.length + 1, message: 'Unexpected quote in unquoted field.' }); quoted = true; continue; }
    if (char === delimiter || char === '\n' || char === '\r') {
      record.push(cell); cell = ''; afterQuote = false;
      if (char !== delimiter) { if (!isBlankRecord(record)) records.push(record); record = []; if (char === '\r' && csv[i + 1] === '\n') i++; }
    } else {
      if (afterQuote) errors.push({ row: records.length + 1, message: 'Unexpected text after closing quote.' });
      cell += char;
    }
  }
  if (quoted) errors.push({ row: records.length + 1, message: 'Unterminated quoted field.' });
  if (cell || record.length) { record.push(cell); if (!isBlankRecord(record)) records.push(record); }
  const headers = records.shift()?.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim()) ?? [];
  if (new Set(headers).size !== headers.length) errors.push({ row: 1, message: 'Duplicate column names are not allowed.' });
  if (records.length > 2000) errors.push({ row: 0, message: 'Maximum 2,000 rows per batch.' });
  return { headers, records, errors };
}

export function mapLeadHeaders(headers: string[]): Record<string, string> {
  const firstName = pickHeader(headers, FIRST_HEADERS);
  return {
    email: pickHeader(headers, EMAIL_HEADERS),
    firstName,
    name: firstName ? '' : pickHeader(headers, NAME_HEADERS),
    lastName: pickHeader(headers, LAST_HEADERS),
    company: pickHeader(headers, COMPANY_HEADERS),
    title: pickHeader(headers, TITLE_HEADERS),
    website: pickHeader(headers, WEBSITE_HEADERS),
  };
}

export function parseLeadCsv(csv: string, mappingOverride?: Partial<Record<string, string>>): LeadCsvPreview {
  const parsed = parseCsvRecords(csv);
  const mapping: Record<string, string> = {
    ...mapLeadHeaders(parsed.headers),
    ...Object.fromEntries(Object.entries(mappingOverride ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
  };
  const errors = [...parsed.errors];
  if (!mapping.email) errors.push({ row: 1, message: `${EMAIL_COLUMN_HELP} Instantly cannot send without an address.` });
  const rows: Record<string, string>[] = [];
  for (const [index, cells] of parsed.records.entries()) {
    if (cells.length !== parsed.headers.length) errors.push({ row: index + 2, message: `Expected ${parsed.headers.length} fields; received ${cells.length}.` });
    if (isBlankRecord(cells)) continue;
    rows.push(Object.fromEntries(parsed.headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ''])) as Record<string, string>);
  }
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const email = (row[mapping.email ?? ''] ?? '').trim().toLowerCase();
    const messages: string[] = [];
    if (!email) messages.push('Email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) messages.push('Email is invalid');
    else if (seen.has(email)) messages.push('Duplicate email in this file');
    if (email) seen.add(email);
    if (messages.length) errors.push({ row: index + 2, message: messages.join('; ') });
  }
  const invalidRows = new Set(errors.filter(error => error.row >= 2).map(error => error.row));
  return { valid: errors.some(error => error.row < 2) ? 0 : rows.length - invalidRows.size, errors, rows, headers: parsed.headers, mapping };
}

export function mappedLeadRow(row: Record<string, string>, mapping: Record<string, string>) {
  const mappedFirst = (row[mapping.firstName ?? ''] ?? '').trim();
  const mappedLast = (row[mapping.lastName ?? ''] ?? '').trim();
  const full = (row[mapping.name ?? ''] ?? '').trim();
  let firstName = mappedFirst;
  let lastName = mappedLast;
  if (!firstName && !lastName && full) {
    const parts = full.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ');
  }
  const custom = Object.fromEntries(Object.entries(row).filter(([header, value]) => value.trim() && !Object.values(mapping).includes(header)));
  return {
    email: (row[mapping.email ?? ''] ?? '').trim().toLowerCase(),
    firstName,
    lastName,
    company: (row[mapping.company ?? ''] ?? '').trim(),
    title: (row[mapping.title ?? ''] ?? '').trim(),
    website: (row[mapping.website ?? ''] ?? '').trim(),
    custom,
  };
}
