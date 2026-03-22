const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, 'extension', 'rules', 'rules.json');
const rawData = fs.readFileSync(rulesPath, 'utf8');
const rules = JSON.parse(rawData);

rules.forEach(rule => {
  if (rule.action && rule.action.type === 'block') {
    if (!rule.condition.excludedInitiatorDomains) {
      rule.condition.excludedInitiatorDomains = [];
    }
    if (!rule.condition.excludedInitiatorDomains.includes('youtube.com')) {
      rule.condition.excludedInitiatorDomains.push('youtube.com');
    }
  }
});

fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
console.log(`Successfully injected youtube.com into the excludedInitiatorDomains array for all ${rules.length} network rules.`);
