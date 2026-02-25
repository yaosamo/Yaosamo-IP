const els = {
  ip: document.getElementById('ip-address'),
  summary: document.getElementById('ip-summary'),
  snapCountry: document.getElementById('snap-country'),
  snapCity: document.getElementById('snap-city'),
  snapIsp: document.getElementById('snap-isp'),
  snapTimezone: document.getElementById('snap-timezone'),
  snapBrowserTz: document.getElementById('snap-browser-tz'),
  snapViewport: document.getElementById('snap-viewport'),
  networkCount: document.getElementById('network-count'),
  geoCount: document.getElementById('geo-count'),
  browserCount: document.getElementById('browser-count'),
  deviceCount: document.getElementById('device-count'),
  networkRows: document.getElementById('network-rows'),
  geoRows: document.getElementById('geo-rows'),
  browserRows: document.getElementById('browser-rows'),
  deviceRows: document.getElementById('device-rows'),
  rawJson: document.getElementById('raw-json'),
  rowTemplate: document.getElementById('row-template')
};

const state = {
  ipApi: null,
  client: null
};

const FIELD_TOOLTIPS = {
  IP: 'YOUR PUBLIC INTERNET ADDRESS AS SEEN BY THE LOOKUP SERVICE.',
  TYPE: 'IP VERSION / TYPE (SUCH AS IPV4 OR IPV6).',
  ISP: 'YOUR INTERNET SERVICE PROVIDER.',
  ORG: 'ORGANIZATION NAME ASSOCIATED WITH THE IP BLOCK.',
  ASN: 'AUTONOMOUS SYSTEM NUMBER THAT ANNOUNCES THIS IP ROUTE.',
  DOMAIN: 'PRIMARY DOMAIN ASSOCIATED WITH THE NETWORK PROVIDER.',
  HOSTNAME: 'REVERSE DNS HOSTNAME FOR THIS IP (IF AVAILABLE).',
  ROUTEABLE: 'WHETHER THE ADDRESS LOOKS LIKE A PUBLIC ROUTEABLE INTERNET IP.',
  'VPN/PROXY/TOR FLAG': 'DETECTED PRIVACY/RELAY NETWORK FLAGS REPORTED BY THE GEO IP SERVICE.',
  'COUNTRY CODE': 'ISO COUNTRY CODE FOR THE DETECTED LOCATION.',
  REGION: 'STATE / PROVINCE / REGION REPORTED FOR THE IP.',
  POSTAL: 'POSTAL OR ZIP CODE ESTIMATE FOR THE IP GEO LOCATION.',
  'LAT/LON': 'APPROXIMATE GEOLOCATION COORDINATES FOR THE IP.',
  TIMEZONE: 'IANA TIME ZONE ID (FOR EXAMPLE AMERICA/NEW_YORK).',
  'TIMEZONE ABBR': 'SHORT TIME ZONE ABBREVIATION (CAN BE AMBIGUOUS GLOBALLY).',
  'UTC OFFSET': 'CURRENT UTC OFFSET FOR THE DETECTED TIME ZONE.',
  'LOCAL TIME': 'CURRENT LOCAL TIME IN THE DETECTED GEO IP TIME ZONE.',
  DST: 'DAYLIGHT SAVING TIME STATUS IN THE DETECTED TIME ZONE.',
  'COUNTRY FLAG': 'UNICODE / EMOJI FLAG FOR THE DETECTED COUNTRY.',
  'USER AGENT': 'FULL BROWSER USER-AGENT STRING SENT BY THE CLIENT.',
  LANGUAGES: 'PREFERRED BROWSER LANGUAGES IN ORDER.',
  PLATFORM: 'LEGACY BROWSER PLATFORM STRING.',
  MOBILE: 'BEST-EFFORT DETECTION OF MOBILE DEVICE FROM UA / UA-CH.',
  'TOUCH POINTS': 'NUMBER OF SIMULTANEOUS TOUCH CONTACTS SUPPORTED.',
  ONLINE: 'BROWSER ONLINE FLAG (NOT A GUARANTEE OF INTERNET REACHABILITY).',
  'COOKIES ENABLED': 'WHETHER COOKIES ARE ENABLED IN THE BROWSER.',
  'DO NOT TRACK': 'LEGACY DNT PRIVACY PREFERENCE HEADER/SIGNAL.',
  LOCALE: 'BROWSER / SYSTEM LOCALE USED FOR FORMATTERS.',
  'COLOR SCHEME': 'SYSTEM COLOR SCHEME PREFERENCE EXPOSED TO THE BROWSER.',
  'REDUCED MOTION': 'ACCESSIBILITY MOTION PREFERENCE FROM THE OS/BROWSER.',
  'CONNECTION TYPE': 'NETWORK TYPE HINT FROM NAVIGATOR.CONNECTION (WHEN SUPPORTED).',
  'EFFECTIVE TYPE': 'ESTIMATED CONNECTION QUALITY (E.G. 4G, 3G) FROM THE BROWSER.',
  'DOWNLINK MBPS': 'ESTIMATED DOWNLOAD BANDWIDTH (NOT A REAL SPEED TEST).',
  'RTT MS': 'ESTIMATED ROUND-TRIP LATENCY IN MILLISECONDS FROM THE BROWSER.',
  'SAVE DATA': 'USER PREFERENCE TO REDUCE DATA USAGE.',
  'SCREEN PX': 'TOTAL SCREEN RESOLUTION IN CSS PIXELS.',
  'VIEWPORT PX': 'CURRENT BROWSER VIEWPORT SIZE IN CSS PIXELS.',
  'AVAILABLE SCREEN': 'SCREEN AREA AVAILABLE TO THE APP (EXCLUDING SOME OS UI AREAS).',
  'PIXEL RATIO': 'DEVICE PIXEL RATIO (PHYSICAL PIXELS PER CSS PIXEL).',
  'COLOR DEPTH': 'BITS USED TO REPRESENT COLOR ON THE DISPLAY.',
  'HARDWARE CONCURRENCY': 'APPROXIMATE LOGICAL CPU CORE COUNT REPORTED BY THE BROWSER.',
  'DEVICE MEMORY (GB)': 'APPROXIMATE DEVICE MEMORY IN GB (BROWSER HINT, LIMITED SUPPORT).',
  'CPU CLASS': 'LEGACY CPU CLASS STRING (MOSTLY UNSUPPORTED MODERN BROWSERS).',
  'PLATFORM TOKEN': 'PLATFORM TOKEN FROM USER-AGENT CLIENT HINTS (UA-CH) IF AVAILABLE.',
  'UA BRANDS': 'BROWSER BRAND/VERSION TOKENS FROM USER-AGENT CLIENT HINTS.',
  WEBDRIVER: 'TRUE CAN INDICATE AUTOMATION / WEBDRIVER-CONTROLLED BROWSER.',
  'MAX TOUCH POINTS': 'MAXIMUM TOUCH CONTACTS SUPPORTED BY THE DEVICE.',
  'SECURE CONTEXT': 'WHETHER THE PAGE IS RUNNING IN HTTPS/LOCALHOST SECURE CONTEXT.',
  REFERRER: 'PAGE URL THAT REFERRED THE USER HERE (IF ANY).'
};

const SNAPSHOT_TOOLTIPS = {
  'snap-country': 'COUNTRY/REGION ESTIMATE BASED ON YOUR PUBLIC IP ADDRESS.',
  'snap-city': 'CITY / REGION ESTIMATE BASED ON YOUR PUBLIC IP ADDRESS.',
  'snap-isp': 'INTERNET SERVICE PROVIDER NAME FOR YOUR PUBLIC IP.',
  'snap-timezone': 'TIME ZONE INFERRED FROM THE PUBLIC IP GEOLOCATION.',
  'snap-browser-tz': 'TIME ZONE REPORTED DIRECTLY BY YOUR BROWSER / SYSTEM.',
  'snap-viewport': 'CURRENT BROWSER VIEWPORT SIZE IN CSS PIXELS.'
};

init();

async function init() {
  applyStaticTooltips();
  const client = collectClientData();
  state.client = client;
  renderClientSections(client);

  try {
    const ipData = await fetchIpData();
    state.ipApi = ipData;
    renderIpData(ipData, client);
    renderRawJson();
  } catch (error) {
    els.ip.textContent = 'UNAVAILABLE';
    els.summary.textContent = String(error?.message || error || 'IP LOOKUP FAILED').toUpperCase();
    renderRawJson({ error: String(error) });
  }
}

async function fetchIpData() {
  const attempts = [];

  try {
    const res = await fetch('https://ipwho.is/', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`IPWHO.IS HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.success === false) throw new Error(data.message || 'IPWHO.IS FAILED');
    return data;
  } catch (error) {
    attempts.push(String(error?.message || error));
  }

  try {
    const res = await fetch('https://ipapi.co/json/', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`IPAPI.CO HTTP ${res.status}`);
    const data = await res.json();
    if (data?.error) throw new Error(data.reason || data.message || 'IPAPI.CO FAILED');
    return normalizeIpApiCo(data);
  } catch (error) {
    attempts.push(String(error?.message || error));
  }

  throw new Error(`IP LOOKUP FAILED / ${attempts.join(' / ')}`);
}

function normalizeIpApiCo(data) {
  const tzId = data.timezone;
  const utc = formatIpApiUtcOffset(data.utc_offset);

  return {
    ip: data.ip,
    type: data.version ? `IPv${data.version}` : undefined,
    country: data.country_name || data.country,
    country_code: data.country_code,
    region: data.region,
    city: data.city,
    postal: data.postal,
    latitude: numberOrUndefined(data.latitude),
    longitude: numberOrUndefined(data.longitude),
    connection: {
      isp: data.org,
      org: data.org,
      asn: data.asn,
      domain: undefined,
      hostname: undefined
    },
    flag: {
      emoji: countryCodeToFlagEmoji(data.country_code)
    },
    timezone: {
      id: tzId,
      abbr: undefined,
      utc,
      current_time: tzId ? currentTimeForZone(tzId) : undefined,
      is_dst: tzId ? isDstNowInZone(tzId) : undefined
    },
    security: undefined
  };
}

function renderIpData(ipData, client) {
  els.ip.textContent = ipData.ip || 'UNKNOWN';
  els.summary.textContent = compactSummary(ipData, client);
  renderSnapshots(ipData, client);

  renderRows(els.networkRows, [
    ['IP', ipData.ip],
    ['TYPE', ipData.type],
    ['ISP', ipData.connection?.isp],
    ['ORG', ipData.connection?.org],
    ['ASN', ipData.connection?.asn],
    ['DOMAIN', ipData.connection?.domain],
    ['HOSTNAME', ipData.connection?.hostname],
    ['ROUTEABLE', ipData.type === 'IPv4' || ipData.type === 'IPv6' ? 'YES' : 'UNKNOWN'],
    ['VPN/PROXY/TOR FLAG', detectNetworkRiskFlags(ipData)]
  ], els.networkCount);

  renderRows(els.geoRows, [
    ['COUNTRY', ipData.country],
    ['COUNTRY CODE', ipData.country_code],
    ['REGION', ipData.region],
    ['CITY', ipData.city],
    ['POSTAL', ipData.postal],
    ['LAT/LON', formatLatLon(ipData.latitude, ipData.longitude)],
    ['TIMEZONE', ipData.timezone?.id],
    ['TIMEZONE ABBR', ipData.timezone?.abbr],
    ['UTC OFFSET', ipData.timezone?.utc],
    ['LOCAL TIME', ipData.timezone?.current_time],
    ['DST', yesNo(ipData.timezone?.is_dst)],
    ['COUNTRY FLAG', ipData.flag?.emoji || ipData.flag?.unicode]
  ], els.geoCount);
}

function renderClientSections(client) {
  renderSnapshotBrowser(client);

  renderRows(els.browserRows, [
    ['USER AGENT', client.userAgent],
    ['LANGUAGES', client.languages],
    ['PLATFORM', client.platform],
    ['MOBILE', yesNo(client.mobile)],
    ['TOUCH POINTS', client.maxTouchPoints],
    ['ONLINE', yesNo(client.online)],
    ['COOKIES ENABLED', yesNo(client.cookieEnabled)],
    ['DO NOT TRACK', client.doNotTrack],
    ['TIMEZONE', client.timeZone],
    ['LOCALE', client.locale],
    ['COLOR SCHEME', client.prefersColorScheme],
    ['REDUCED MOTION', client.prefersReducedMotion],
    ['CONNECTION TYPE', client.connectionType],
    ['EFFECTIVE TYPE', client.effectiveType],
    ['DOWNLINK MBPS', client.downlink],
    ['RTT MS', client.rtt],
    ['SAVE DATA', yesNo(client.saveData)]
  ], els.browserCount);

  renderRows(els.deviceRows, [
    ['SCREEN PX', `${client.screenWidth} x ${client.screenHeight}`],
    ['VIEWPORT PX', `${client.viewportWidth} x ${client.viewportHeight}`],
    ['AVAILABLE SCREEN', `${client.availWidth} x ${client.availHeight}`],
    ['PIXEL RATIO', client.devicePixelRatio],
    ['COLOR DEPTH', client.colorDepth],
    ['HARDWARE CONCURRENCY', client.hardwareConcurrency],
    ['DEVICE MEMORY (GB)', client.deviceMemory],
    ['CPU CLASS', client.cpuClass],
    ['PLATFORM TOKEN', client.userAgentDataPlatform],
    ['UA BRANDS', client.userAgentBrands],
    ['WEBDRIVER', yesNo(client.webdriver)],
    ['MAX TOUCH POINTS', client.maxTouchPoints],
    ['SECURE CONTEXT', yesNo(window.isSecureContext)],
    ['REFERRER', document.referrer || 'NONE']
  ], els.deviceCount);
}

function renderRawJson(extra = {}) {
  els.rawJson.textContent = JSON.stringify({
    ...extra,
    ipApi: state.ipApi,
    client: state.client
  }, null, 2);
}

function renderRows(container, entries, countEl) {
  container.innerHTML = '';
  const normalizedEntries = entries.filter(([key]) => !!key);
  for (const [key, rawValue] of normalizedEntries) {
    const node = els.rowTemplate.content.firstElementChild.cloneNode(true);
    const keyEl = node.querySelector('.key');
    const valueEl = node.querySelector('.value');
    keyEl.textContent = String(key || 'FIELD').toUpperCase();
    applyFieldTooltip(keyEl, keyEl.textContent);
    const value = normalizeDisplayValue(rawValue);
    valueEl.textContent = value;
    if (value === 'N/A' || value === 'UNKNOWN') valueEl.classList.add('is-empty');
    if (/YES$/.test(value) && /(ONLINE|SECURE|DST|MOBILE|COOKIES|ROUTEABLE)/.test(keyEl.textContent)) valueEl.classList.add('is-accent');
    if (/PROXY|TOR|VPN/.test(keyEl.textContent) && value !== 'NONE DETECTED') valueEl.classList.add('is-warn');
    container.appendChild(node);
  }
  if (countEl) countEl.textContent = `${normalizedEntries.length} FIELDS`;
}

function applyStaticTooltips() {
  for (const [id, text] of Object.entries(SNAPSHOT_TOOLTIPS)) {
    const valueEl = document.getElementById(id);
    if (!valueEl) continue;
    const keyEl = valueEl.closest('.snapshot-card')?.querySelector('.snapshot-key');
    if (keyEl) {
      keyEl.title = text;
      keyEl.setAttribute('aria-label', `${keyEl.textContent}: ${text}`);
    }
  }

}

function applyFieldTooltip(el, key) {
  const text = FIELD_TOOLTIPS[key];
  if (!el || !text) return;
  el.title = text;
  el.setAttribute('aria-label', `${key}: ${text}`);
}

function renderSnapshots(ipData, client) {
  setText(els.snapCountry, ipData.country_code ? `${ipData.flag?.emoji || ''} ${ipData.country_code}`.trim() : ipData.country);
  setText(els.snapCity, [ipData.city, ipData.region].filter(Boolean).join(', '));
  setText(els.snapIsp, ipData.connection?.isp);
  setText(els.snapTimezone, ipData.timezone?.id || ipData.timezone?.abbr);
  setText(els.snapBrowserTz, client.timeZone);
  setText(els.snapViewport, `${client.viewportWidth} x ${client.viewportHeight}`);
}

function renderSnapshotBrowser(client) {
  setText(els.snapBrowserTz, client.timeZone);
  setText(els.snapViewport, `${client.viewportWidth} x ${client.viewportHeight}`);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = normalizeDisplayValue(value);
}

function compactSummary(ipData, client) {
  const parts = [
    ipData.city,
    ipData.region,
    ipData.country_code,
    ipData.connection?.isp,
    client.connectionType || client.effectiveType
  ].filter(Boolean);
  return (parts.join(' / ') || 'NETWORK DETAILS READY').toUpperCase();
}

function detectNetworkRiskFlags(data) {
  const flags = [];
  if (data.security?.proxy) flags.push('PROXY');
  if (data.security?.vpn) flags.push('VPN');
  if (data.security?.tor) flags.push('TOR');
  if (data.security?.relay) flags.push('RELAY');
  return flags.length ? flags.join(', ') : 'NONE DETECTED';
}

function collectClientData() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
  const uaData = nav.userAgentData;

  return {
    userAgent: nav.userAgent,
    languages: Array.isArray(nav.languages) ? nav.languages.join(', ') : nav.language,
    platform: nav.platform,
    mobile: !!uaData?.mobile || /MOBILE|ANDROID|IPHONE|IPAD|IPOD/i.test(nav.userAgent),
    maxTouchPoints: nav.maxTouchPoints ?? 'N/A',
    online: nav.onLine,
    cookieEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack || window.doNotTrack || nav.msDoNotTrack || 'N/A',
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    prefersColorScheme: matchMediaValue('(prefers-color-scheme: dark)', 'DARK', '(prefers-color-scheme: light)', 'LIGHT', 'NO-PREFERENCE'),
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'REDUCE' : 'NO-PREFERENCE',
    connectionType: conn.type || 'N/A',
    effectiveType: conn.effectiveType || 'N/A',
    downlink: conn.downlink ?? 'N/A',
    rtt: conn.rtt ?? 'N/A',
    saveData: conn.saveData ?? 'N/A',
    screenWidth: window.screen?.width ?? 'N/A',
    screenHeight: window.screen?.height ?? 'N/A',
    availWidth: window.screen?.availWidth ?? 'N/A',
    availHeight: window.screen?.availHeight ?? 'N/A',
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    colorDepth: window.screen?.colorDepth ?? 'N/A',
    hardwareConcurrency: nav.hardwareConcurrency ?? 'N/A',
    deviceMemory: nav.deviceMemory ?? 'N/A',
    cpuClass: nav.cpuClass || 'N/A',
    webdriver: nav.webdriver ?? false,
    userAgentDataPlatform: uaData?.platform || 'N/A',
    userAgentBrands: Array.isArray(uaData?.brands) ? uaData.brands.map((b) => `${b.brand} ${b.version}`).join(' | ') : 'N/A'
  };
}

function matchMediaValue(q1, v1, q2, v2, fallback) {
  if (!window.matchMedia) return fallback;
  if (window.matchMedia(q1).matches) return v1;
  if (window.matchMedia(q2).matches) return v2;
  return fallback;
}

function yesNo(value) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  return normalizeDisplayValue(value);
}

function formatLatLon(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return 'N/A';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function numberOrUndefined(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function formatIpApiUtcOffset(value) {
  if (!value && value !== 0) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  if (/^[+-]\d{2}:?\d{2}$/.test(str)) {
    return str.includes(':') ? str : `${str.slice(0, 3)}:${str.slice(3)}`;
  }
  return str;
}

function countryCodeToFlagEmoji(code) {
  if (!code || String(code).length !== 2) return undefined;
  const cc = String(code).toUpperCase();
  const base = 127397;
  try {
    return String.fromCodePoint(...cc.split('').map((char) => base + char.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

function currentTimeForZone(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
  } catch {
    return undefined;
  }
}

function isDstNowInZone(timeZone) {
  try {
    const now = new Date();
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    const nowOffset = zonedOffsetMinutes(now, timeZone);
    const janOffset = zonedOffsetMinutes(jan, timeZone);
    const julOffset = zonedOffsetMinutes(jul, timeZone);
    const baseline = Math.max(janOffset, julOffset);
    return nowOffset < baseline;
  } catch {
    return undefined;
  }
}

function zonedOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

function normalizeDisplayValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).toUpperCase();
}
