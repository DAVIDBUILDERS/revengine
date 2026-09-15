import {describe,expect,it} from 'vitest';
import {createFixtureState,snapshot} from '@david/domain';
import {saveOnboarding} from '../packages/domain/src/onboarding';
import {agentDelivery,agentDestinations,agentFloorStatus,artifactCopyText,conversationThread,specialistWorkSnapshot,teamActivityFeed,teamActivityNarrative,teamActivitySeries} from '../packages/domain/src/delivery';
import {onboardingFor} from '@david/domain';

describe('agent delivery modes',()=>{
 it('treats unimplemented destinations as copy-out, not a blocker',()=>{
  const state=snapshot(createFixtureState());
  const search=agentDelivery(state,'search-growth');
  expect(search.mode).toBe('engineering_required');
  expect(search.copyOut).toBe(true);
  expect(search.destination).toBe('commerce');
  expect(search.cardLabel).toBe('Copy to your site');
  expect(search.detail).toMatch(/not connected/i);
  expect(search.detail.toLowerCase()).not.toMatch(/blocker/);
  const social=agentDelivery(state,'social-content-publisher');
  expect(social.mode).toBe('engineering_required');
  expect(social.copyOut).toBe(true);
  expect(social.cardLabel).toBe('Copy to your channels');
 });
 it('keeps website takeaways as copy-out even when the site is a captured source',()=>{
  const state=snapshot(createFixtureState());
  const seo=agentDelivery(state,'technical-seo-monitor');
  expect(seo.destination).toBe('website');
  expect(seo.copyOut).toBe(true);
  expect(seo.headline).toMatch(/onto your site/i);
  expect(seo.cardLabel).toBe('Copy to your site');
  expect(seo.mode).toBe('copy_out');
 });
 it('uses needs_access when a supported destination still lacks grant, without implying publish',()=>{
  const engine=createFixtureState('delivery-access');engine.workspace.mode='shadow';engine.context.environment='shadow';
  const answers=structuredClone(onboardingFor(engine).answers);
  answers.systems=[{id:'web',kind:'website',tool:'CMS',availability:'admin_needed',resource:'https://company.example',owner:'Owner',mapping:'',connectionId:''}];
  engine.onboarding=saveOnboarding(engine,answers,0);
  const state=snapshot(engine);
  const landing=agentDelivery(state,'landing-page-optimizer');
  expect(landing.mode).toBe('needs_access');
  expect(landing.copyOut).toBe(true);
  expect(landing.cardLabel).toBe('Ready to connect');
  expect(landing.detail).toMatch(/Copy this work for now/i);
  expect(landing.detail).not.toMatch(/publish/i);
 });
 it('marks a verified website as connected for takeaway agents while still requiring copy-out',()=>{
  const engine=createFixtureState('delivery-connected');engine.workspace.mode='shadow';engine.context.environment='shadow';
  const answers=structuredClone(onboardingFor(engine).answers);
  Object.assign(answers.company,{website:'https://company.example',offers:['Service'],customers:['Owners']});
  engine.onboarding=saveOnboarding(engine,answers,0);
  engine.onboardingCapture={id:'00000000-0000-4000-8000-000000000041',sourceHash:'a'.repeat(64),fixture:false,pages:[{url:'https://company.example/',title:'Home',description:'Offer',text:'Enough readable public copy for a captured page.',capturedAt:engine.asOf}]};
  engine.activation.confirmedFacts=true;
  const state=snapshot(engine);
  const seo=agentDelivery(state,'technical-seo-monitor');
  expect(seo.mode).toBe('connected');
  expect(seo.copyOut).toBe(true);
  expect(seo.detail).toMatch(/does not write/i);
 });
 it('does not invent publish destinations for execution specialists',()=>{
  const state=snapshot(createFixtureState());
  const follow=agentDelivery(state,'deal-follow-up');
  expect(follow.destination).toBeNull();
  expect(follow.cardLabel).toBe('Open customer work');
  expect(agentDestinations['deal-follow-up']).toBeUndefined();
 });
 it('summarizes recorded work counts without inventing metrics',()=>{
  const engine=createFixtureState();
  const artifact={id:'00000000-0000-4000-8000-000000000051',workspaceId:engine.workspace.id,agentId:'search-growth',type:'ContentBrief',sourceSnapshot:engine.company.evidence,factualInputs:['Company'],title:'A practical guide',content:'Outline',reviewState:'draft' as const,capabilityVersion:'1.0.0',runId:'00000000-0000-4000-8000-000000000052',createdAt:'2026-09-10T16:00:01.000Z',limitation:'Not published.'};
  engine.artifacts.push(artifact);
  const snap=specialistWorkSnapshot(snapshot(engine),'search-growth');
  expect(snap.latestTitle).toBe('A practical guide');
  expect(snap.counts[0]).toBeGreaterThanOrEqual(2);
  expect(artifactCopyText(artifact)).toContain('A practical guide');
  expect(artifactCopyText(artifact)).toContain('Not published.');
 });
 it('surfaces fixture work for every selected specialist',()=>{
  const state=snapshot(createFixtureState());
  for(const id of state.activation.selectedTeam){
   const work=specialistWorkSnapshot(state,id);
   expect(work.latestTitle||work.artifacts||work.findings||work.actions,id).toBeTruthy();
  }
  expect(specialistWorkSnapshot(state,'deal-follow-up').latestTitle).toBeTruthy();
  expect(specialistWorkSnapshot(state,'appointment-coordinator').latestTitle).toMatch(/calendar/i);
 });
 it('summarizes the active team on an x/y activity series',()=>{
  const wallaroo=snapshot(createFixtureState('wallaroo'));
  const series=teamActivitySeries(wallaroo);
  expect(series.map(item=>item.agentId)).toEqual(wallaroo.activation.selectedTeam);
  expect(series.every(item=>item.total>0)).toBe(true);
  expect(teamActivityNarrative(wallaroo).headline).toMatch(/ran overnight/i);
  expect(teamActivityNarrative(wallaroo).body).toMatch(/LinkedIn Outreach Assistant/);
  expect(teamActivityNarrative(snapshot(createFixtureState())).headline).toMatch(/already ran/i);
 });
 it('orders the Wallaroo activity feed and holds SDR while SEO stays on a pass',()=>{
  const wallaroo=snapshot(createFixtureState('wallaroo'));
  const feed=teamActivityFeed(wallaroo);
  expect(feed[0]?.at>=feed[1]?.at).toBe(true);
  expect(feed.some(item=>item.kind==='held'&&item.agentId==='outbound-email-sdr')).toBe(true);
  expect(feed.filter(item=>item.kind==='held')).toHaveLength(1);
  expect(agentFloorStatus(wallaroo,'technical-seo-monitor')).toBe('on_pass');
  expect(agentFloorStatus(wallaroo,'outbound-email-sdr')).toBe('held');
  expect(agentFloorStatus(wallaroo,'linkedin-outreach-assistant')).toBe('completed');
  expect(agentFloorStatus(wallaroo,'outbound-email-sdr',false)).toBe('completed');
  const called=wallaroo.proposals.find(item=>item.reference==='P-2001')!;
  expect(conversationThread(wallaroo,called.opportunityId).map(item=>item.kind)).toEqual(['message_out','message_in','message_out']);
 });
});
