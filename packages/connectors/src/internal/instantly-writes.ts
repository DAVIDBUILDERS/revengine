/** The action service is the only allowed importer of this module (enforced by boundary checks). */
import { createInstantlyClient, InstantlyError, requireInstantlySubWorkspace, type InstantlyCampaignInput, type InstantlyLeadInput } from '../instantly';

export type InstantlyWrite =
  | { type: 'launch_campaign'; campaign: InstantlyCampaignInput; leads: InstantlyLeadInput[] }
  | { type: 'pause_campaign'; campaignId: string }
  | { type: 'resume_campaign'; campaignId: string };

export async function executeInstantlyWrite(apiKey: string, asWorkspace: string, operation: InstantlyWrite, fetchImpl?: typeof fetch) {
  const client = createInstantlyClient({ apiKey, asWorkspace: requireInstantlySubWorkspace(asWorkspace), fetch: fetchImpl });
  if (operation.type === 'pause_campaign') {
    await client.pauseCampaign(operation.campaignId);
    return { campaignId: operation.campaignId, status: 'paused' as const };
  }
  if (operation.type === 'resume_campaign') {
    await client.activateCampaign(operation.campaignId);
    return { campaignId: operation.campaignId, status: 'sending' as const };
  }
  const created = await client.createCampaign(operation.campaign) as { id?: string };
  const campaignId = created.id;
  if (!campaignId) throw new InstantlyError('campaign_id_missing', 'Instantly did not return a campaign id.', 200, true);
  for (let index = 0; index < operation.leads.length; index += 1000) {
    await client.addLeads(campaignId, operation.leads.slice(index, index + 1000));
  }
  await client.activateCampaign(campaignId);
  return { campaignId, status: 'sending' as const };
}
