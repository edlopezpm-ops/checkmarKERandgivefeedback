import json,pathlib
base=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((base/'evidence/root-analytics-ack.json').read_text(encoding='utf-8'))
positive=next(x for x in data['responses'] if x['ack_response']=={'acknowledged':True})
negative=next(x for x in data['responses'] if x['ack_response']=={'acknowledged':False})
assert positive['observed']['applied_version']==31 and positive['observed']['status']=='active','Positive control invalidates this oracle'
violation=negative['observed']['applied_version']==31 and negative['observed']['status']=='active'
result={'oracle':'Conditional rule: if acknowledged:false means rejection in the central response contract, it cannot establish a confirmed version. This judges serialized outputs outside the product runner.','contract_status':'SPEC_AMBIGUITY','product_defect_confirmed':False,'positive_control':'PASS','negative_dependency_reply':{'acknowledged':False},'observed_status':negative['observed']['status'],'observed_applied_version':negative['observed']['applied_version'],'conditional_violation_reproduced':violation,'limits':['Injected service response, not a real central failure observed','The formal central ACK response schema and false-value semantics are unavailable, so this oracle cannot confirm a product defect','Empty or version-shaped responses are not used as confirmed counterexamples because their exact response schema is undocumented']}
(base/'evidence/root-analytics-ack-judgment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert violation,'Counterexample no longer reproduces; review new snapshot'
