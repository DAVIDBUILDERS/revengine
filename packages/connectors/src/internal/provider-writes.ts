/** The action service is the only allowed importer of this module (enforced by boundary checks). */
import { z } from 'zod';
import { getTransport, GoogleError } from './transport';
import { stableCalendarEventId, stableMessageId, type GoogleConnector } from '../google';

export type GoogleWrite = {type:'send_follow_up';actionId:string;recipient:string;subject:string;body:string;threadId?:string;inReplyTo?:string}|{type:'book_appointment';actionId:string;recipient:string;summary:string;startAt:string;endAt:string;timeZone:string};
export type ProviderWriteResult={providerId:string;status:'provider_accepted'|'confirmed';threadId?:string};
function safeHeader(value:string){if(/[\r\n]/.test(value))throw new GoogleError('invalid_mail_header');return value;}
export async function executeGoogleWrite(connector:GoogleConnector,operation:GoogleWrite):Promise<ProviderWriteResult> {
  z.uuid().parse(operation.actionId);z.email().parse(operation.recipient);
  const transport=getTransport(connector);
  if(operation.type==='send_follow_up'){
    if(operation.threadId&&!connector.binding.enrolledThreadIds.includes(operation.threadId))throw new GoogleError('thread_not_enrolled');
    if(operation.body.length>8000||operation.subject.length>200)throw new GoogleError('mail_exceeds_bounds');
    const headers=[`From: ${safeHeader(transport.identity)}`,`To: ${safeHeader(operation.recipient)}`,`Subject: =?UTF-8?B?${Buffer.from(safeHeader(operation.subject)).toString('base64')}?=`,`Message-ID: ${stableMessageId(operation.actionId)}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64'];
    if(operation.inReplyTo){headers.push(`In-Reply-To: ${safeHeader(operation.inReplyTo)}`,`References: ${safeHeader(operation.inReplyTo)}`);}
    const body=Buffer.from(operation.body).toString('base64').match(/.{1,76}/g)?.join('\r\n')??'';
    const raw=Buffer.from(headers.join('\r\n')+'\r\n\r\n'+body).toString('base64url');
    const response=await transport.request('gmail.send','https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw,...(operation.threadId?{threadId:operation.threadId}:{})})},true);
    const parsed=z.object({id:z.string(),threadId:z.string()}).safeParse(response);if(!parsed.success)throw new GoogleError('write_response_uncertain',200,true);const result=parsed.data;
    return{providerId:result.id,threadId:result.threadId,status:'provider_accepted'};
  }
  if(!connector.binding.calendarId)throw new GoogleError('calendar_not_bound');
  const busy=await connector.freeBusy(operation.startAt,operation.endAt,operation.timeZone);
  if(busy.some(interval=>Date.parse(interval.start)<Date.parse(operation.endAt)&&Date.parse(interval.end)>Date.parse(operation.startAt)))throw new GoogleError('calendar_slot_no_longer_available');
  const event={id:stableCalendarEventId(operation.actionId),summary:operation.summary.slice(0,200),start:{dateTime:operation.startAt,timeZone:operation.timeZone},end:{dateTime:operation.endAt,timeZone:operation.timeZone},attendees:[{email:operation.recipient}],extendedProperties:{private:{davidActionId:operation.actionId}}};
  try {
    const response=await transport.request('calendar.book',`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connector.binding.calendarId)}/events?sendUpdates=all`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)},true);
    const parsed=z.object({id:z.string(),status:z.string()}).safeParse(response);if(!parsed.success)throw new GoogleError('write_response_uncertain',200,true);const result=parsed.data;
    if(result.status!=='confirmed')throw new GoogleError('calendar_confirmation_uncertain',null,true);
    return{providerId:result.id,status:'confirmed'};
  }catch(error){
    if(error instanceof GoogleError&&error.status===409){const existing=await connector.readCalendarEvent(operation.actionId);if(existing?.status==='confirmed'&&existing.actionId===operation.actionId&&existing.attendees?.includes(operation.recipient.toLowerCase())&&existing.start&&Date.parse(existing.start)===Date.parse(operation.startAt)&&existing.end&&Date.parse(existing.end)===Date.parse(operation.endAt))return{providerId:existing.id,status:'confirmed'};throw new GoogleError('calendar_identity_conflict',409,true);}
    throw error;
  }
}
