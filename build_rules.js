const fs = require('fs');

const newDomains = [
  "aan.amazon.com", "static.criteo.net", "mgid.com", "cdn.mgid.com", "servicer.mgid.com",
  "bingads.microsoft.com", "ads.microsoft.com", "appmetrica.yandex.ru", "init.supersonicads.com",
  "api.fyber.com", "ironSource.mobi", "outcome-ssp.supersonicads.com", "smartyads.com",
  "ad.gt", "eb2.3lift.com", "tlx.3lift.com", "apex.go.sonobi.com", "c.gumgum.com",
  "cdn.kargo.com", "sync.kargo.com", "pangleglobal.com", "doubleverify.com",
  "pixel.adsafeprotected.com", "static.adsafeprotected.com", "fw.adsafeprotected.com",
  "analytics.google.com", "click.googleanalytics.com", "googletagmanager.com",
  "www.googletagmanager.com", "cdn.heapanalytics.com", "api.segment.io", "fingerprintjs.com",
  "fpjs.io", "api.fpjs.io", "cdn.siftscience.com", "permutive.com", "cdn.permutive.com",
  "pippio.com", "id5-sync.com", "bnc.lt", "wzrkt.com", "clevertap-prod.com", "browser.sentry-cdn.com",
  "bam.nr-data.net", "www.coinimp.com", "mineralt.io", "crypto-loot.org", "popcash.net",
  "2giga.link", "statdynamic.com", "pixel.facebook.com", "an.facebook.com", "graph.facebook.com",
  "tr.facebook.com", "graph.instagram.com", "i.instagram.com", "tr.snapchat.com",
  "sc-analytics.appspot.com", "ads-api.x.com", "ads.x.com", "events.reddit.com",
  "events.redditmedia.com", "d.reddit.com", "ads-api.tiktok.com", "analytics.tiktok.com",
  "ads-sg.tiktok.com", "analytics-sg.tiktok.com", "business-api.tiktok.com", "ct.pinterest.com",
  "log.pinterest.com", "trk.pinterest.com", "pixel.quora.com", "ads.vk.com",
  "api-adservices.apple.com", "books-analytics-events.apple.com", "weather-analytics-events.apple.com",
  "notes-analytics-events.apple.com", "xp.apple.com", "bdapi-ads.realmemobile.com",
  "bdapi-in-ads.realmemobile.com", "adsfs.oppomobile.com", "adx.ads.oppomobile.com",
  "data.ads.oppomobile.com", "metrics2.data.hicloud.com", "grs.hicloud.com",
  "logservice.hicloud.com", "logservice1.hicloud.com", "logbak.hicloud.com", "ads.huawei.com",
  "api.ad.xiaomi.com", "data.mistat.india.xiaomi.com", "sdkconfig.ad.xiaomi.com",
  "sdkconfig.ad.intl.xiaomi.com", "tracking.rus.miui.com", "smetrics.samsung.com",
  "samsung-com.112.2o7.net", "config.samsungads.com", "us.info.lgsmartad.com", "ngfts.lge.com",
  "smartclip.net", "settings-win.data.microsoft.com", "device-metrics-us.amazon.com",
  "device-metrics-us-2.amazon.com", "mads-eu.amazon.com", "ads.roku.com", "app-measurement.com",
  "firebase-settings.crashlytics.com", "geolocation.onetrust.com", "consent.cookiebot.com",
  "cookiebot.com", "consent.trustarc.com", "sdk.privacy-center.org", "cdn.privacy-mgmt.com",
  "app.usercentrics.eu", "www.anrdoezrs.net", "www.tkqlhce.com", "click.linksynergy.com",
  "ad.linksynergy.com", "track.linksynergy.com", "d.impactradius-event.com", "api.impact.com",
  "www.awin1.com", "partnerstack.com", "api.partnerstack.com", "s.skimresources.com",
  "t.skimresources.com", "go.skimresources.com", "redirector.skimresources.com", "cdn.viglink.com",
  "cdn.optimizely.com", "logx.optimizely.com", "api.optimizely.com", "cdn.dynamicyield.com",
  "track.hubspot.com", "trackcmp.net", "widget.intercom.io", "js.driftt.com", "imasdk.googleapis.com",
  "dai.google.com", "g.jwpsrv.com", "ssl.p.jwpcdn.com", "mssl.fwmrm.net", "cd.connatix.com",
  "capi.connatix.com", "vid.connatix.com", "metrics.brightcove.com", "s.innovid.com"
];

const rulesPath = 'c:/Projects/AdsBlocker/extension/rules/rules.json';
let rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

let nextId = Math.max(...rules.map(r => r.id)) + 1;

newDomains.forEach(domain => {
  rules.push({
    "id": nextId++,
    "priority": 1,
    "action": { "type": "block" },
    "condition": { "urlFilter": "||" + domain }
  });
});

fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
console.log("Added", newDomains.length, "rules.");
