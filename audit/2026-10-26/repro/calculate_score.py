"""Compute weighted capability decisions; never infer PASS from a test count."""
import json, pathlib, sys
base=pathlib.Path(__file__).resolve().parents[1]
matrix=json.loads((base/'MATRIX.json').read_text(encoding='utf-8'))
frozen=json.loads((base/'contracts/frozen-capabilities.json').read_text(encoding='utf-8'))
caps=matrix['capabilities']
assert len({x['id'] for x in caps})==len(caps)
assert {x['id']:x['weight'] for x in caps}=={x['id']:x['weight'] for x in frozen['capabilities']},'Frozen weights/units changed'
assert all(x['status'] in ('PASS','FAIL','UNKNOWN') for x in caps)
sums={s:sum(x['weight'] for x in caps if x['status']==s) for s in ('PASS','FAIL','UNKNOWN')}
w=sum(x['weight'] for x in caps)
assert w==sum(sums.values())
score={'matrix':'MATRIX.json','frozen_matrix':'contracts/frozen-capabilities.json','W':w,'P':sums['PASS'],'F':sums['FAIL'],'U':sums['UNKNOWN'],'invariant_W_equals_P_plus_F_plus_U':True,'demonstrated_compliance_percent':100*sums['PASS']/w if w else None,'decision_coverage_percent':100*(sums['PASS']+sums['FAIL'])/w if w else None,'confirmed_failure_percent':100*sums['FAIL']/w if w else None,'unknown_percent':100*sums['UNKNOWN']/w if w else None,'counts':{s:sum(x['status']==s for x in caps) for s in sums},'inventory_closed':matrix['inventoryClosed'],'score_status':'FINAL_FOR_DECLARED_INVENTORY' if matrix['inventoryClosed'] else 'PROVISIONAL','policy':'critical=5 important=3 ordinary=1 frozen before outcomes; UNKNOWN remains denominator; no AI-intent, probability or scientific interpretation'}
(base/'SCORECARD.json').write_text(json.dumps(score,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(score,ensure_ascii=False,indent=2))
