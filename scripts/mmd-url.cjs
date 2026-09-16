const fs = require('fs');
const zlib = require('zlib');
const code = fs.readFileSync('docs/COMPLAINT-WORKFLOW.mmd', 'utf8');
const state = JSON.stringify({
  code,
  mermaid: '{"theme":"default"}',
  autoSync: true,
  updateDiagram: true,
});
const def = zlib.deflateSync(Buffer.from(state, 'utf8'));
const b64 = def.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log('pako:' + b64);