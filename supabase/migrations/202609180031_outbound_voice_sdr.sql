-- Outbound Voice SDR (ElevenLabs). AI Receptionist stays inbound.
begin;
insert into private.agent_catalog(id,mode,implemented,archetypes) values
('outbound-voice-sdr','bounded_autonomous_execution',false,array['b2b_services','home_services','commerce']);
insert into private.agent_required_tools(agent_id,required_tools) values
('outbound-voice-sdr','{"tools":["elevenlabs.call","elevenlabs.agent","elevenlabs.webhooks"],"capabilities":["company.confirmed","calendar.booking_link"],"systems":["calls","calendar"],"prerequisites":["confirmed_company_facts","customer_lead_list","booking_url","managed_elevenlabs_agent"]}');
insert into public.agent_onboarding(workspace_id,agent_id,status,answers,required_tools,missing,revision,updated_at,updated_by)
select a.workspace_id,'outbound-voice-sdr','not_started','{}'::jsonb,t.required_tools,'{}'::text[],0,now(),a.updated_by
 from public.agent_onboarding a
 join private.agent_required_tools t on t.agent_id='outbound-voice-sdr'
 where a.agent_id='account-intelligence'
 on conflict(workspace_id,agent_id) do nothing;
update private.agent_required_tools set required_tools='{"tools":["elevenlabs.agent","calendar.availability","calendar.book"],"capabilities":["engineering.implementation"],"systems":["calls","calendar"],"prerequisites":["missing_engineering_integration"]}'
 where agent_id='ai-receptionist';
update public.agent_onboarding set required_tools=(select required_tools from private.agent_required_tools where agent_id='ai-receptionist')
 where agent_id='ai-receptionist';
commit;
