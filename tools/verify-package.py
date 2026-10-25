#!/usr/bin/env python3
"""Verify full projection, safe boundaries, navigation and package content roots."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,json,re,subprocess
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[1]
EXCLUDED={'PACKAGE-MANIFEST.json','PACKAGE-VERIFICATION.json','SHA256SUMS.txt'}
PRIVATE={'.git','.review-work','__pycache__','node_modules','dist','output','.local','.wrangler','.aekr','.playwright-cli'}
def sha(b):return hashlib.sha256(b).hexdigest()
def filehash(p):return sha(p.read_bytes())
def text_lf(b):
    try:
        s=b.decode('utf-8');return None if '\0' in s else sha(s.replace('\r\n','\n').encode())
    except UnicodeDecodeError:return None
def files():return sorted(p for p in ROOT.rglob('*') if p.is_file() and not any(v in PRIVATE for v in p.relative_to(ROOT).parts) and p.suffix!='.pyc')
def write(name,value):(ROOT/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
def git(source,*args):return subprocess.check_output(['git','-C',str(source),*args])
def main():
    a=argparse.ArgumentParser();a.add_argument('--source',type=Path);a.add_argument('--seal',action='store_true');a.add_argument('--index',action='store_true');args=a.parse_args()
    errors=[];snapshot=json.loads((ROOT/'source-snapshot-manifest.json').read_text(encoding='utf-8'));expected={r['path']:r for r in snapshot['paths']}
    source_paths=list((ROOT/'source').rglob('*'))
    for p in source_paths:
        if any(x in PRIVATE for x in p.relative_to(ROOT/'source').parts):errors.append('private/generated projection path: '+p.relative_to(ROOT).as_posix())
    actual={p.relative_to(ROOT/'source').as_posix() for p in source_paths if p.is_file() and not any(x in PRIVATE for x in p.relative_to(ROOT/'source').parts)}
    if actual!=set(expected):errors.append('projection path set mismatch')
    lf_equivalent=[]
    for name,row in expected.items():
        p=ROOT/'source'/name
        if not p.is_file():continue
        b=p.read_bytes()
        if sha(b)!=row['sha256']:
            try:blob=git(ROOT,'show','HEAD:source/'+name)
            except subprocess.CalledProcessError:blob=b''
            blob_lf,checkout_lf=text_lf(blob),text_lf(b)
            if sha(blob)!=row['sha256'] or blob_lf is None or checkout_lf is None or blob_lf!=checkout_lf:errors.append('projection bytes differ: '+name)
            else:lf_equivalent.append(name)
        if args.source and filehash(args.source/name)!=row['sha256']:errors.append('source bytes differ: '+name)
        if args.index:
            try:blob=git(ROOT,'show',':source/'+name)
            except subprocess.CalledProcessError:blob=b''
            if sha(blob)!=row['sha256']:errors.append('staged source bytes differ: '+name)
    if args.source:
        if git(args.source,'rev-parse','HEAD').decode().strip()!=snapshot['source_revision']:errors.append('source HEAD drift')
        dirty=git(args.source,'status','--porcelain=v1','--untracked-files=all').decode().splitlines()
        if dirty!=snapshot['source_dirty']:errors.append('source dirty inventory drift')
        import importlib.util
        spec=importlib.util.spec_from_file_location('snapshot_source',ROOT/'tools/snapshot-source.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        eligible,_=module.paths(args.source)
        if set(eligible)!=set(expected)|{r['path'] for r in snapshot['omitted_public_media']}:errors.append('source completeness drift')
    paths=files();links=0;scanned=0
    sensitive=re.compile(r'(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
    for p in paths:
        name=p.relative_to(ROOT).as_posix()
        if p.stat().st_size>=100*1024*1024:errors.append('GitHub oversize file: '+name)
        if p.name in {'.env','.dev.vars','credentials.json','secrets.json','auth.json'} or p.suffix.lower() in {'.pem','.key','.pfx','.sqlite','.db'}:errors.append('forbidden payload: '+name)
        try:s=p.read_text(encoding='utf-8')
        except UnicodeDecodeError:continue
        if '\0' in s:continue
        scanned+=1
        if sensitive.search(s):errors.append('credential-shaped text requires review: '+name)
        if '\ufffd' in s and not name.startswith('source/'):errors.append('replacement character: '+name)
        if p.suffix=='.md' and not name.startswith('source/'):
            for target in re.findall(r'\[[^\]\n]*\]\(([^)\s]+)\)',s):
                if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',target):continue
                raw_local,_,fragment=target.partition('#');local=unquote(raw_local);resolved=(p.parent/local).resolve() if local else p.resolve();links+=1
                pending=args.seal and resolved.parent==ROOT and resolved.name in EXCLUDED
                if not resolved.is_relative_to(ROOT) or (not resolved.exists() and not pending):errors.append('broken/escaping link: '+name+': '+target)
                if fragment.startswith('L') and resolved.is_relative_to(ROOT/'source'):
                    match=re.fullmatch(r'L(\d+)(?:-L?(\d+))?',fragment)
                    row=expected.get(resolved.relative_to(ROOT/'source').as_posix())
                    if not match or not row or row['text_lines'] is None or not 1<=int(match[1])<=int(match[2] or match[1])<=row['text_lines']:errors.append('invalid source line link: '+name+': '+target)
    if (ROOT/'marKER-FULL-DOSSIER.md').read_bytes()!=(ROOT/'marKER-FULL-DOSSIER-2026-10-24.md').read_bytes():errors.append('combined dossier copies differ')
    entries=[]
    for p in paths:
        if p.name in EXCLUDED and p.parent==ROOT:continue
        b=p.read_bytes();entries.append({'path':p.relative_to(ROOT).as_posix(),'bytes':len(b),'sha256':sha(b),'lf_text_sha256':text_lf(b)})
    manifest={'format':'marker-review-package/v2','source_revision':snapshot['source_revision'],'exclusions':sorted(EXCLUDED),'files':entries}
    checks={'projection_files':len(expected),'source_live_comparison':bool(args.source),'staged_source_comparison':bool(args.index),'source_byte_equality':'PASS' if not errors else 'FAIL','local_links_checked':links,'text_files_pattern_scanned':scanned,'payload_files':len(entries),'git_checkout_lf_equivalents':lf_equivalent}
    if args.seal and not errors:
        write('PACKAGE-MANIFEST.json',manifest)
        (ROOT/'SHA256SUMS.txt').write_text(''.join(f"{r['sha256']}  {r['path']}\n" for r in entries),encoding='utf-8',newline='\n')
        write('PACKAGE-VERIFICATION.json',{'format':'marker-review-verification/v2','checked_at_utc':datetime.now(timezone.utc).isoformat(),'source_revision':snapshot['source_revision'],'checks':checks,'package_manifest_sha256':filehash(ROOT/'PACKAGE-MANIFEST.json'),'sha256sums_sha256':filehash(ROOT/'SHA256SUMS.txt'),'limitations':['Pattern/boundary checks are not exhaustive secret detection or security certification.','Static AST and empty schema reconstruction do not prove runtime behavior.','Root product-test evidence is separately qualified in CURRENT-STATE.json.','Shared host; no OS isolation or final human product acceptance implied.'],'errors':[]})
    elif not args.seal:
        saved=json.loads((ROOT/'PACKAGE-MANIFEST.json').read_text(encoding='utf-8'));prior={r['path']:r for r in saved['files']}
        if set(prior)!={r['path'] for r in entries}:errors.append('payload manifest path mismatch')
        for row in entries:
            old=prior.get(row['path'])
            if old and old['sha256']!=row['sha256'] and (not old.get('lf_text_sha256') or old['lf_text_sha256']!=row['lf_text_sha256']):errors.append('payload changed: '+row['path'])
        receipt=json.loads((ROOT/'PACKAGE-VERIFICATION.json').read_text(encoding='utf-8'))
        for field,name in [('package_manifest_sha256','PACKAGE-MANIFEST.json'),('sha256sums_sha256','SHA256SUMS.txt')]:
            if receipt[field]!=filehash(ROOT/name):errors.append('receipt root mismatch: '+name)
    print(json.dumps({'result':'FAIL' if errors else 'PASS','checks':checks,'errors':sorted(set(errors))},indent=2));raise SystemExit(bool(errors))
if __name__=='__main__':main()
