// Exact canonical verification of this repository's tested dist/ output.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const domain=process.argv[2],commit=process.argv[3];if(!domain)throw Error('canonical domain and commit required');
const files=[];function walk(path=''){for(const entry of readdirSync(join('dist',path),{withFileTypes:true})){const next=join(path,entry.name);if(entry.isDirectory())walk(next);else if(!['_headers','_redirects','.DS_Store'].includes(entry.name))files.push(next);}}walk();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),results=[];
for(const file of files){const response=await fetch(new URL(file==='index.html'?'':file,domain),{headers:{'Cache-Control':'no-cache'}});const actual=Buffer.from(await response.arrayBuffer()),expected=readFileSync(join('dist',file));results.push({file,status:response.status,bytes:actual.length,sha256:sha(actual),expectedSha256:sha(expected),match:response.ok&&sha(actual)===sha(expected)});}
const receipt={checkedAt:new Date().toISOString(),domain,commit,results};
if(!process.env.READ_ONLY){const output='docs/menu-zoom-review/production';mkdirSync(output,{recursive:true});writeFileSync(join(output,'assets.json'),JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({domain,commit,files:results.length,match:results.filter(r=>r.match).length,failed:results.filter(r=>!r.match)},null,2));if(!results.every(r=>r.match))process.exitCode=1;
