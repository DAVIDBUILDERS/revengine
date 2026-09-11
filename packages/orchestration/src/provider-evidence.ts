import type {MailMessage} from '../../connectors/src/index';

/** Source choice is explicit; an account with several resources cannot pick the first row. */
export function chooseBoundResource<T extends {resource_type:string;resource_id:string;range_name:string|null}>(bindings:T[],type:string,requiredId?:string):T|undefined {
 const candidates=bindings.filter(binding=>binding.resource_type===type&&(!requiredId||binding.resource_id===requiredId));
 if(candidates.length>1)throw new Error('RESOURCE_BINDING_AMBIGUOUS: Select one exact source/calendar for this run.');
 if(requiredId&&!candidates.length)throw new Error('RESOURCE_BINDING_MISSING: The approved resource is not bound to this connection.');
 return candidates[0];
}
/** Gmail system labels establish outgoing/draft status; an untrusted From header cannot. */
export function inboundSince(messages:MailMessage[],_sender:string,baseline:string):MailMessage[] {
 const threshold=Date.parse(baseline);if(!Number.isFinite(threshold))throw new Error('REPLY_BASELINE_MISSING: Verify the proposal/conversation start.');
 const inbound=messages.filter(message=>!message.labels.includes('SENT')&&!message.labels.includes('DRAFT'));
 if(inbound.some(message=>!message.receivedAt||!Number.isFinite(Date.parse(message.receivedAt))))throw new Error('REPLY_TIME_UNVERIFIED: A relevant message needs operator review.');
 return inbound.filter(message=>Date.parse(message.receivedAt!)>=threshold);
}

export type ApprovedSourceSnapshot={proposal_id:string;contact_email:string;owner:string;scope_summary:string;version:number;valid_until:string|null;currency:string;amount_minor:number|null;value_kind:string;issued_at:string};
/** A same-version edit is still a material change. Never silently reapprove it. */
export function validateCriticalSheet(values:string[][],mapping:Record<string,string>,expected:ApprovedSourceSnapshot,recipient:string):{status:'open'|'accepted'|'declined'|'on_hold'|'expired'|'unknown';verifiedAt:string} {
 const headers=values[0]??[];const required=['proposal_id','status','version','source_verified_at','email','owner','scope_summary','valid_until','currency','amount_minor','value_kind','issued_at'];
 const column=(name:string)=>{const label=mapping[name]??name;const indexes=headers.flatMap((header,index)=>header===label?[index]:[]);if(indexes.length!==1)throw new Error(`SOURCE_SCHEMA_DRIFT: Verify one mapped ${name} column.`);return indexes[0]!;};
 for(const field of required)column(field);
 if(!expected||!expected.proposal_id||!Number.isInteger(expected.version))throw new Error('APPROVED_SOURCE_SNAPSHOT_MISSING: Create a new draft with an immutable source snapshot.');
 const rows=values.slice(1).filter(row=>row[column('proposal_id')]===expected.proposal_id);if(rows.length!==1)throw new Error('SOURCE_IDENTITY_CONFLICT: Exactly one source row must match the approved proposal.');
 const row=rows[0]!;const get=(key:string)=>row[column(key)]??'';
 const status=get('status');if(!['open','accepted','declined','on_hold','expired','unknown'].includes(status))throw new Error('SOURCE_REVIEW_REQUIRED: Unknown proposal status.');
 const timestamp=(value:string,nullable=false)=>{if(nullable&&!value)return null;if(!/^\d{4}-\d{2}-\d{2}T/.test(value)||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('SOURCE_REVIEW_REQUIRED: Source dates need explicit ISO timestamps.');return Date.parse(value);};
 const money=get('amount_minor')===''?null:/^\d+$/.test(get('amount_minor'))?Number(get('amount_minor')):NaN;
 const changed=get('email')!==recipient||get('email')!==expected.contact_email||get('owner')!==expected.owner||get('scope_summary')!==expected.scope_summary
  ||!/^\d+$/.test(get('version'))||Number(get('version'))!==expected.version||timestamp(get('valid_until'),true)!==(expected.valid_until?Date.parse(expected.valid_until):null)
  ||get('currency')!==expected.currency||money!==expected.amount_minor||(money!==null&&!Number.isSafeInteger(money))||get('value_kind')!==expected.value_kind
  ||timestamp(get('issued_at'))!==Date.parse(expected.issued_at);
 if(changed)throw new Error('SOURCE_MATERIAL_CHANGE: Recipient, owner, scope, validity, currency, value or version changed. Invalidate the approval and prepare a new reviewed draft.');
 const verifiedAt=get('source_verified_at');timestamp(verifiedAt);if(Date.parse(verifiedAt)>Date.now()+60_000)throw new Error('SOURCE_REVIEW_REQUIRED: Source verification time is in the future.');
 return{status:status as 'open'|'accepted'|'declined'|'on_hold'|'expired'|'unknown',verifiedAt:new Date(verifiedAt).toISOString()};
}
