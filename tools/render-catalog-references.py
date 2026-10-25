#!/usr/bin/env python3
"""Render source-linked references from frozen projection catalogs."""
import collections,json
from pathlib import Path
import sys
source,root=(Path(x).resolve() for x in sys.argv[1:3])
def read(p):return json.loads((root/p).read_text(encoding='utf-8'))
def write(p,s):
    target=root/p;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(s.rstrip()+'\n',encoding='utf-8',newline='\n')
def cell(x):return str(x).replace('|','\\|').replace('\n',' ')
def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join('---' for _ in headers)+' |']+['| '+' | '.join(cell(x) for x in row)+' |' for row in rows])
def ref(p,line=None):return f'[{p}'+(f':{line}' if line else '')+f'](../source/{p}'+(f'#L{line}' if line else '')+')'
m=read('source-snapshot-manifest.json')
write('inventories/source-paths.md','# Complete source projection\n\nBase `'+m['source_revision']+'`; working-tree qualifications are in the [manifest](../source-snapshot-manifest.json). Every listed file is included under source/. Hashes identify exact captured bytes.\n\n'+table(['Source path','Bytes','Text lines','Tracked','SHA-256'],[(ref(r['path']),r['bytes'],r['text_lines'],r['tracked'],r['sha256']) for r in m['paths']]))
deps=read('inventories/dependencies.json');direct=[]
for kind,key in [('runtime','declared_dependencies'),('development','declared_dev_dependencies')]:
    for name,declared in deps[key].items():
        resolved=next(p['version'] for p in deps['packages'] if p['lock_path']=='node_modules/'+name)
        direct.append((kind,name,declared,resolved))
write('inventories/dependencies.md','# Dependencies and commands\n\nExact snapshot lockfile; installation and vulnerability status are separate.\n\n'+table(['Class','Package','Declared','Locked'],direct)+'\n\n## Commands\n\n'+table(['Script','Command'],[(k,'`'+v+'`') for k,v in deps['scripts'].items()])+'\n\n## Complete package inventory\n\n'+table(['Lock path','Version','Dev','Optional','License'],[(p['lock_path'],p['version'],p['dev'],p['optional'],p['license']) for p in deps['packages']])+'\n\n[Machine-readable lock inventory](dependencies.json). Dossier generation did not run these product commands; root verification is separately qualified in [operations](../08-operations-quality-and-limits.md).')
tests=read('inventories/test-declarations.json');counts=collections.Counter(t['path'] for t in tests['declarations'])
write('inventories/test-index.md','# Test declaration index\n\n'+str(tests['count'])+' static declarations across '+str(len(tests['files']))+' files. Includes subtests; this is neither execution count nor code coverage.\n\n'+table(['File','Declarations'],[(ref(p),counts[p]) for p in tests['files']])+'\n\n## Declarations\n\n'+table(['Source','Kind','Declared intent'],[(ref(t['path'],t['line']),t['kind'],t['name']) for t in tests['declarations']]))
ast=read('inventories/ast-index.json');totals={k:sum(len(mod[k]) for mod in ast['modules']) for k in ('symbols','imports','calls')}
parts=['# Module and symbol index','',f"{len(ast['modules'])} parsed modules; {totals['symbols']} declarations/fields, {totals['imports']} imports/re-exports, {totals['calls']} syntactic call sites. Generated Worker declarations dominate raw counts. Full bodies are in source/; this index is navigation, not runtime reachability or type inference.",'',table(['Module','Symbols','Imports','Calls'],[(ref(mod['path']),len(mod['symbols']),len(mod['imports']),len(mod['calls'])) for mod in ast['modules']])]
for mod in ast['modules']:
    if mod['path'].startswith('tests/') or mod['path'].endswith('.d.ts'):continue
    symbols=[s for s in mod['symbols'] if s['kind'] not in ('VariableDeclaration','PropertyDeclaration','PropertySignature','IndexSignature','CallSignature')]
    if symbols:parts+=['','## '+mod['path'],'',table(['Source','Scope','Kind','Signature'],[(ref(mod['path'],s['line']),s['scope'],s['kind'],'`'+s.get('signature',s['name']).replace('`','')+'`') for s in symbols])]
parts+=['','[Complete AST JSON](../inventories/ast-index.json). Aliases, callbacks, dynamic dispatch, SQL and runtime guards need source review. No coverage percentage is inferred.'];write('code-flow/05-module-symbol-index.md','\n'.join(parts))
for stem,title in [('d1','D1 application schema'),('local-studio','Local Studio initialization schema')]:
    c=read('database/'+stem+'-catalog.json')
    parts=['# '+title,'',f"{c['table_count']} tables; {c['column_count']} columns; {c['explicit_index_count']} explicit indexes; {c['trigger_count']} triggers. Applied to an empty in-memory SQLite database and replayed from schema-only DDL. No runtime database or owner records were read. This does not establish remote migration state.",'',f'[SQL]({stem}-schema.sql) · [Catalog]({stem}-catalog.json)','',table(['Table','Columns','Foreign keys','Indexes'],[(t['name'],len(t['columns']),len(t['foreign_keys']),len(t['indexes'])) for t in c['tables']]),'','## Inputs','']
    parts+=['- '+ref(row['path']) for row in c['migrations']]
    for t in c['tables']:
        parts+=['','## '+t['name'],'',table(['Column','Type','Not null','Default','PK'],[(x['name'],x['type'],bool(x['notnull']),x['default'],x['pk']) for x in t['columns']]),'','```sql',t['ddl']+';','```']
        if t['foreign_keys']:parts+=['',table(['From','Table','To','On delete'],[(f['from'],f['table'],f['to'],f['on_delete']) for f in t['foreign_keys']])]
    parts+=['','## Triggers','',table(['Trigger','Table'],[(t['name'],t['table']) for t in c['triggers']]),'','Full trigger/index DDL remains in the linked catalog. Implicit SQLite indexes can have no standalone DDL. JSON fields use domain types. The local-studio catalog covers its constructor only; local Agents/MCP/auth have separate stores and included adapter/migration contracts.']
    write('database/'+stem+'-reference.md','\n'.join(parts))
occ=read('inventories/route-occurrences.json')['occurrences'];server=[r for r in occ if r['path'].startswith('server/') or r['path']=='vite.config.ts']
write('inventories/routes.json',json.dumps({'format':'marker-server-route-index/v2','count':len(server),'kind':'source occurrences, not distinct endpoint or accepted-method count','occurrences':server,'limitations':['Read linked dispatchers for methods, regex alternatives, origins and permissions.','Metadata endpoints and MCP tools are explained in the connector chapter.']},indent=2))
write('inventories/routes.md','# Server route navigation\n\nEach row is a route-related source occurrence, including rejection guards and prefixes. This is not a reachable endpoint count. Read the linked branch for exact methods and validation.\n\n'+table(['Source','Kind','Literal or regex','AST context'],[(ref(r['path'],r['line']),r['kind'],'`'+r['pattern'].replace('`','')+'`',r['parent_kind']) for r in server])+'\n\nAuth, Profile, Studio, Agents and MCP are explained in [backend](../05-backend-api-and-access.md) and [integrations](../07-integrations-and-capability-status.md). This is not a dynamic route resolver or live probe.')
print(json.dumps({'modules':len(ast['modules']),'tests':tests['count'],'server_route_occurrences':len(server),**totals}))
