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
 const installation=state.installations.find(item=>item.agentId===agentId);
 const actions=state.actions.filter(item=>item.installationId===installation?.id).length;
 const findings=state.findings.filter(item=>item.agentId===agentId).length;
 return {agentId,latestTitle:artifacts[0]?.title??null,artifacts:artifacts.length,actions,findings,counts:[artifacts.length,actions,findings],delivery:agentDelivery(state,agentId)};
}
