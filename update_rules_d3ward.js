const fs = require('fs');
let rules = JSON.parse(fs.readFileSync('extension/rules.json', 'utf8'));

const testPaths = [
  "*468x60*", "*728x90*", "*300x250*", "*120x600*",
  "*/ads/banner*", "*/ad_banner*", "*/ad/banner*",
  "/bugsnag.js", "/sentry.js", "/analytics.js", "/metrica.js", "/hotjar.js",
  "*/advertisement.png", "*/advertisement.gif", "*/advertisement.jpg",
  "*/banner-ad.gif", "*/banner-ad.jpg", "*/banner-ad.png",
  "*/ad-script.js", "*/ads-script.js", ".swf"
];

let id = rules.length ? Math.max(...rules.map(r => r.id)) + 1 : 1;
const resourceTypes = ["script", "image", "xmlhttprequest", "sub_frame", "media", "object"];

for (const p of testPaths) {
  rules.push({
    id: id++,
    priority: 10,
    action: { type: "block" },
    condition: {
      urlFilter: p,
      resourceTypes
    }
  });
}

fs.writeFileSync('extension/rules.json', JSON.stringify(rules, null, 2));
console.log('Successfully added ' + testPaths.length + ' file filters.');
