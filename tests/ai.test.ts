import {describe,it,expect} from 'vitest';
import {assembleDraft,validateReply} from '../packages/ai/src';
describe('bounded model output semantics',()=>{
  const facts=[{id:'scope',text:'The proposal covers the approved workflow assessment.',sourceId:'proposal-v1',confirmed:true}];
  it('can only assemble wording from confirmed facts and reviewed sentences',()=>{const result=assembleDraft({opening:'checking_in',closing:'questions',factIds:['scope']},facts);expect(result.body).toContain(facts[0].text);expect(result.sourceIds).toEqual(['proposal-v1']);expect(()=>assembleDraft({opening:'next_step',closing:'conversation',factIds:['invented discount']},facts)).toThrow('UNSUPPORTED');});
  it('blocks evidence invented by a schema-valid model and requires review for ambiguous replies',()=>{expect(()=>validateReply({classification:'positive',evidenceQuote:'I accept your price',requiresHuman:false},'Maybe later')).toThrow('UNSUPPORTED');expect(()=>validateReply({classification:'ambiguous',evidenceQuote:'Maybe',requiresHuman:false},'Maybe')).toThrow('REVIEW_REQUIRED');});
});
