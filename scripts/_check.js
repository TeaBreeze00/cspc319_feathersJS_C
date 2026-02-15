const fs = require("fs");
const dir = "knowledge-base/docs/";
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith(".json")) return;
  const d = JSON.parse(fs.readFileSync(dir + f));
  const v4 = d.filter(e => e.version === "v4").length;
  const v5 = d.filter(e => e.version === "v5").length;
  console.log(f + ": " + d.length + " total (" + v4 + " v4, " + v5 + " v5)");
});
