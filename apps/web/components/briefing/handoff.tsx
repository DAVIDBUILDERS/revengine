'use client';
import {briefingFor,briefingNextAction,goals,recommendedTask} from '@david/domain/briefing';
import {onboardingFor} from '@david/domain/onboarding';
import type {ScreenProps} from '../app-shell';
export function BriefingHandoff({state,navigate}:ScreenProps){
 const a=onboardingFor(state).answers,b=briefingFor(state),task=recommendedTask(state,b);
 if(!a.briefing)return null;
 return <section className="card card-body stack" style={{marginBottom:24}} aria-label="Your starting plan"><p className="eyebrow">Your starting plan</p><h2>{task?.title??'Continue your business briefing'}</h2><p>{b.goal==='other'?b.otherGoal:goals.find(g=>g.id===b.goal)?.label}</p><p>{a.company.offers.join(' · ')}{a.company.customers.length?` for ${a.company.customers.join(' · ')}`:''}</p><p className="help">{briefingNextAction(state)}</p><div><button className="btn" onClick={()=>navigate('activation')}>Continue my first task</button></div></section>;
}
