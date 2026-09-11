import {z} from 'zod';
import {OnboardingAnswers} from './onboarding';
export const SetupDocument=z.object({id:z.uuid(),workspaceId:z.uuid(),name:z.string().trim().min(1).max(200),text:z.string().trim().min(1).max(30000),hash:z.string().min(1).max(64),version:z.number().int().positive(),capturedAt:z.iso.datetime({offset:true}),fixture:z.boolean()}).strict();
export type SetupDocument=z.infer<typeof SetupDocument>;
export const SetupCitation=z.object({field:z.string().max(100),value:z.string().max(2000),sourceId:z.string().max(100),source:z.string().max(2000),quote:z.string().max(2000),basis:z.string().max(500)}).strict();
export type SetupCitation=z.infer<typeof SetupCitation>;
export const PreparedSetup=z.object({
 id:z.uuid(),workspaceId:z.uuid(),generation:z.number().int().positive(),basedOnRevision:z.number().int().nonnegative(),createdAt:z.iso.datetime(),goal:z.enum(['recover','demand','conversion']),fixture:z.boolean(),
 captureId:z.string().nullable(),sourceHash:z.string().nullable(),inputSignature:z.string().max(100000),databaseFingerprint:z.string().max(64).optional(),
 answers:OnboardingAnswers,citations:z.array(SetupCitation).max(80),conflicts:z.array(z.string().max(2000)).max(30),limitations:z.array(z.string().max(2000)).max(30),acceptedRevision:z.number().int().positive().nullable(),
}).strict();
export type PreparedSetup=z.infer<typeof PreparedSetup>;
export const setupCommands=[
 z.object({type:z.literal('save_setup_document'),name:z.string().trim().min(1).max(200),text:z.string().trim().min(1).max(30000)}).strict(),
 z.object({type:z.literal('remove_setup_document'),documentId:z.uuid()}).strict(),
 z.object({type:z.literal('build_setup'),goal:z.enum(['recover','demand','conversion']),expectedRevision:z.number().int().nonnegative(),expectedGeneration:z.number().int().nonnegative()}).strict(),
 z.object({type:z.literal('accept_setup'),generation:z.number().int().positive(),expectedRevision:z.number().int().nonnegative(),answers:OnboardingAnswers}).strict(),
] as const;
