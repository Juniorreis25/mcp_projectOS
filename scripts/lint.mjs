import {readFileSync,globSync} from 'node:fs';
for(const path of globSync('{packages,tests,scripts}/**/*.{ts,mjs}')) {const data=readFileSync(path,'utf8'); if(data.includes('\t')) throw new Error(`Tab found: ${path}`);}
console.log('Formatting guard passed (tabs absent); full ESLint pending package install');
