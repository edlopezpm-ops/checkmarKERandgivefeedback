import { analyticsApi } from '../../../source/server/analytics.ts';
import { writeFileSync } from 'node:fs';
const time=Date.now(),origin='https://marker.aekr.io',responses=[];
const config={schema_version:1,source_id:'marker-owner-production',product:'marker',environment:'production',version:31,issued_at:new Date(time).toISOString(),expires_at:new Date(time+240000).toISOString(),enabled:true,events:['commercial_interest_selected'],fields:['category'],purposes:['onsite_personalized_ads'],retention_days:7,destinations:[],restriction_reason:null};
for(const ack of [{acknowledged:true},{acknowledged:false},{acknowledged:true,source_configuration_version:30},{}]){
 const calls=[];
 const result=await analyticsApi(new Request(origin+'/api/analytics'),{userId:'synthetic-user',tenantId:'synthetic-tenant'},{token:'synthetic_test_only_token_0123456789012345',subjectSecret:'synthetic_test_only_secret_01234567890',now:()=>time,async fetcher(url,init){calls.push({path:new URL(url).pathname,method:init.method});return Response.json(String(url).includes('/config?')?config:ack);}});
 responses.push({ack_response:ack,status:result.status,observed:await result.json(),calls});
}
const evidence={scope:'dependency fault injection, explicit synthetic transport, no central service accessed',contract:'docs/analytics-integration.md lines43+ POST ack confirms locally applied version; failed acknowledgement must stay unconfirmed',result:'CANDIDATE_REQUIRES_CONTRACT_REFUTATION',responses};
writeFileSync(new URL('../evidence/root-analytics-ack.json',import.meta.url),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
