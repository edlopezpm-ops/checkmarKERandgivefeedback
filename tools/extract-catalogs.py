#!/usr/bin/env python3
"""Read-only captured snapshot catalog and empty SQLite reconstruction.

Usage: python tools/extract-catalogs.py SOURCE_ROOT DOSSIER_ROOT
Uses Python stdlib. Never reads runtime databases or ignored/private files.
"""
from __future__ import annotations
import collections
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import sys

source, output = (Path(x).resolve() for x in sys.argv[1:3])
manifest = json.loads((output/'source-snapshot-manifest.json').read_text(encoding='utf-8'))
PIN = manifest['source_revision']
def write(name: str, value: object) -> None:
    target = output / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
def lines(data: bytes) -> int | None:
    try:
        value = data.decode('utf-8')
        return None if '\x00' in value else len(value.splitlines())
    except UnicodeDecodeError:
        return None
entries = manifest['paths']
for row in entries:
    if digest((source/row['path']).read_bytes()) != row['sha256']:
        raise SystemExit('Snapshot content drift: '+row['path'])
lock = json.loads((source / 'package-lock.json').read_text(encoding='utf-8'))
package = json.loads((source / 'package.json').read_text(encoding='utf-8'))
dependencies = []
for name, spec in sorted(lock.get('packages', {}).items()):
    if not name:
        continue
    dependencies.append({'lock_path': name, 'name': spec.get('name') or name.split('node_modules/')[-1],
                         'version': spec.get('version'), 'dev': spec.get('dev', False),
                         'optional': spec.get('optional', False), 'license': spec.get('license'),
                         'integrity': spec.get('integrity')})
write('inventories/dependencies.json', {'format': 'marker-lock-dependencies/v1',
       'lockfile_version': lock['lockfileVersion'], 'package': {'name': package['name'], 'version': package['version'], 'private': package['private']},
       'declared_dependencies': package.get('dependencies', {}), 'declared_dev_dependencies': package.get('devDependencies', {}),
       'scripts': package.get('scripts', {}), 'count': len(dependencies), 'packages': dependencies,
       'limitations': ['Exact versions describe the snapshot lockfile, not installed/hosted runtime state or a vulnerability assessment.', 'Optional platform variants need not be installed on this host. Registry URLs are intentionally omitted.']})

def sqlite_catalog(statements: list[tuple[str, str]], stem: str) -> dict:
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    migration_refs = []
    for name, sql in statements:
        db.executescript(sql)
        migration_refs.append({'path': name, 'sha256': digest(sql.encode()), 'text_lines': len(sql.splitlines())})
    objects = db.execute("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").fetchall()
    tables = []
    for kind, name, _, ddl in objects:
        if kind != 'table':
            continue
        quote = "'" + name.replace("'", "''") + "'"
        columns = [dict(zip(['cid','name','type','notnull','default','pk','hidden'],row)) for row in db.execute(f'PRAGMA table_xinfo({quote})')]
        foreign_keys = [dict(zip(['id','seq','table','from','to','on_update','on_delete','match'],row)) for row in db.execute(f'PRAGMA foreign_key_list({quote})')]
        indexes = []
        for row in db.execute(f'PRAGMA index_list({quote})'):
            _, iname, unique, origin, partial = row
            iq = "'" + iname.replace("'", "''") + "'"
            index_ddl = db.execute('SELECT sql FROM sqlite_schema WHERE type=? AND name=?', ('index',iname)).fetchone()
            indexes.append({'name': iname, 'unique': bool(unique), 'origin': origin, 'partial': bool(partial),
                'columns': [dict(zip(['seqno','cid','name','desc','coll','key'],r)) for r in db.execute(f'PRAGMA index_xinfo({iq})')],
                'ddl': index_ddl[0] if index_ddl else None})
        tables.append({'name': name, 'ddl': ddl, 'columns': columns, 'foreign_keys': foreign_keys, 'indexes': indexes})
    ddl = '-- Schema only, reconstructed in an empty in-memory SQLite database. No data or INSERT statements.\nPRAGMA foreign_keys=ON;\n\n' + '\n\n'.join(row[3].strip()+';' for row in objects if row[3]) + '\n'
    target = output / 'database' / f'{stem}-schema.sql'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(ddl, encoding='utf-8', newline='\n')
    replay = sqlite3.connect(':memory:'); replay.executescript(ddl)
    recreated = replay.execute("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").fetchall()
    if objects != recreated:
        raise SystemExit('Schema-only replay differs')
    if replay.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or replay.execute('PRAGMA foreign_key_check').fetchall():
        raise SystemExit('Invalid reconstructed schema')
    catalog = {'format': 'marker-sqlite-schema/v1', 'kind': stem, 'sqlite_version': sqlite3.sqlite_version,
        'reconstruction': 'Empty in-memory database only. Schema replay and integrity/foreign-key checks passed. No hosted or runtime database was read.',
        'migrations': migration_refs, 'table_count': len(tables), 'column_count': sum(len(t['columns']) for t in tables),
        'explicit_index_count': sum(1 for r in objects if r[0]=='index'), 'trigger_count': sum(1 for r in objects if r[0]=='trigger'),
        'tables': tables, 'triggers': [{'name':r[1], 'table':r[2], 'ddl':r[3]} for r in objects if r[0]=='trigger'],
        'views': [{'name':r[1], 'ddl':r[3]} for r in objects if r[0]=='view']}
    write(f'database/{stem}-catalog.json', catalog)
    return catalog

d1 = sqlite_catalog([(str(p.relative_to(source)).replace('\\','/'), p.read_text(encoding='utf-8')) for p in sorted((source/'migrations-d1').glob('*.sql'))], 'd1')
local_source = (source/'server/studio-local.ts').read_text(encoding='utf-8')
local = re.search(r'db\.exec\(`(PRAGMA journal_mode=WAL;.*?)`\);', local_source, re.S)
if not local or '${' in local.group(1):
    raise SystemExit('Local schema not a static reviewed template')
local_catalog = sqlite_catalog([('server/studio-local.ts', local.group(1))], 'local-studio')
summary = {'tracked_paths': manifest['tracked_path_count'], 'projected_paths': len(entries), 'source_checkout_bytes': sum(e['bytes'] for e in entries),
           'source_text_paths': sum(e['text_lines'] is not None for e in entries),
           'text_lines': sum(e['text_lines'] or 0 for e in entries),
           'lock_packages':len(dependencies), 'd1_tables':d1['table_count'],'d1_columns':d1['column_count'],
           'd1_explicit_indexes':d1['explicit_index_count'],'d1_triggers':d1['trigger_count'],
           'local_studio_tables':local_catalog['table_count'],'local_studio_columns':local_catalog['column_count']}
write('inventories/catalog-summary.json', summary)
print(json.dumps(summary))
