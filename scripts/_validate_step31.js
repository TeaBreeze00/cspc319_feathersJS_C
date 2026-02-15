const fs = require('fs');
const files = ['core-concepts', 'services', 'hooks', 'authentication', 'databases'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/docs/' + f + '.json'));
  if (data.length < 10) throw f + ' has < 10 entries: ' + data.length;
  data.forEach((entry, i) => {
    if (!entry.version) throw f + '[' + i + '] missing version';
    if (!entry.tokens || !Array.isArray(entry.tokens)) throw f + '[' + i + '] missing tokens array';
    if (!['v4', 'v5', 'both'].includes(entry.version)) throw f + '[' + i + '] invalid version: ' + entry.version;
  });
  total += data.length;
});
if (total < 50) throw 'Total entries < 50: ' + total;
console.log('✓ ' + total + ' DocEntry objects validated across 5 files');
