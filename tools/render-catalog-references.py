#!/usr/bin/env python3
"""Render navigable Markdown from already extracted structural catalogs."""
import collections
import json
from pathlib import Path
import sys

source, root = (Path(x).resolve() for x in sys.argv[1:3])
def read(p): return json.loads((root/p).read_text(encoding='utf-8'))
def write(p,s):
    target=root/p; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(s.rstrip()+'\n',encoding='utf-8')
def cell(x): return str(x).replace('|','\\|').replace('\n',' ')
def table(headers,rows): return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join('---' for _ in headers)+' |']+['| '+' | '.join(cell(x) for x in r)+' |' for r in rows])
def ref(p,line,end=None): return f'`{p}:L{line}'+(f'-L{end}' if end and end!=line else '')+'`'
def locate(p,needle):
    return next(i for i,s in enumerate((source/p).read_text(encoding='utf-8').splitlines(),1) if needle in s)

manifest=read('source-snapshot-manifest.json')
write('inventories/source-paths.md','# Complete tracked source path inventory\n\nSource revision: `'+manifest['source_revision']+'`. All '+str(manifest['tracked_path_count'])+' paths are listed. SHA-256/bytes below describe Git blob bytes; clean-checkout CRLF differences are separately preserved in the [JSON manifest](../source-snapshot-manifest.json). No file bodies or image pixels are included. Null line counts mean binary.\n\n'+table(['Path','Bytes','Text lines','SHA-256'],[(f"`{r['path']}`",r['bytes'],r['text_lines'],f"`{r['sha256']}`") for r in manifest['paths']]))

deps=read('inventories/dependencies.json')
direct=[]
for kind,key in [('runtime','declared_dependencies'),('development','declared_dev_dependencies')]:
    for name,declared in deps[key].items():
        resolved=next(p['version'] for p in deps['packages'] if p['lock_path']=='node_modules/'+name)
        direct.append((kind,name,declared,resolved))
write('inventories/dependencies.md','# Dependency and command reference\n\nDerived from committed `package.json` and lockfile version '+str(deps['lockfile_version'])+'. Versions describe the frozen lockfile, not hosted installation or an advisory scan. Optional platform variants may not be installed.\n\n## Direct dependencies\n\n'+table(['Class','Package','Declared range','Exact locked version'],direct)+'\n\n## Product commands\n\n'+table(['Script','Command'],[(k,f'`{v}`') for k,v in deps['scripts'].items()])+'\n\nThese commands describe the product. The documentary publication did not run product tests, builds, Wrangler, deployment or provider execution.\n\n## Complete lock inventory\n\n'+table(['Lock path','Exact version','Dev','Optional','License'],[(f"`{p['lock_path']}`",p['version'],p['dev'],p['optional'],p['license']) for p in deps['packages']])+'\n\nIntegrity hashes and machine-readable records: [dependencies.json](dependencies.json). Registry URLs are omitted. No new product dependency was introduced by this dossier.')

tests=read('inventories/test-declarations.json')
counts=collections.Counter(t['path'] for t in tests['declarations'])
write('inventories/test-index.md','# Static test declaration index\n\n'+str(tests['count'])+' syntactic declarations in '+str(len(tests['files']))+' tracked files. Includes `t.test` subtests, so this count is not a top-level test count, an assertion count or a result from execution. Names describe intended checks; their presence alone does not prove behavior.\n\n'+table(['File','Declarations'],[(f'`{p}`',counts[p]) for p in tests['files']])+'\n\n## Every declaration\n\n'+table(['Location','Kind','Declared name'],[(ref(t['path'],t['line'],t['end_line']),f"`{t['kind']}`",t['name']) for t in tests['declarations']])+'\n\nMachine-readable equivalent: [test-declarations.json](test-declarations.json).')

ast=read('inventories/ast-index.json')
totals={'modules':len(ast['modules']),'symbols':sum(len(m['symbols']) for m in ast['modules']),'imports':sum(len(m['imports']) for m in ast['modules']),'calls':sum(len(m['calls']) for m in ast['modules'])}
parts=['# Module and symbol index','',f"The TypeScript {ast['compiler']} parser indexed {totals['modules']} tracked TS/TSX/JS/MJS modules, {totals['symbols']} declaration/field records, {totals['imports']} import/re-export records and {totals['calls']} syntactic call/new-expression sites. Declaration files include generated platform type contracts and dominate raw symbol counts.",'','[Complete AST index](../inventories/ast-index.json) contains every indexed declaration, signature, declared field/type, import and call site with source location. Source function bodies, initializer values and call argument values are excluded. The index does not resolve symbols or execute modules.','', '## All indexed modules','',table(['Module','Symbols/fields','Imports/re-exports','Call/new sites'],[(f"`{m['path']}`",len(m['symbols']),len(m['imports']),len(m['calls'])) for m in ast['modules']]),'','## Product callable and type surface','', 'The compact human reference below lists callable/type declarations in product modules. The JSON also contains local variable and nested field declarations, tests and generated platform typings. `inferred` means the source omits an annotation; no type checker inference is claimed. Optional/default parameters show `?` without publishing the default value. An exported binding is syntactic metadata, not proof of public runtime exposure.','']
for m in ast['modules']:
    if m['path'].startswith('tests/') or m['path'].endswith('.d.ts'): continue
    symbols=[s for s in m['symbols'] if s['kind'] not in ('VariableDeclaration','PropertyDeclaration','PropertySignature','IndexSignature','CallSignature')]
    if not symbols: continue
    parts.extend(['### '+m['path'],'',table(['Location','Scope','Kind','Signature'],[(ref(m['path'],s['line']),f"`{s['scope'] or '<module>'}`",s['kind'],f"`{s.get('signature',s['name']).replace('`','')}`") for s in symbols]),''])
parts.extend(['## Static-analysis limits','','Imports express syntactic dependencies. A call target such as `object.method` is textual and unresolved: aliases, overloads, callbacks, inheritance, dynamic imports and branch guards can change actual execution. Computed targets are placeholders. Anonymous callbacks have no separate stable declaration identity. Scope labels are a syntactic aid and not globally unique symbol IDs. JSX/rendered DOM behavior, network effects, generated code, SQL execution and coverage require separate evidence. No resolved runtime call graph, behavioral completeness or execution result is claimed.'])
write('code-flow/05-module-symbol-index.md','\n'.join(parts))

def schema_md(stem,title):
    catalog=read(f'database/{stem}-catalog.json')
    rows=[]
    for t in catalog['tables']:
        rows.append((f"[{t['name']}](#{t['name']})",len(t['columns']),len(t['foreign_keys']),len(t['indexes'])))
    parts=[f'# {title}','','Schema was reconstructed from tracked static SQL in an empty in-memory SQLite database, then replayed from exported schema-only DDL. No hosted or ordinary local database, account record, media, session or workspace content was read. Migration seed statements run only in memory; the exported SQL contains no rows or INSERTs.','','Source SQL hashes in the JSON catalog refer to the exact SQL input text, while the complete source-file hashes are in the source snapshot manifest.','',''+table(['Table','Columns','Foreign keys','Indexes incl. implicit'],rows),'',f"Tables: {catalog['table_count']}; columns: {catalog['column_count']}; explicit indexes: {catalog['explicit_index_count']}; triggers: {catalog['trigger_count']}. SQLite catalog version: {catalog['sqlite_version']}.",'',f'[Schema-only DDL]({stem}-schema.sql) · [Machine-readable catalog]({stem}-catalog.json)','','## Sources','']
    for m in catalog['migrations']:
        if stem=='local-studio': parts.append('- '+ref(m['path'],106,120)+' — static initialization SQL template.')
        else: parts.append('- '+ref(m['path'],1,m['text_lines']))
    for t in catalog['tables']:
        parts.extend(['','## '+t['name'],'',table(['Column','SQL type','Not null','Default','PK ordinal','Hidden'],[(c['name'],c['type'],bool(c['notnull']),c['default'],c['pk'],c['hidden']) for c in t['columns']]),''])
        if t['foreign_keys']: parts.extend(['Foreign keys:','',table(['From','Referenced table','To','On update','On delete'],[(f['from'],f['table'],f['to'],f['on_update'],f['on_delete']) for f in t['foreign_keys']]),''])
        if t['indexes']: parts.extend(['Indexes:','',table(['Name','Unique','Origin','Partial','Key columns'],[(i['name'],i['unique'],i['origin'],i['partial'],', '.join(str(c['name']) if c['name'] is not None else '<expression/rowid>' for c in i['columns'] if c['key'])) for i in t['indexes']]),''])
        parts.extend(['DDL (including CHECK, UNIQUE and foreign-key constraints):','','```sql',t['ddl']+';','```'])
    parts.extend(['','## Constraint interpretation','','`PRAGMA table_xinfo` reports declared `NOT NULL` independently of primary-key semantics; use the DDL to interpret `INTEGER PRIMARY KEY` and `WITHOUT ROWID`. SQLite implicit primary-key/unique indexes are catalogued where PRAGMA reports them, even when they have no standalone sqlite_schema SQL. Expression/partial indexes retain their exact DDL in the JSON and SQL files. JSON documents have application-level fields beyond these relational columns; see the TypeScript domain and Studio type surfaces. The schema alone does not prove runtime mappings, migrations applied remotely, permissions, retention, timing or data validity.'])
    write(f'database/{stem}-reference.md','\n'.join(parts))
schema_md('d1','Cloudflare D1 structural reference')
schema_md('local-studio','Loopback Studio SQLite structural reference')

def route(method,path,summary,group,needles):
    return {'method':method,'path':path,'summary':summary,'adapter':group,'sources':[{'path':p,'line':locate(p,n)} for p,n in needles]}
H='server/studio-hosted.ts'; L='server/studio-local.ts'; A='server/native-auth.js'
routes=[]
for op in ['request','verify','logout','help']:
    routes.append(route('POST','/api/auth/'+op,{'request':'Owner-only generic code request; challenge cookie and email.','verify':'Single-use code and same-browser challenge; creates opaque session.','logout':'Revokes owner session and clears cookies.','help':'Rate-limited bilingual access instructions with generic response.'}[op],'native hosted auth',[(A,"'/api/auth/"+op+"'")]))
routes.append(route('GET','/api/session','Session status; native owner state or loopback local status.','native hosted + local',[('server/worker.ts',"path === '/api/session'"),('vite.config.ts','req.url === "/api/session"')]))
routes.append(route('GET','/api/workspace','Read legacy editorial aggregate.','native hosted + local',[('server/api.ts','path === "/api/workspace"')]))
routes.append(route('POST','/api/commands','Revision-bound legacy editorial command.','native hosted + local',[('server/api.ts','path !== "/api/commands"')]))
for method,p,summary,needle in [
 ('GET','/api/studio/settings','Settings, actual usage, configured limits and AI disconnected flag.','if(path==="/api/studio/settings"&&method==="GET")'),
 ('POST','/api/studio/settings','Strict settings CAS; active work blocks policy mutation.','if(path==="/api/studio/settings"&&method==="POST")'),
 ('GET','/api/studio','Library/campaign/variant state, jobs, uploads, usage and capabilities.','path === "/api/studio" && method === "GET"'),
 ('POST','/api/studio/plan','Deterministic proposal preview without enqueuing a render.','path === "/api/studio/plan"'),
 ('POST','/api/studio/commands','Studio revision-bound command; trusted proposal recomputation on save.','path === "/api/studio/commands"'),
 ('POST','/api/studio/analyses','Explicit technical analysis admission; hosted unavailable until native version pinned.','path === "/api/studio/analyses" && method === "POST"'),
 ('GET','/api/studio/analyses?assetId={id}','Up to 20 summaries for an asset.','path === "/api/studio/analyses" && method === "GET"'),
 ('GET','/api/studio/analyses/{id}','One analysis record.','const analysisMatch'),
 ('GET','/api/studio/analyses/{id}/thumb-{0..5}.jpg','Completed declared analysis thumbnail.','const analysisMatch'),
 ('POST','/api/studio/uploads','Reserve one resumable upload session.','path === "/api/studio/uploads"'),
 ('GET','/api/studio/uploads/{id}','Read committed upload offset and state.','const uploadMatch'),
 ('PUT','/api/studio/uploads/{id}','Append bounded chunk at exact offset.','const uploadMatch'),
 ('DELETE','/api/studio/uploads/{id}','Cancel upload; preserve failed-release reservations until reconciled.','const uploadMatch'),
 ('POST','/api/studio/uploads/{id}/complete','Probe/hash original, deduplicate and commit metadata.','const uploadMatch'),
 ('GET','/api/studio/assets/{id}','Original bytes; download=1 requests attachment disposition.','const assetMatch'),
 ('GET','/api/studio/jobs/{id}','Job state and immutable receipt when present.','const jobMatch'),
 ('GET','/api/studio/jobs/{id}/video','Completed MP4 preview bytes.','const jobMatch'),
 ('GET','/api/studio/jobs/{id}/cover','Completed cover PNG.','const jobMatch'),
 ('POST','/api/studio/variants/{id}/render','Exact recipe render admission with explicit regeneration semantics.','const variantMatch'),
 ('POST','/api/studio/variants/{id}/approve','Explicit confirmed exact recipe/job approval.','const variantMatch'),
 ('GET','/api/studio/variants/{id}/export','Permission-bound approved TXT or MP4 export.','const variantMatch')]:
    routes.append(route(method,p,summary,'native hosted + local',[(H,needle),(L,needle)]))
for op in ['login','logout']:
    routes.append(route('POST','/api/'+op,'Prepared Supabase compatibility helper; not selected by exported native Worker.','inactive Supabase helper',[('server/worker.ts',f'path === "/api/{op}"')]))
write('inventories/routes.json',json.dumps({'format':'marker-curated-routes/v1','count':len(routes),'routes':routes,'limits':['Exact methods are curated from guards; raw API-literal occurrences include client/test/prefix/rejection mentions.','Brace placeholders represent regex capture groups; they are not source route literals.','Entry reachability, auth, origin, method, ID, revision and capability guards determine actual response.','Compatibility helper routes are not selected by the current Worker entry.']},indent=2)+'\n')
write('inventories/routes.md','# API route reference\n\n'+str(len(routes))+' curated method/path contracts, including two inactive compatibility helper routes. This is a static source contract, not a live endpoint probe. Braced IDs represent regex captures. Captured IDs are validated; optional suffixes and operation alternatives are expanded below. The active Worker entry uses native owner auth and D1. Loopback endpoints are protected by the Vite Host/IP/origin boundary.\n\n'+table(['Method','Path/pattern','Adapter','Behavior','Source'],[(r['method'],f"`{r['path']}`",r['adapter'],r['summary'],'; '.join(ref(s['path'],s['line']) for s in r['sources'])) for r in routes])+'\n\n## Routing limits and guards\n\nThe current hosted entry delegates only `/api/` requests to native API routing; other paths use static assets. Native `/api/auth/*` permits only POST and recognized auth operations. `/api/session` supports GET. All remaining native operations require the configured owner session. Studio requires media and processor bindings, then its own canonical-origin/method checks. Local session interception matches the exact raw request URL and is behind loopback checks; its compatibility code does not add hosted login endpoints.\n\nStudio dynamic route regular expressions capture one slash-free ID and explicit optional suffixes. Supported methods depend on each branch; a prefix or regex match does not grant every method. The global hosted Studio gate admits only GET/POST/PUT/DELETE before branch dispatch. Source regex occurrences and other API literals are available in [route-occurrences.json](route-occurrences.json); their list deliberately includes tests and client calls and must not be counted as supported endpoints. This catalog does not infer dynamic network destinations, CORS behavior or runtime availability.\n\nThe legacy `hostedApi` function in `server/worker.ts` can implement Supabase login/logout/session/editorial access when called with configuration, but the default Worker fetch path calls `nativeApi`. The inactive Supabase helper also handles `/api/session`; its condition does not restrict the method after its same-origin gate. It is retained as preparation, not a second live authentication claim.')
print(json.dumps({'references_rendered':True,'routes':len(routes),**totals}))
