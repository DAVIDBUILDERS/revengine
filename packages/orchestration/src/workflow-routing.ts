/** Unknown versions must never fall through to a different conversation definition. */
export function workflowRoute(definition:string,sdkVersion:string) {
  if(sdkVersion!=='4.8.8')throw new Error('WORKFLOW_SDK_VERSION_UNSUPPORTED');
  if(definition==='proposal-v1')return 'proposal' as const;
  if(definition==='connection-check-v1')return 'connection-check' as const;
  throw new Error('WORKFLOW_DEFINITION_UNSUPPORTED');
}
