"use client";
import {useState} from 'react';
import {Conversation} from './briefing/conversation';
import {Onboarding} from './onboarding';
import type {ScreenProps} from './app-shell';
export function PreparedOnboarding(props:ScreenProps){
 const [profile]=useState(()=>typeof window!=='undefined'&&(new URLSearchParams(window.location.search).get('mode')==='profile'||!!props.state.onboarding?.appliedRevision&&!props.state.onboarding.answers.briefing));
 return profile?<Onboarding {...props}/>:<Conversation key={props.state.workspace.id} {...props}/>;
}
