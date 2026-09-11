import {z} from 'zod';
import {database,nonproductionTarget,blocked} from './runtime';
import {createFixtureState} from '../packages/domain/src/index';
const target=nonproductionTarget();
const actors=[process.env.TEST_OWNER_A_ID,process.env.TEST_OWNER_B_ID];
if(actors.some(id=>!z.uuid().safeParse(id).success))blocked('Set TEST_OWNER_A_ID and TEST_OWNER_B_ID to two already provisioned nonproduction Supabase Auth user IDs. Seed never sends invitations or creates real contacts.');
const sql=database(target.url);
try{await sql.begin(async tx=>{for(const [index,key]of ['hosted-test-a','hosted-test-b'].entries()){
 const state=createFixtureState(key);const w=state.workspace;const member=state.context.membershipId;
 const [actor]=await tx`select id from auth.users where id=${actors[index]!}::uuid`;if(!actor)throw new Error('Test Auth actor does not exist in the expected hosted project');
 await tx`insert into public.workspaces(id,name,environment,business_model,time_zone,paused,currency,subscription_minor) values(${w.id}::uuid,${`Synthetic ${key}`},'shadow',${w.businessModel},${w.timeZone},true,${w.currency},${w.subscriptionMinor}) on conflict(id) do nothing`;
 await tx`insert into public.memberships(id,workspace_id,actor_id,role) values(${member}::uuid,${w.id}::uuid,${actors[index]!}::uuid,'workspace_owner') on conflict(workspace_id,actor_id) do nothing`;
 const connection=state.connections[0].id;const binding=state.connections[1].id;
 await tx`insert into public.connections(id,workspace_id,provider,identity,operations,health) values(${connection}::uuid,${w.id}::uuid,'fixture','SYNTHETIC test records only',array['proposals.read'],'fixture') on conflict(id) do nothing`;
 await tx`insert into public.source_bindings(id,workspace_id,connection_id,resource_id,resource_type,source_owner) values(${binding}::uuid,${w.id}::uuid,${connection}::uuid,'synthetic-fixture','csv','Test engineer') on conflict(id) do nothing`;
 for(const proposal of state.proposals){const opp=state.opportunities.find(o=>o.id===proposal.opportunityId)!;const contact=state.contacts.find(c=>c.id===proposal.contactId)!;
 await tx`insert into public.accounts(id,workspace_id,name,source_key) values(${opp.accountId}::uuid,${w.id}::uuid,${contact.account},${opp.accountId}) on conflict(id) do nothing`;
 await tx`insert into public.contacts(id,workspace_id,account_id,name,email,source_key,suppressed,enrolled,owner) values(${contact.id}::uuid,${w.id}::uuid,${opp.accountId}::uuid,${contact.name},${contact.email},${contact.id},${contact.suppressed},false,'Test engineer') on conflict(id) do nothing`;
 await tx`insert into public.opportunities(id,workspace_id,contact_id,account_id,owner,stage,raw_stage,business_model,source_key) values(${opp.id}::uuid,${w.id}::uuid,${contact.id}::uuid,${opp.accountId}::uuid,'Test engineer',${opp.stage},${opp.rawStage},${opp.businessModel},${opp.id}) on conflict(id) do nothing`;
 await tx`insert into public.proposals(id,workspace_id,opportunity_id,contact_id,source_binding_id,source_key,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,status,raw_status,owner,source_verified_at,synced_at,fixture) values(${proposal.id}::uuid,${w.id}::uuid,${opp.id}::uuid,${contact.id}::uuid,${binding}::uuid,${proposal.reference},${proposal.version},${proposal.reference},${proposal.issuedAt}::timestamptz,${proposal.validUntil}::timestamptz,${proposal.amountMinor},${proposal.currency},${proposal.valueKind},${proposal.scopeSummary},${proposal.status},${proposal.rawStatus},'Test engineer',${proposal.sourceVerifiedAt}::timestamptz,${proposal.syncedAt}::timestamptz,true) on conflict(id) do nothing`;
 }
 console.log(`Seeded ${key}: eight synthetic proposals, not enrolled; workspace paused and outbound disabled.`);
}});}finally{await sql.end();}
