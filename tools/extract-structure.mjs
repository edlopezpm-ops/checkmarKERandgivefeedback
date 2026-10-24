#!/usr/bin/env node
/** Static documentation extractor. Reads tracked source only; never imports product code. */
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { createRequire } from 'node:module';
const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw new Error('Usage: node tools/extract-structure.mjs SOURCE_ROOT DOSSIER_ROOT');
const source = path.resolve(sourceArg), output = path.resolve(outputArg);
const requireSource = createRequire(path.join(source, 'package.json'));
const ts = requireSource('typescript');
const wranglerResult = ts.parseConfigFileTextToJson('wrangler.jsonc', fs.readFileSync(path.join(source, 'wrangler.jsonc'), 'utf8'));
if (wranglerResult.error) throw new Error('Tracked Wrangler JSONC could not be parsed');
const configuredStrings = new Set();
const collectVars = vars => Object.values(vars ?? {}).forEach(value => { if (typeof value === 'string' && value) configuredStrings.add(value); });
collectVars(wranglerResult.config.vars);
Object.values(wranglerResult.config.env ?? {}).forEach(environment => collectVars(environment.vars));
const instanceValues = [...configuredStrings].sort((a, b) => b.length - a.length);
const files = cp.execFileSync('git', ['ls-files', '-z'], {cwd:source}).toString('utf8').split('\0').filter(Boolean).filter(p=>/\.(?:[cm]?js|tsx?)$/.test(p)).sort();
const forbidden = /(?:[A-Z]:[\\/]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b)/ig;
const clean = s => instanceValues.reduce((value, configured) => value.split(configured).join('[configured-instance-string]'), String(s)).replace(forbidden, '[omitted]').replace(/\s+/g,' ').trim();
const safeType = n => n ? clean(n.getText()) : 'inferred';
const simpleName = n => !n ? '<anonymous>' : ts.isIdentifier(n) || ts.isPrivateIdentifier(n) ? n.text : ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? clean(n.text) : ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n) ? clean(n.getText().replace(/=[^,}\]]+/g, '')) : '<computed>';
const expressionName = n => ts.isIdentifier(n) || n.kind===ts.SyntaxKind.ThisKeyword || n.kind===ts.SyntaxKind.SuperKeyword ? n.getText() : ts.isPropertyAccessExpression(n) ? expressionName(n.expression)+'.'+n.name.text : ts.isElementAccessExpression(n) ? expressionName(n.expression)+'[computed]' : ts.isCallExpression(n) ? expressionName(n.expression)+'(...)' : ts.isNewExpression(n) ? 'new '+expressionName(n.expression) : '<expression>';
const parameters = n => (n.parameters??[]).map(p=>(p.dotDotDotToken?'...':'')+simpleName(p.name)+(p.questionToken||p.initializer?'?':'')+': '+safeType(p.type)).join(', ');
const typeParameters = n => n.typeParameters?.length ? '<'+n.typeParameters.map(t=>simpleName(t.name)+(t.constraint?' extends '+safeType(t.constraint):'')+(t.default?' = '+safeType(t.default):'')).join(', ')+'>' : '';
const signature = (n,name)=>name+typeParameters(n)+'('+parameters(n)+'): '+safeType(n.type);
const modules=[], routeOccurrences=[], testDeclarations=[];
for(const file of files){
  const text=fs.readFileSync(path.join(source,file),'utf8');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('js')?ts.ScriptKind.JS:ts.ScriptKind.TS);
  const location=n=>({line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,end_line:sf.getLineAndCharacterOfPosition(n.getEnd()).line+1});
  const symbols=[],imports=[],calls=[];
  function walk(n,scope=[]){
    let next=scope;
    const name=n.name?simpleName(n.name):'<anonymous>';
    const base={...location(n),scope:scope.join('.'),name,exported:!!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)};
    if(ts.isImportDeclaration(n)) imports.push({...location(n),module:clean(n.moduleSpecifier.text),clause:n.importClause?clean(n.importClause.getText()):'',type_only:!!n.importClause?.isTypeOnly});
    else if(ts.isExportDeclaration(n)) imports.push({...location(n),module:n.moduleSpecifier?clean(n.moduleSpecifier.text):null,clause:n.exportClause?clean(n.exportClause.getText()):'*',re_export:true,type_only:!!n.isTypeOnly});
    if(ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isMethodSignature(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)){
      const nn=ts.isConstructorDeclaration(n)?'constructor':name;
      symbols.push({...base,name:nn,kind:ts.SyntaxKind[n.kind],signature:signature(n,nn)}); next=[...scope,nn];
    }else if(ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)){
      symbols.push({...base,kind:ts.SyntaxKind[n.kind],signature:name+typeParameters(n),heritage:n.heritageClauses?.map(h=>clean(h.getText()))??[]}); next=[...scope,name];
    }else if(ts.isTypeAliasDeclaration(n)) symbols.push({...base,kind:'TypeAliasDeclaration',signature:name+typeParameters(n)+' = '+safeType(n.type)});
    else if(ts.isPropertySignature(n)||ts.isPropertyDeclaration(n)) symbols.push({...base,kind:ts.SyntaxKind[n.kind],signature:name+(n.questionToken?'?':'')+': '+safeType(n.type)});
    else if(ts.isIndexSignatureDeclaration(n)||ts.isCallSignatureDeclaration(n)) symbols.push({...base,kind:ts.SyntaxKind[n.kind],signature:signature(n,ts.isIndexSignatureDeclaration(n)?'[index]':'[call]')});
    else if(ts.isVariableDeclaration(n)){
      const init=n.initializer;
      symbols.push({...base,exported:!!n.parent?.parent?.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword),kind:init&&(ts.isArrowFunction(init)||ts.isFunctionExpression(init))?'FunctionVariable':'VariableDeclaration',signature:init&&(ts.isArrowFunction(init)||ts.isFunctionExpression(init))?signature(init,name):name+': '+safeType(n.type)});
      if(init&&(ts.isArrowFunction(init)||ts.isFunctionExpression(init))) next=[...scope,name];
    }else if(ts.isEnumDeclaration(n)) {symbols.push({...base,kind:'EnumDeclaration',members:n.members.map(m=>simpleName(m.name))});next=[...scope,name];}
    if(ts.isCallExpression(n)||ts.isNewExpression(n)){
      const target=clean(expressionName(n.expression));
      calls.push({...location(n),scope:scope.join('.'),kind:ts.isNewExpression(n)?'new':'call',target,argument_count:n.arguments?.length??0});
      if(file.startsWith('tests/')&&(target==='test'||target==='it'||target==='describe'||/^(?:t|context)\.(?:test|it)$/.test(target))){
        const first=n.arguments?.[0];
        testDeclarations.push({path:file,...location(n),kind:target,name:first&&(ts.isStringLiteral(first)||ts.isNoSubstitutionTemplateLiteral(first))?clean(first.text):'<dynamic test name>'});
      }
    }
    if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&/^\/api(?:\/|$)/.test(n.text))routeOccurrences.push({path:file,...location(n),kind:'literal',pattern:clean(n.text),parent_kind:ts.SyntaxKind[n.parent.kind]});
    if(n.kind===ts.SyntaxKind.RegularExpressionLiteral&&n.getText().includes('api\\/'))routeOccurrences.push({path:file,...location(n),kind:'regular_expression',pattern:clean(n.getText()),parent_kind:ts.SyntaxKind[n.parent.kind]});
    ts.forEachChild(n,c=>walk(c,next));
  }
  walk(sf);
  modules.push({path:file,parse_diagnostics:sf.parseDiagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})),imports,symbols,calls});
}
fs.mkdirSync(path.join(output,'inventories'),{recursive:true});
const write=(file,value)=>fs.writeFileSync(path.join(output,file),JSON.stringify(value,null,2)+'\n');
write('inventories/ast-index.json',{format:'marker-static-ast-index/v1',compiler:ts.version,coverage:'All tracked TS/TSX/JS/MJS including tests and declaration/config files. Syntactic declarations/imports/call sites only; no type resolution or executable bodies.',limitations:['No runtime reachability, resolved call graph, inferred return types, dynamic dispatch or coverage proof.','Initializer values, argument values, function bodies and import execution are excluded.','Type aliases and annotations preserve declarative contract fields and literal unions.','Tracked Wrangler string variable values are replaced with [configured-instance-string]; this marks an omitted configured string, not an actual literal constraint.','Computed call/member names are placeholders; overload declarations remain distinct.'],modules});
write('inventories/route-occurrences.json',{format:'marker-static-route-occurrences/v1',coverage:'API literals and API regular-expression literals across every indexed module; client calls, tests and server dispatch are intentionally distinguished by path and AST parent kind. Prefixes and rejection guards are not separate supported endpoints.',limitations:['This is not an automatic list of reachable routes or accepted methods.','Dynamic suffixes, route constants and regex branch method guards require the curated route reference.'],occurrences:routeOccurrences});
write('inventories/test-declarations.json',{format:'marker-static-tests/v1',coverage:'Syntactic node:test/test/it/describe and t.test declarations; no tests executed.',count:testDeclarations.length,files:[...new Set(testDeclarations.map(t=>t.path))].sort(),declarations:testDeclarations});
console.log(JSON.stringify({files:modules.length,symbols:modules.reduce((n,m)=>n+m.symbols.length,0),imports:modules.reduce((n,m)=>n+m.imports.length,0),calls:modules.reduce((n,m)=>n+m.calls.length,0),routes:routeOccurrences.length,tests:testDeclarations.length,parse_diagnostics:modules.reduce((n,m)=>n+m.parse_diagnostics.length,0)}));
