#!/usr/bin/env python3
"""Capture explicitly public product paths, never ignored/private/runtime inputs."""
from pathlib import Path
from datetime import datetime, timezone
import argparse, hashlib, json, subprocess

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_ROOTS = {'src','server','tests','tools','processor','docs','migrations','migrations-d1','public','assets','.github','integrations'}
ALLOWED_FILES = {'.dev.vars.example','.env.example','.gitattributes','.gitignore','README.md','PROJECT_MAP.md','index.html','package.json','package-lock.json','tsconfig.json','tsconfig.server.json','vite.config.ts','worker-configuration.d.ts','wrangler.jsonc'}
DENIED_PARTS = {'.aekr','.local','.git','.wrangler','.playwright-cli','node_modules','dist','output','Font','__pycache__'}
MAX_BYTES = 100 * 1024 * 1024

def git(source, *args):
    return subprocess.check_output(['git','-C',str(source),*args])

def eligible(name):
    p = Path(name)
    if any(x in DENIED_PARTS for x in p.parts): return False
    if p.name in {'.dev.vars','.env','credentials.json','secrets.json','auth.json'}: return False
    if p.suffix.lower() in {'.pem','.key','.pfx','.sqlite','.db','.log','.tmp'}: return False
    if p.name.startswith(('.dev.vars.','.env.')) and name not in ALLOWED_FILES: return False
    return name in ALLOWED_FILES or (len(p.parts)>1 and p.parts[0] in ALLOWED_ROOTS)

def paths(source):
    tracked = set(filter(None,git(source,'ls-files','-z').decode().split('\0')))
    others = set(filter(None,git(source,'ls-files','--others','--exclude-standard','-z').decode().split('\0')))
    rejected_tracked = sorted(p for p in tracked if not eligible(p))
    if rejected_tracked: raise SystemExit('Unreviewed tracked paths: '+repr(rejected_tracked))
    return sorted(p for p in tracked|others if eligible(p) and (source/p).is_file()), tracked

def sha(data): return hashlib.sha256(data).hexdigest()
def write(name, value):
    p=ROOT/name; p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('--expected-head',required=True)
    args=parser.parse_args(); source=args.source.resolve()
    head=git(source,'rev-parse','HEAD').decode().strip()
    if head!=args.expected_head: raise SystemExit('Source HEAD drift')
    before=git(source,'status','--porcelain=v1','--untracked-files=all').decode().splitlines()
    selected,tracked=paths(source)
    entries=[]; omitted=[]
    for name in selected:
        original=source/name
        if original.is_symlink(): raise SystemExit('Source symlink requires review: '+name)
        data=original.read_bytes()
        if len(data)>=MAX_BYTES:
            if not name.startswith('public/demo/'): raise SystemExit('Oversize non-demo source: '+name)
            omitted.append({'path':name,'bytes':len(data),'sha256':sha(data),'url':'https://marker.aekr.io/'+name.removeprefix('public/'),'reason':'GitHub 100 MiB file ceiling'})
            continue
        target=ROOT/'source'/name; target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
        try:
            decoded=data.decode('utf-8'); count=None if '\0' in decoded else len(decoded.splitlines())
        except UnicodeDecodeError: count=None
        blob=None
        if name in tracked:
            value=git(source,'ls-files','-s','--',name).decode().split()
            blob=value[1] if value else None
        entries.append({'path':name,'projection':'source/'+name,'tracked':name in tracked,'git_index_blob_sha1':blob,'bytes':len(data),'sha256':sha(data),'checkout_sha256':sha(data),'text_lines':count})
    after=git(source,'status','--porcelain=v1','--untracked-files=all').decode().splitlines()
    if before!=after or git(source,'rev-parse','HEAD').decode().strip()!=head: raise SystemExit('Source changed during capture')
    for row in entries:
        if sha((source/row['path']).read_bytes())!=row['sha256']: raise SystemExit('Source content changed during capture: '+row['path'])
    unexpected=sorted(p.relative_to(ROOT/'source').as_posix() for p in (ROOT/'source').rglob('*') if p.is_file() and p.relative_to(ROOT/'source').as_posix() not in {e['path'] for e in entries})
    if unexpected: raise SystemExit('Stale projected files require explicit review: '+repr(unexpected))
    manifest={'format':'marker-source-snapshot/v2','captured_at_utc':datetime.now(timezone.utc).isoformat(),'source_revision':head,'source_tree_sha1':git(source,'rev-parse','HEAD^{tree}').decode().strip(),'source_branch':git(source,'branch','--show-current').decode().strip(),'source_dirty':before,'tracked_path_count':len(tracked),'projected_path_count':len(entries),'projected_bytes':sum(e['bytes'] for e in entries),'hash_semantics':'SHA-256 describes exact source checkout bytes copied to source/. Source HEAD is the base; source_dirty explicitly qualifies any uncommitted bytes. No private payload was inventoried or hashed. Git may normalize text line endings; verification accepts only exact bytes or the documented LF text equivalent. Binary bytes must match exactly.','paths':entries,'omitted_public_media':omitted,'exclusions':['private governance/evidence/archive payloads (.aekr)','local runtime/business/account stores (.local and credential stores)','real .env/.dev.vars, credentials, secrets and key files','node_modules, build/output/generated processor staging, .git, caches','owner attachments, local Font directory and private inputs','provider credentials and raw auth/session/token hashes from runtime stores'],'included_configuration':'Tracked Wrangler instance/site/client identifiers and contact addresses are configuration, not bearer credentials. Blank .dev.vars.example is a safe template.'}
    write('source-snapshot-manifest.json',manifest)
    media=[{**{k:r[k] for k in ('path','projection','bytes','sha256')},'hosted_url':'https://marker.aekr.io/'+r['path'].removeprefix('public/')} for r in entries if r['path'].startswith('public/demo/')]
    write('inventories/public-media.json',{'format':'marker-public-media/v1','files':media,'omitted':omitted,'claims':'Exact public asset bytes. URLs are navigation, not a fresh hosted readback. Video metadata and captions remain in original source files.'})
    print(json.dumps({'source':head,'projected_paths':len(entries),'bytes':manifest['projected_bytes'],'dirty_paths':len(before),'omitted_media':len(omitted)}))

if __name__=='__main__': main()
