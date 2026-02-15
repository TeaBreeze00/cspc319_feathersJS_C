const fs = require('fs');
// Step 33 validation
const files = ['hooks-before', 'hooks-after', 'hooks-error', 'hooks-common'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/snippets/' + f + '.json'));
  if (data.length < 5) throw f + ' has < 5 snippets: ' + data.length;
  data.forEach((snip, i) => {
    if (!snip.id || !snip.code || !snip.version) throw f + '[' + i + '] missing required fields';
  });
  total += data.length;
  console.log('  ✓ ' + f + '.json: ' + data.length + ' snippets');
});
if (total < 20) throw 'Total snippets < 20: ' + total;
console.log('✓ ' + total + ' hook snippets validated across 4 files');
