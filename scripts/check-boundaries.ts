import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import ts from 'typescript';

async function files(dir:string):Promise<string[]>{const items=await readdir(dir,{withFileTypes:true});return (await Promise.all(items.filter(i=>!['node_modules','.next','.fixture','out'].includes(i.name)).map(async i=>i.isDirectory()?files(join(dir,i.name)):/\.[cm]?[jt]sx?$/.test(i.name)?[join(dir,i.name)]:[]))).flat();}
const sources=[...await files('apps'),...await files('packages')];
const failures:string[]=[];
for(const file of sources){
  const source=await readFile(file,'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const imports:string[]=[];
  function visit(node:ts.Node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))imports.push(node.arguments[0].text);
    ts.forEachChild(node,visit);
  }visit(ast);
  for(const specifier of imports){
    const target=specifier.startsWith('.')?relative(process.cwd(),resolve(dirname(file),specifier)):specifier;
    if(/provider-writes/.test(target)&&file!=='packages/orchestration/src/action-service.ts'&&!file.startsWith('packages/connectors/src/internal/')&&!file.endsWith('.test.ts'))failures.push(`${file}: raw provider writes outside action service`);
    if(file.startsWith('packages/domain/')&&/next\/|supabase|postgres|connectors|workflow/.test(specifier))failures.push(`${file}: domain imports platform implementation`);
    if(file.startsWith('apps/demo/')&&/packages\/(db|connectors|orchestration|ai)|@david\/(db|connectors|orchestration|ai)|apps\/web/.test(target))failures.push(`${file}: public demo imports operational code`);
    if(file.startsWith('apps/preview/')&&/packages\/(db|connectors|orchestration|ai)|@david\/(db|connectors|orchestration|ai)|apps\/web\/(lib|workflows|app\/api)/.test(target))failures.push(`${file}: browser preview imports operational server code`);
    if(file.startsWith('packages/agents/')&&/connectors|workflow\/api|postgres|supabase/.test(specifier))failures.push(`${file}: agent definition has operational import`);
  }
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`PASS module boundaries: ${sources.length} source files; raw writes restricted to the shared action service.`);
