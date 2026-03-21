const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, 'extension', 'rules', 'rules.json');
const rawData = fs.readFileSync(rulesPath, 'utf8');
const rules = JSON.parse(rawData);

let maxId = 0;
rules.forEach(rule => {
  if (rule.id > maxId) maxId = rule.id;
});

const newFilters = [
  "||browser.sentry-cdn.com",
  "||d2wy8f7a9ursnm.cloudfront.net",
  "||cdn.bugsnag.com",
  "*.swf",
  "*/ads/*.gif",
  "*/ads/*.jpg",
  "*/ads/*.png",
  "*/banner/*.gif",
  "*/banner/*.jpg",
  "*/banner/*.png",
  "*/banner_*.gif",
  "*/ad_*.gif",
  "*/ad_*.png"
];

let nextId = maxId + 1;
newFilters.forEach(filter => {
  rules.push({
    id: nextId++,
    priority: 1,
    action: { type: "block" },
    condition: { urlFilter: filter }
  });
});

fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
console.log(`Added ${newFilters.length} new rules. Total rules: ${rules.length}`);
