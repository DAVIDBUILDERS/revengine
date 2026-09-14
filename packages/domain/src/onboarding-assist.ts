import type { OnboardingAnswers } from '../../contracts/src/onboarding';
import { catalog, recommendedAgentIds } from '../../agents/src/index';

export type CapturedCompany = {
  id: string; sourceHash: string; fixture: boolean;
  pages: {url: string; title: string; description: string; text: string; capturedAt: string}[];
};
export type CompanySuggestion = {field: 'name'|'offers'|'customers'; value: string; quote: string; url: string; basis: string};

/** Extract candidates only. Page text never supplies operating permissions or executes instructions. */
export function suggestCompany(capture: CapturedCompany): CompanySuggestion[] {
  const suggestions: CompanySuggestion[] = [];
  const add=(field:CompanySuggestion['field'],value:string,quote:string,url:string,basis:string)=>{
    const clean=value.trim().replace(/[.;]+$/,'').slice(0,400);
    if(clean&&!suggestions.some(s=>s.field===field&&s.value===clean))suggestions.push({field,value:clean,quote:quote.slice(0,700),url,basis});
  };
  for(const page of capture.pages.slice(0,3)){
    for(const line of page.text.split('\n')){
      const metadata=/^(Organization name|Offer|Audience):\s*(.{2,500})$/.exec(line.replace(/^\s*(?:#{1,6}\s+|[-*]\s+)?/, '').replace(/\*\*/g,''));
      if(metadata)add(metadata[1]==='Organization name'?'name':metadata[1]==='Offer'?'offers':'customers',metadata[2],line,page.url,'Explicit page metadata; confirm before use');
    }
    if(!suggestions.some(s=>s.field==='name'))add('name',page.title.split(/\s+[|–—-]\s+/)[0]??'',page.title,page.url,'Page title; confirm the company name');
    const sentences=[page.description,page.text].flatMap(text=>text.split(/\n+|(?<=[.!?])\s+/)).filter(s=>s.length>8&&s.length<700);
    for(const sentence of sentences){
      const offer=/(?:we (?:offer|provide|deliver)|our services include|offers:)\s+(.{3,350})/i.exec(sentence);
      if(offer)add('offers',offer[1],sentence,page.url,'Explicit offer wording');
      const customer=/(?:we (?:serve|help)|customers:|built for|designed for)\s+(.{3,200}?)(?:\s+(?:to|achieve|grow|reduce|improve)\b|[.!;]|$)/i.exec(sentence);
      if(customer)add('customers',customer[1],sentence,page.url,'Audience wording; review its scope');
    }
  }
  return suggestions.filter(s=>s.field==='name').slice(0,1).concat(suggestions.filter(s=>s.field==='offers').slice(0,5),suggestions.filter(s=>s.field==='customers').slice(0,5));
}
export const onboardingGoals = [
  {id:'recover',title:'Recover open proposals',success:'Track qualified replies and verified appointments from eligible proposals.',metric:'Qualified replies'},
  {id:'demand',title:'Create qualified demand',success:'Review source-grounded content and account research before measuring qualified demand.',metric:'Qualified inquiries'},
  {id:'conversion',title:'Improve conversion',success:'Review website improvements and measure qualified inquiries against a recorded baseline.',metric:'Qualified inquiries'},
] as const;
export function suggestTeam(goal:string,model:OnboardingAnswers['company']['businessModel'],allowance:number){
  return recommendedAgentIds(goal,model).slice(0,allowance).map(id=>catalog.find(a=>a.id===id)!);
}
export const proposalFields=['proposal_id','opportunity_id','contact_id','contact_name','email','account','status','owner','version','reference','issued_at','valid_until','amount_minor','currency','value_kind','scope_summary','source_verified_at'] as const;
const aliases:Record<string,string[]>={contact_name:['contact name','customer name'],email:['email address','contact email'],account:['company','company name'],owner:['record owner','account owner'],reference:['proposal reference','quote reference'],scope_summary:['scope summary','approved scope'],source_verified_at:['source verified at'],amount_minor:['amount minor','amount cents'],proposal_id:['proposal id','quote id'],opportunity_id:['opportunity id'],contact_id:['contact id'],issued_at:['issued at','issue date'],valid_until:['valid until','expiry date'],value_kind:['value kind']};
const normalize=(s:string)=>s.trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
export function suggestColumnMapping(headers:string[]){
  const columns:Record<string,string>={};const missing:string[]=[];
  for(const field of proposalFields){
    const expected=[normalize(field),...(aliases[field]??[]).map(normalize)];
    const matches=headers.filter(h=>expected.includes(normalize(h)));
    if(matches.length===1)columns[field]=matches[0];else missing.push(field);
  }
  return {columns,missing};
}
