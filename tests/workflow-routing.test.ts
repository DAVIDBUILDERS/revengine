import {expect,it} from 'vitest';
import {workflowRoute} from '../packages/orchestration/src/workflow-routing';
it('retains exact v1 routing and stops unknown definitions or SDK versions',()=>{
 expect(workflowRoute('proposal-v1','4.8.8')).toBe('proposal');
 expect(workflowRoute('connection-check-v1','4.8.8')).toBe('connection-check');
 expect(()=>workflowRoute('proposal-v2','4.8.8')).toThrow('DEFINITION_UNSUPPORTED');
 expect(()=>workflowRoute('proposal-v1','5.0.0')).toThrow('SDK_VERSION_UNSUPPORTED');
});
