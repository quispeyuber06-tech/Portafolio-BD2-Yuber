import fs from 'node:fs';import path from 'node:path';import {brotliDecompressSync} from 'node:zlib';import {execFileSync} from 'node:child_process';
const root=path.resolve('tests/browser-runtime');fs.mkdirSync(root,{recursive:true});
for(const name of ['chromium','fonts.tar','swiftshader.tar','al2023.tar']){const bytes=brotliDecompressSync(fs.readFileSync(`node_modules/@sparticuz/chromium/bin/${name}.br`));const target=path.join(root,name);fs.writeFileSync(target,bytes);if(name.endsWith('.tar')){execFileSync('tar',['--no-same-owner','-xf',target,'-C',root]);fs.unlinkSync(target);}else fs.chmodSync(target,0o755);}
console.log('Navegador de pruebas preparado.');
