import { z } from 'zod';

const Id = z.uuid();
const Utc = z.iso.datetime();

export const OutboundLeadStatus = z.enum(['imported','queued','sent','replied','booked','bounced','unsubscribed','skipped']);
export const OutboundSdrStatus = z.enum(['needs_setup','warming','ready','sending','paused','blocked']);
export const OutboundCrmProvider = z.enum(['none','hubspot']);
export const OutboundCrmStatus = z.enum(['not_connected','needs_access','connected']);
export const OutboundSequenceStep = z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(8000) }).strict();
export const OutboundLead = z.object({
  id: Id,
  workspaceId: Id,
  opportunityId: Id.nullable(),
  email: z.email(),
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  company: z.string().max(300),
  title: z.string().max(200),
  website: z.string().max(500),
  custom: z.record(z.string(), z.string().max(2000)).default({}),
  status: OutboundLeadStatus,
  lastReply: z.string().max(8000).nullable(),
  lastEventAt: Utc.nullable(),
}).strict();
export const OutboundSendingAccount = z.object({
  email: z.string().min(1).max(320),
  warmupReady: z.boolean(),
  health: z.string().max(80),
}).strict();
export const OutboundSdrState = z.object({
  workspaceId: Id,
  bookingUrl: z.union([z.literal(''), z.url()]).nullable(),
  sequence: z.array(OutboundSequenceStep).max(8),
  leads: z.array(OutboundLead).max(2000),
  campaignId: z.string().max(128).nullable(),
  instantlyWorkspaceId: z.string().max(128).nullable(),
  warmupReady: z.boolean(),
  sendingAccounts: z.array(OutboundSendingAccount).max(50),
  status: OutboundSdrStatus,
  crmProvider: OutboundCrmProvider,
  crmStatus: OutboundCrmStatus,
  lastError: z.string().max(1000).nullable(),
}).strict();
export const OutboundEvent = z.object({
  eventType: z.enum(['email_sent','reply_received','auto_reply_received','email_bounced','lead_unsubscribed','lead_meeting_booked']),
  email: z.email(),
  text: z.string().max(8000).optional(),
  providerEventId: z.string().min(1).max(200),
  campaignId: z.string().max(128).optional(),
  occurredAt: Utc.optional(),
}).strict();
export type OutboundLead = z.infer<typeof OutboundLead>;
export type OutboundSdrState = z.infer<typeof OutboundSdrState>;
export type OutboundEvent = z.infer<typeof OutboundEvent>;
export type OutboundSequenceStep = z.infer<typeof OutboundSequenceStep>;
