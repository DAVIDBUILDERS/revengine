import type {AppSnapshot} from '../../contracts/src/index';
import {companyConnectionCoverage, companySystemDefinitions, type SystemKind} from './company-connections';

export type DeliveryMode = 'copy_out' | 'needs_access' | 'connected' | 'engineering_required';
export type DestinationGuide = {kind:SystemKind;headline:string;takeaway:string;connectedNote:string};
export type AgentDelivery = {
 agentId:string;destination:SystemKind|null;destinationLabel:string;mode:DeliveryMode;copyOut:true;
 headline:string;detail:string;cardLabel:string;
};
export type SpecialistWorkSnapshot = {
 agentId:string;latestTitle:string|null;artifacts:number;actions:number;findings:number;counts:number[];
 delivery:AgentDelivery;
};

/** Where a specialist's work product goes. Sources stay in company-connections; this is takeaway/publish. */
export const agentDestinations: Partial<Record<string, DestinationGuide>> = {
 'search-growth':{kind:'commerce',headline:'Copy this into your blog',takeaway:'Commerce publishing is not connected. Copy this brief into Shopify, WordPress or your CMS.',connectedNote:'A commerce destination is connected. Copy this brief for now; publishing after review is not implemented.'},
 'technical-seo-monitor':{kind:'website',headline:'Copy these checks onto your site',takeaway:'DAVID does not change your website. Copy titles, descriptions and fixes into your CMS or theme.',connectedNote:'Your website is captured as a source. Copy these checks onto the live site; DAVID does not write them back.'},
 'landing-page-optimizer':{kind:'website',headline:'Copy this onto your landing page',takeaway:'Nothing is published. Copy the suggested copy into your site and measure the result yourself.',connectedNote:'Your website is captured as a source. Copy this onto the live page; DAVID does not deploy it.'},
 'social-content-publisher':{kind:'social',headline:'Copy this into your social tools',takeaway:'Social publishing is not connected. Copy this draft into the account you use.',connectedNote:'A social destination is connected. Copy this draft for now; publishing after review is not implemented.'},
 'creative-performance':{kind:'advertising',headline:'Copy this into your ads account',takeaway:'Advertising is not connected. Copy these concepts into Meta, Google Ads or your media buyer.',connectedNote:'An advertising destination is connected. Copy these concepts for now; campaign changes after review are not implemented.'},
 'paid-campaign-operator':{kind:'advertising',headline:'Copy this into your ads account',takeaway:'Advertising is not connected. Copy this plan into the ads account you use.',connectedNote:'An advertising destination is connected. Copy this plan for now; campaign execution after review is not implemented.'},
 'video-script-producer':{kind:'drive',headline:'Copy this script for production',takeaway:'No video is rendered. Copy the script and shot list into your production tools.',connectedNote:'A files destination is connected. Copy this script for now; rendering is not implemented.'},
 'local-search-manager':{kind:'local',headline:'Copy this into your listings',takeaway:'Listing changes are not connected. Copy this checklist into Google Business or your local profiles.',connectedNote:'A listings destination is connected. Copy this checklist for now; listing writes after review are not implemented.'},
 'website-sales-concierge':{kind:'website',headline:'Copy these answers onto your site',takeaway:'Live chat is not deployed. Copy the FAQ onto your site or help center.',connectedNote:'Your website is captured as a source. Copy these answers onto the live site; chat is not deployed.'},
 'account-intelligence':{kind:'drive',headline:'Copy this company brief',takeaway:'This is an internal brief. Copy it into your notes or share it with the team.',connectedNote:'A files destination is connected. Copy this brief; DAVID does not file it automatically.'},
 'product-merchandiser':{kind:'commerce',headline:'Copy this into your store',takeaway:'Commerce is not connected. Copy merchandising notes into Shopify or your catalog tools.',connectedNote:'A commerce destination is connected. Copy this for now; catalog writes after review are not implemented.'},
 'linkedin-outreach-assistant':{kind:'social',headline:'Copy these notes into LinkedIn',takeaway:'LinkedIn sending is not live. Copy approved notes into the company LinkedIn account.',connectedNote:'A social destination is connected. Copy these notes; sending after review is not implemented.'},
 'partner-development':{kind:'mail',headline:'Copy this partner intro',takeaway:'No partner email was sent. Copy the intro into the mail tool you use.',connectedNote:'Email is connected as a source. Copy this intro; DAVID does not send it.'},
 'outbound-email-sdr':{kind:'mail',headline:'Copy this sequence into mail',takeaway:'No outbound email was sent. Copy the sequence into Klaviyo or the sender you use.',connectedNote:'Email is connected as a source. Copy this sequence; DAVID does not send it.'},
 'rfp-opportunity-scout':{kind:'rfp',headline:'Copy this RFP response outline',takeaway:'No bid was filed. Copy the watchlist into the proposal tool you use.',connectedNote:'An RFP destination is connected. Copy this outline; filing after review is not implemented.'},
};

function systemLabel(kind:SystemKind){return companySystemDefinitions.find(item=>item.kind===kind)?.label??kind;}

function modeFor(status:ReturnType<typeof companyConnectionCoverage>['systems'][number]['status']):DeliveryMode {
 if(status==='engineering_required')return 'engineering_required';
 if(status==='needs_access')return 'needs_access';
 if(status==='verified'||status==='connected')return 'connected';
 return 'copy_out';
}

function cardLabel(guide:DestinationGuide|undefined,mode:DeliveryMode,execution:boolean){
 if(!guide)return execution?'Open customer work':'Copy this work';
 if(mode==='needs_access')return 'Ready to connect';
 if(guide.kind==='website'||guide.kind==='commerce')return 'Copy to your site';
 if(guide.kind==='social'||guide.kind==='advertising')return 'Copy to your channels';
 return 'Copy this work';
}

/** Copy-out is always valid work. Connected publish is an upgrade, never a requirement. */
export function agentDelivery(state:AppSnapshot,agentId:string):AgentDelivery {
 const guide=agentDestinations[agentId];
 const agent=state.catalog.find(item=>item.id===agentId);
 const execution=!!agent&&!agent.modes.includes('preparation');
 if(!guide)return {agentId,destination:null,destinationLabel:'Your tools',mode:'copy_out',copyOut:true,headline:execution?'Work stays in customer records':'Copy this work',detail:execution?'Review the exact customer record. This specialist does not produce a copy-out package.':'Copy this work into your own tools. Publishing is not connected.',cardLabel:cardLabel(undefined,'copy_out',execution)};
 const coverage=companyConnectionCoverage(state).systems.find(item=>item.kind===guide.kind);
 const mode=coverage?modeFor(coverage.status):'engineering_required';
 const detail=mode==='connected'?guide.connectedNote:mode==='needs_access'?`${coverage?.detail??'This destination still needs access.'} Copy this work for now.`:guide.takeaway;
 return {agentId,destination:guide.kind,destinationLabel:systemLabel(guide.kind),mode,copyOut:true,headline:guide.headline,detail,cardLabel:cardLabel(guide,mode,false)};
}

export function artifactCopyText(artifact:{title:string;content:string;limitation:string}){
 return `${artifact.title}\n\n${artifact.content}\n\n${artifact.limitation}`.trim();
}

export function specialistWorkSnapshot(state:AppSnapshot,agentId:string):SpecialistWorkSnapshot {
 const artifacts=state.artifacts.filter(item=>item.agentId===agentId).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const findings=state.findings.filter(item=>item.agentId===agentId).slice().sort((a,b)=>b.reviewAt.localeCompare(a.reviewAt));
 const installation=state.installations.find(item=>item.agentId===agentId);
 const actions=state.actions.filter(item=>item.installationId===installation?.id).length;
 return {agentId,latestTitle:artifacts[0]?.title??findings[0]?.title??null,artifacts:artifacts.length,actions,findings:findings.length,counts:[artifacts.length,actions,findings.length],delivery:agentDelivery(state,agentId)};
}

export type TeamActivityPoint = {
 agentId:string;name:string;shortLabel:string;latestTitle:string|null;
 artifacts:number;actions:number;findings:number;total:number;
};

export function shortAgentLabel(name:string){
 return name
  .replace(/ Assistant$/,'')
  .replace(/ Monitor$/,'')
  .replace(/ Coordinator$/,'')
  .replace(/ Opportunity Scout$/,'')
  .replace(/ Email SDR$/,'')
  .replace(/^Technical /,'')
  .replace(/^Website Sales /,'');
}

export function teamActivitySeries(state:AppSnapshot):TeamActivityPoint[] {
 return state.activation.selectedTeam.map(agentId=>{
  const agent=state.catalog.find(item=>item.id===agentId);
  const work=specialistWorkSnapshot(state,agentId);
  return {
   agentId,
   name:agent?.name??agentId,
   shortLabel:shortAgentLabel(agent?.name??agentId),
   latestTitle:work.latestTitle,
   artifacts:work.artifacts,
   actions:work.actions,
   findings:work.findings,
   total:work.artifacts+work.actions+work.findings,
  };
 });
}

export function teamActivityNarrative(state:AppSnapshot){
 const points=teamActivitySeries(state);
 const active=points.filter(point=>point.total>0);
 const replies=state.metrics.find(item=>item.key==='human_replies')?.value;
 const bookings=state.metrics.find(item=>item.key==='verified_bookings')?.value;
 const onPass=isWalkthroughFloor(state)&&active.some(point=>agentFloorStatus(state,point.agentId,defaultHumanReview(point.agentId))==='on_pass');
 const headline=active.length
  ? onPass
   ?`The team ran overnight. One specialist is still on a pass.`
   :`The team already ran. ${active.length} specialist${active.length===1?'':'s'} left work you can open.`
  :'The team has not saved work yet.';
 const sentences=active.map(point=>point.latestTitle?`${point.name} — ${point.latestTitle}.`:`${point.name} recorded ${point.artifacts} draft${point.artifacts===1?'':'s'}.`);
 if(typeof replies==='number'&&replies>0)sentences.push(`${replies} human ${replies===1?'reply is':'replies are'} already on the record.`);
 if(typeof bookings==='number'&&bookings>0)sentences.push(`${bookings} ${bookings===1?'booking was':'bookings were'} recorded.`);
 return {headline,body:sentences.join(' ')};
}

export type FloorStatus = 'completed' | 'on_pass' | 'held' | 'idle';
export type ActivityKind = 'draft' | 'recommendation' | 'action' | 'held';
export type TeamActivityEvent = {
 id:string;at:string;agentId:string;name:string;kind:ActivityKind;title:string;verb:string;
};
export type SpecialistRun = {
 id:string;at:string;kind:ActivityKind;title:string;detail:string;limitation?:string;
 artifactId?:string;findingId?:string;actionId?:string;
};
export type ConversationMessage = {
 id:string;at:string;kind:'message_out'|'message_in'|'message_note';actor:'david'|'human'|'source';title:string;body:string;
};

const ON_PASS_AGENT = 'technical-seo-monitor';
const MESSAGE_KINDS = new Set(['message_out','message_in','message_note','reply']);

export function defaultHumanReview(agentId:string){
 return agentId === 'outbound-email-sdr';
}

export function isWalkthroughFloor(state:Pick<AppSnapshot,'workspace'>,quiet?:boolean){
 return !!quiet || state.workspace.name === 'Wallaroo Media';
}

export function agentFloorStatus(state:AppSnapshot,agentId:string,humanReview=defaultHumanReview(agentId)):FloorStatus {
 const work=specialistWorkSnapshot(state,agentId);
 const installation=state.installations.find(item=>item.agentId===agentId);
 const held=humanReview && state.actions.some(item=>item.installationId===installation?.id && item.status==='not_attempted' && state.approvals.some(approval=>approval.actionId===item.id && approval.status==='pending'));
 if(held)return 'held';
 if(agentId===ON_PASS_AGENT && (work.artifacts||work.actions||work.findings))return 'on_pass';
 if(work.artifacts||work.actions||work.findings)return 'completed';
 return 'idle';
}

export function floorStatusLabel(status:FloorStatus){
 return status==='on_pass'?'On pass':status==='held'?'Held for review':status==='completed'?'Completed overnight':'Idle';
}

function findingNoticedAt(reviewAt:string){
 return new Date(Date.parse(reviewAt)-7*86400000).toISOString();
}

export function activityLabel(kind:ActivityKind){
 return kind==='held'?'Held for review':kind==='recommendation'?'Flagged':kind==='action'?'Recorded an action':'Wrote to the log';
}

export function specialistRunLog(state:AppSnapshot,agentId:string,humanReview=defaultHumanReview(agentId)):SpecialistRun[] {
 const installation=state.installations.find(item=>item.agentId===agentId);
 const runs:SpecialistRun[]=[];
 for(const artifact of state.artifacts.filter(item=>item.agentId===agentId)){
  runs.push({id:artifact.id,at:artifact.createdAt,kind:'draft',title:artifact.title,detail:artifact.content,limitation:artifact.limitation,artifactId:artifact.id});
 }
 for(const finding of state.findings.filter(item=>item.agentId===agentId)){
  runs.push({id:finding.id,at:findingNoticedAt(finding.reviewAt),kind:'recommendation',title:finding.title,detail:finding.observedCondition,findingId:finding.id});
 }
 for(const action of state.actions.filter(item=>item.installationId===installation?.id)){
  const held=humanReview && action.status==='not_attempted' && state.approvals.some(approval=>approval.actionId===action.id && approval.status==='pending');
  runs.push({id:action.id,at:action.createdAt,kind:held?'held':'action',title:action.payload.subject,detail:action.payload.body,actionId:action.id});
 }
 return runs.sort((a,b)=>b.at.localeCompare(a.at)||a.title.localeCompare(b.title));
}

export function teamActivityFeed(state:AppSnapshot,humanReviewFor:(agentId:string)=>boolean=defaultHumanReview):TeamActivityEvent[] {
 return state.activation.selectedTeam.flatMap(agentId=>{
  const agent=state.catalog.find(item=>item.id===agentId);
  const name=agent?.name??agentId;
  return specialistRunLog(state,agentId,humanReviewFor(agentId)).map(run=>({id:run.id,at:run.at,agentId,name,kind:run.kind,title:run.title,verb:activityLabel(run.kind)}));
 }).sort((a,b)=>b.at.localeCompare(a.at)||a.name.localeCompare(b.name));
}

export function conversationThread(state:AppSnapshot,opportunityId:string):ConversationMessage[] {
 return state.timeline.filter(item=>item.opportunityId===opportunityId && MESSAGE_KINDS.has(item.kind)).slice().sort((a,b)=>a.at.localeCompare(b.at)).map(item=>({
  id:item.id,
  at:item.at,
  kind:item.kind==='message_note'?'message_note':item.kind==='message_out'?'message_out':'message_in',
  actor:item.actor,
  title:item.title,
  body:item.detail,
 }));
}
