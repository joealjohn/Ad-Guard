const fs = require('fs');
let rules = JSON.parse(fs.readFileSync('extension/rules.json', 'utf8'));

const newDomains = [
  "adtago.s3.amazonaws.com", "analyticsengine.s3.amazonaws.com", "analytics.s3.amazonaws.com", "advice-ads.s3.amazonaws.com",
  "adservice.google.com", "media.net", "adcolony.com", "analytics.google.com", "click.googleanalytics.com",
  "google-analytics.com", "mouseflow.com", "luckyorange.com", "luckyorange.net", "hotjar.com", "hotjar.io",
  "freshmarketer.com", "stats.wp.com", "bugsnag.com", "sentry-cdn.com", "getsentry.com", "pixel.facebook.com",
  "an.facebook.com", "ads.linkedin.com", "pointdrive.linkedin.com", "events.reddit.com", "events.redditmedia.com",
  "tiktok.com", "byteoversea.com", "ads-twitter.com", "ads-api.twitter.com", "pinterest.com", "ads.youtube.com",
  "ads.yahoo.com", "analytics.yahoo.com", "geo.yahoo.com", "udcm.yahoo.com", "analytics.query.yahoo.com",
  "partnerads.ysm.yahoo.com", "log.fc.yahoo.com", "gemini.yahoo.com", "adtech.yahooinc.com", "unityads.unity3d.com",
  "appmetrica.yandex.ru", "adfstat.yandex.ru", "metrika.yandex.ru", "adfox.yandex.ru", "offerwall.yandex.net",
  "logser.realme.com", "bdapi-ads.realmemobile.com", "bdapi-in-ads.realmemobile.com", "adsfs.oppomobile.com",
  "adx.ads.oppomobile.com", "ck.ads.oppomobile.com", "data.ads.oppomobile.com", "click.oneplus.cn", "open.oneplus.net",
  "iadsdk.apple.com", "metrics.icloud.com", "metrics.mzstatic.com", "api-adservices.apple.com", "books-analytics-events.apple.com",
  "weather-analytics-events.apple.com", "notes-analytics-events.apple.com", "api.ad.xiaomi.com", "data.mistat.xiaomi.com",
  "data.mistat.india.xiaomi.com", "data.mistat.rus.xiaomi.com", "sdkconfig.ad.xiaomi.com", "sdkconfig.ad.intl.xiaomi.com",
  "tracking.rus.miui.com", "metrics.data.hicloud.com", "metrics2.data.hicloud.com", "grs.hicloud.com", "logservice.hicloud.com",
  "logservice1.hicloud.com", "logbak.hicloud.com", "samsungads.com", "smetrics.samsung.com", "nmetrics.samsung.com",
  "samsung-com.112.2o7.net", "analytics-api.samsunghealthcn.com",
  "g.doubleclick.net", "stats.g.doubleclick.net", "ad.doubleclick.net", "static.doubleclick.net", "m.doubleclick.net", "mediavisor.doubleclick.net",
  "afs.googlesyndication.com"
];

const resourceTypes = ["script", "image", "xmlhttprequest", "sub_frame", "media"];
let id = rules.length ? Math.max(...rules.map(r => r.id)) + 1 : 1;

for (const d of newDomains) {
  rules.push({
    id: id++,
    priority: 10,
    action: { type: "block" },
    condition: {
      urlFilter: `||${d}^`,
      resourceTypes
    }
  });
}

const customUrls = ["/ads.js", "/pagead.js", "/pagead2.googlesyndication.com", "/ads.php", "/ad.js"];
for (const u of customUrls) {
  rules.push({
    id: id++,
    priority: 10,
    action: { type: "block" },
    condition: {
      urlFilter: u,
      resourceTypes
    }
  });
}

fs.writeFileSync('extension/rules.json', JSON.stringify(rules, null, 2));
console.log('Successfully updated rules.json with ' + (newDomains.length + customUrls.length) + ' new rules.');
