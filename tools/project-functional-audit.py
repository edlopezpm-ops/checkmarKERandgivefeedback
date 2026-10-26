#!/usr/bin/env python3
"""Project explicitly selected functional-audit results, never private stores or authority."""
from pathlib import Path
import argparse, hashlib, json, re
from urllib.parse import quote

REVIEW=Path(__file__).resolve().parents[1]
TOP=['REPORT.md','MATRIX.json','SCORECARD.json','FINDINGS.json','PROGRESS.json','PRESERVATION.json','SNAPSHOT.json','root-source-coverage.json','refutation.json']
RECEIPTS=['contracts/frozen-capabilities.json','contracts/result.json','backend/result.json','evaluation/result.json','evaluation/runs.json','evaluation/mutations.json','evaluation/dependencies.json']
PROBES=['calculate_score.py','analytics-ack.mjs','judge_analytics_ack.py','root-contracts.mjs','demo-real-files.mjs','backend-native.mjs','backend-hosted.mts','backend-mcp.mjs','backend-negative.mjs','frontend-independent.mjs','frontend-reproduction.md']
OMIT_KEYS={'authority_read_coverage','auth','auth_route','writes','source_identity','secret_names','root','snapshot_path'}

def digest(data):return hashlib.sha256(data).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--audit-root',required=True,type=Path);p.add_argument('--source',required=True,type=Path);p.add_argument('--date',required=True);p.add_argument('--method',required=True,type=Path);a=p.parse_args()
 audit=a.audit_root.resolve();source=a.source.resolve();target=REVIEW/'audit'/a.date
 if target.exists():raise SystemExit('Dated public audit exists; inspect before overwriting')
 target.mkdir(parents=True)
 original_inventory=json.loads((audit/'INVENTORY.json').read_text(encoding='utf-8'))
 if original_inventory['head']!=json.loads((REVIEW/'source-snapshot-manifest.json').read_text())['source_revision']:raise SystemExit('Audit/source revision mismatch')
 selected=[Path(x) for x in TOP+RECEIPTS]
 selected += [Path('repro')/x for x in PROBES]
 for path in (audit/'evidence').rglob('*'):
  if path.is_file() and path.suffix.lower() in {'.json','.log','.png','.yml','.mp4'} and not path.name.startswith('root-contracts-attempt') and path.name!='evaluation-wrangler-internal.log':
   selected.append(path.relative_to(audit))
 # Evidence selection never traverses sandbox stores, copied code, CLI profiles or bundles.
 audit_variants=[str(audit),str(audit).replace('\\','\\\\'),audit.as_posix(),quote(audit.as_posix(),safe='/:')]
 source_variants=[str(source),str(source).replace('\\','\\\\'),source.as_posix(),quote(source.as_posix(),safe='/:')]
 def normalize(text):
  for prefix in audit_variants:text=text.replace(prefix,'audit/'+a.date)
  for prefix in source_variants:text=text.replace(prefix,'source')
  text=text.replace('.aekr/work/2026-10-26-antihacking-full/','audit/'+a.date+'/').replace('.aekr\\work\\2026-10-26-antihacking-full\\','audit/'+a.date+'/')
  text=re.sub(r'[A-Za-z]:[\\/]+Users[\\/]+[^\s"\'<>\)\]\},]+','[local-execution-path]',text)
  text=re.sub(r'[A-Za-z]:[\\/]+Program Files(?: \([^)]*\))?[\\/]+[^\r\n"\'<>\)\]\},]+','[runtime-executable]',text)
  return text
 def clean_json(value,key=''):
  if isinstance(value,dict):return {k:clean_json(v,k) for k,v in value.items() if k not in OMIT_KEYS}
  if isinstance(value,list):return [clean_json(v,key) for v in value]
  return normalize(value) if isinstance(value,str) else value
 records=[]
 for rel in sorted(set(selected)):
  incoming=audit/rel
  if not incoming.is_file():raise SystemExit('Missing selected audit artifact: '+str(rel))
  data=incoming.read_bytes();kind='exact-public-evidence'
  if incoming.suffix.lower() in {'.json','.log','.md','.py','.mjs','.mts','.yml'}:
   text=data.decode('utf-8')
   if incoming.suffix=='.json':
    value=json.loads(text);value=clean_json(value)
    if rel.as_posix()=='SNAPSHOT.json':value.pop('snapshot',None)
    # Keep unchanged semantic receipts byte-exact whenever no projection is required.
    projected=json.dumps(value,ensure_ascii=False,indent=2)
    if value!=json.loads(text):data=(projected+'\n').encode('utf-8');kind='sanitized-json-projection'
   elif rel.as_posix()=='REPORT.md':
    def mdlink(match):
     dest=match.group(1).strip('<>')
     for prefix in audit_variants:
      if dest.startswith(prefix+'/') or dest.startswith(prefix+'\\'):return ']('+dest[len(prefix)+1:].replace('\\','/')+')'
     for prefix in source_variants:
      if dest.startswith(prefix+'/') or dest.startswith(prefix+'\\'):return '](../../source/'+dest[len(prefix)+1:].replace('\\','/')+')'
     return ']('+dest+')'
    text=re.sub(r'\]\(([^)]+)\)',mdlink,text)
    text=normalize(text)
    text='> Public projection published '+a.date+'. Results describe the original audit, before this repository publication. Local paths and private operational metadata are removed; product findings, uncertainty and scores are preserved. See [PUBLICATION.json](PUBLICATION.json).\n\n'+text
    data=text.encode('utf-8');kind='portable-report-projection'
   else:
    text=normalize(text)
    if rel.parts[0]=='repro':
     text=text.replace('../snapshot/','../../../source/').replace("join(root,'snapshot')","resolve(root,'../../source')").replace("join(root,'snapshot',","join(root,'../../source',").replace("path.join(audit,'snapshot')","path.resolve(audit,'../../source')")
     text=text.replace("const ffmpeg=join(source,'.local','tools','ffmpeg','bin','ffmpeg.exe');","const ffmpeg=process.env.MARKER_FFMPEG ?? 'ffmpeg';")
     text=text.replace("const ffprobe=join(source,'.local','tools','ffmpeg','bin','ffprobe.exe');","const ffprobe=process.env.MARKER_FFPROBE ?? 'ffprobe';")
     text=text.replace("const ffprobe=fileURLToPath(new URL('../../../source/.local/tools/ffmpeg/bin/ffprobe.exe',import.meta.url));","const ffprobe=process.env.MARKER_FFPROBE ?? 'ffprobe';")
    data=text.encode('utf-8');kind='portable-driver-or-text-projection' if data!=incoming.read_bytes() else kind
  dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
  records.append({'path':rel.as_posix(),'projection':kind,'bytes':len(data),'sha256':digest(data)})
 # Public inventory contains only product rows. Do not expose secret-file digests or ignored private metadata.
 for name in ['INVENTORY.json','COVERAGE.json']:
  value=json.loads((audit/name).read_text(encoding='utf-8'));value=clean_json(value)
  value.pop('ignored',None)
  if name=='INVENTORY.json':value.pop('root',None)
  value['public_projection']={'ignored_metadata_omitted':True,'private_credential_file_rows_and_hashes_included':False,'source_projection':'../../source','custody':'Original private audit retains its own inventory. This derivative lists public product only.'}
  data=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode();(target/name).write_bytes(data)
  records.append({'path':name,'projection':'public-product-only-inventory','bytes':len(data),'sha256':digest(data)})
 # Original log hashes describe originals; public manifest hashes bind path-normalized derivatives.
 def rehash(value):
  if isinstance(value,list):return [rehash(x) for x in value]
  if not isinstance(value,dict):return value
  value={k:rehash(v) for k,v in value.items()}
  if isinstance(value.get('log'),str):
   path=target/value['log'].replace('\\','/')
   if path.is_file():
    for key in ['log_sha256','sha256']:
     if key in value:value['original_'+key]=value[key];value[key]=digest(path.read_bytes())
  return value
 for name in ['evaluation/result.json','evaluation/runs.json','evaluation/mutations.json']:
  dest=target/name;value=rehash(json.loads(dest.read_text(encoding='utf-8')));dest.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 (target/'METHOD.md').write_bytes(a.method.read_bytes())
 (target/'README.md').write_text('''# Functional integrity audit — public projection

Read [REPORT.md](REPORT.md), [MATRIX.json](MATRIX.json), [SCORECARD.json](SCORECARD.json), [FINDINGS.json](FINDINGS.json), [refutation.json](refutation.json) and the [original method](METHOD.md).

This package preserves FAIL/UNKNOWN and evidence boundaries. A passing suite is not product acceptance. F01 is the minor confirmed language defect; F02 is specification uncertainty, not a confirmed false success. The full current public product is [source/](../../source/).

Evidence contains only synthetic audit results, selected logs, screenshots and fictional media. Private governance, credential files or digests, owner data, runtime databases, CLI profiles, dependency installations and build bundles are omitted. Local execution paths are normalized. Original hashes retained in JSON refer to original local logs; current derivative hashes are recorded in MANIFEST.json and updated log fields.

For score replay: `python audit/2026-10-26/repro/calculate_score.py` from repository root. Behavioral drivers are portable adaptations and are not rerun during publication. Use a disposable clone/workspace and synthetic stores. Install source dependencies separately, use Node 24+ with type stripping, provide FFmpeg/ffprobe on PATH or through MARKER_FFMPEG and MARKER_FFPROBE, and use a fresh BACKEND_AUDIT_RUN suffix for backend replays. Run `npm run build` inside source/ before frontend-independent.mjs because it inspects the rebuilt source/dist/assets. Native/hosted ledger drivers run in that order because the latter reuses the native synthetic MP4. Browser reproduction requires its own local browser tooling.

The product keeps its own optional Font/.local media prerequisites documented under source/docs. Missing hosted credentials do not authorize production or provider calls. Do not treat an unexecuted portable adaptation as a fresh PASS. All included execution evidence is qualified in the report.
''',encoding='utf-8',newline='\n')
 pub={'schema':'marker-functional-audit-public-projection/v1','date':a.date,'source_revision':original_inventory['head'],'full_product_file_count':len(original_inventory['tracked']),'audit_original_report_sha256':digest((audit/'REPORT.md').read_bytes()),'scores_preserved':{'W':60,'P':34,'F':3,'U':23},'verdict':'FAIL','confirmed_product_defects':1,'test_weaknesses':2,'suspected_ack_status':'SPEC_AMBIGUITY','publication_reruns_product_tests':False,'deployment_performed':False,'normalization':'Only local paths/private authority and credential inventory metadata removed; public drivers adapted to source/ and external media tools. No result changes.','omitted':['Private authority/bootstrap read receipts and agent operational auth metadata','Ignored-file metadata including every real credential-file hash','Runtime SQLite/JSON stores and generated credentials, even when synthetic','Dependency installations, CLI profiles, Worker bundles and copied code','Instrumentation/packaging scripts specific to private audit custody'],'original_audit_preserved_locally':True}
 (target/'PUBLICATION.json').write_text(json.dumps(pub,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 # Bind the final public bytes after path normalization and receipt hash updates.
 final=[]
 for dest in sorted(target.rglob('*')):
  if dest.is_file() and dest.name!='MANIFEST.json':
   data=dest.read_bytes();final.append({'path':dest.relative_to(target).as_posix(),'bytes':len(data),'sha256':digest(data)})
 (target/'MANIFEST.json').write_text(json.dumps({'schema':'marker-functional-audit-public-manifest/v1','source_revision':original_inventory['head'],'files':final},indent=2)+'\n',encoding='utf-8',newline='\n')
 print(json.dumps({'audit_files':len(final)+1,'source_revision':original_inventory['head'],'public_relative_path':target.relative_to(REVIEW).as_posix()}))
if __name__=='__main__':main()
