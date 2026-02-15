const fs = require('fs');
const files = ['configuration', 'runtime', 'database', 'authentication'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/errors/' + f + '.json'));
  if (data.length < 5) throw f + ' has < 5 patterns: ' + data.length;
  data.forEach((pat, i) => {
    if (!pat.id || !pat.pattern || !pat.cause || !pat.solution) throw f + '[' + i + '] missing required fields';
    try { new RegExp(pat.pattern); } catch(e) { throw f + '[' + i + '] invalid regex: ' + pat.pattern; }
  });
  total += data.length;
  console.log('  ✓ ' + f + '.json: ' + data.length + ' patterns');
});
if (total < 20) throw 'Total error patterns < 20: ' + total;
console.log('✓ ' + total + ' error patterns validated (all regexes valid)');
