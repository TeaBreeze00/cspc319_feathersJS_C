const fs = require('fs');
const path = require('path');

// Step 32 validation
const files = ['base-project', 'service', 'authentication', 'mongodb', 'postgresql', 'sqlite'];
files.forEach(f => {
  const filePath = path.join('knowledge-base', 'templates', f + '.json');
  const data = JSON.parse(fs.readFileSync(filePath));
  if (!Array.isArray(data) || data.length === 0) throw f + ' is empty or not array';
  data.forEach((frag, i) => {
    if (!frag.id || !frag.name || !frag.code) throw f + '[' + i + '] missing required fields (id, name, code)';
    if (!frag.version) throw f + '[' + i + '] missing version';
  });
  console.log('  ✓ ' + f + '.json: ' + data.length + ' fragments');
});
console.log('✓ 6 template files validated with version tags');

// Version variant check
const bp = JSON.parse(fs.readFileSync('knowledge-base/templates/base-project.json'));
const hasV4 = bp.some(f => f.version === 'v4' || f.version === 'both');
const hasV5 = bp.some(f => f.version === 'v5' || f.version === 'both');
if (!hasV4 || !hasV5) throw 'base-project missing v4 or v5 variants';
console.log('✓ base-project has both v4 and v5 variants');
