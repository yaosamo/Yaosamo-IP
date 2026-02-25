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
  speedCount: document.getElementById('speed-count'),
  networkRows: document.getElementById('network-rows'),
  geoRows: document.getElementById('geo-rows'),
  browserRows: document.getElementById('browser-rows'),
  deviceRows: document.getElementById('device-rows'),
  speedRows: document.getElementById('speed-rows'),
  speedStatus: document.getElementById('speed-status'),
  runSpeedTest: document.getElementById('run-speed-test'),
  rawJson: document.getElementById('raw-json'),
  rowTemplate: document.getElementById('row-template')
};

const state = {
  ipApi: null,
  client: null,
  speedTest: null
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
  REFERRER: 'PAGE URL THAT REFERRED THE USER HERE (IF ANY).',
  'TEST STATUS': 'CURRENT OR LAST SPEED TEST STATUS.',
  'MEASURED PING (MS)': 'MEDIAN LATENCY MEASURED USING MULTIPLE SMALL FETCH REQUESTS.',
  'MEASURED DOWNLOAD (MBPS)': 'ESTIMATED DOWNLOAD THROUGHPUT FROM A TEST FILE FETCH.',
  'TRANSFER BYTES': 'NUMBER OF BYTES DOWNLOADED DURING THE SPEED TEST.',
  'TRANSFER TIME (MS)': 'TIME SPENT DOWNLOADING THE TEST PAYLOAD.',
  'TOTAL TEST TIME (MS)': 'FULL SPEED TEST DURATION INCLUDING LATENCY CHECKS.',
  'EST DOWNLINK (MBPS)': 'BROWSER-REPORTED BANDWIDTH ESTIMATE (NOT MEASURED).',
  'EST RTT (MS)': 'BROWSER-REPORTED LATENCY ESTIMATE (NOT MEASURED).',
  SERVER: 'SERVER USED FOR THE SPEED TEST REQUESTS.',
  'TESTED AT': 'TIMESTAMP WHEN THE LAST SPEED TEST FINISHED.'
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
  renderSpeedPanel(client, null);
  bindSpeedTest();

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
  const res = await fetch('https://ipwho.is/', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`IP API HTTP ${res.status}`);
  const data = await res.json();
  if (data && data.success === false) throw new Error(data.message || 'IP API FAILED');
  return data;
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

function renderSpeedPanel(client, result) {
  const entries = [
    ['TEST STATUS', result?.status || 'READY'],
    ['MEASURED PING (MS)', result?.latencyMs],
    ['MEASURED DOWNLOAD (MBPS)', result?.downloadMbps],
    ['TRANSFER BYTES', result?.bytes],
    ['TRANSFER TIME (MS)', result?.downloadMs],
    ['TOTAL TEST TIME (MS)', result?.totalMs],
    ['EST DOWNLINK (MBPS)', client?.downlink],
    ['EST RTT (MS)', client?.rtt],
    ['EFFECTIVE TYPE', client?.effectiveType],
    ['CONNECTION TYPE', client?.connectionType],
    ['SERVER', result?.server || 'CLOUDFLARE SPEED'],
    ['TESTED AT', result?.testedAt]
  ];

  renderRows(els.speedRows, entries, els.speedCount);
  if (els.speedStatus) {
    els.speedStatus.textContent = normalizeDisplayValue(result?.statusLabel || result?.status || 'READY');
  }
}

function bindSpeedTest() {
  if (!els.runSpeedTest) return;
  els.runSpeedTest.addEventListener('click', async () => {
    if (els.runSpeedTest.disabled) return;
    els.runSpeedTest.disabled = true;
    if (els.speedStatus) els.speedStatus.textContent = 'RUNNING...';
    renderSpeedPanel(state.client, { status: 'RUNNING', statusLabel: 'RUNNING TEST...' });
    try {
      const result = await runSpeedTest();
      state.speedTest = result;
      renderSpeedPanel(state.client, result);
      renderRawJson();
    } catch (error) {
      state.speedTest = {
        status: 'FAILED',
        statusLabel: `TEST FAILED: ${String(error?.message || error)}`,
        error: String(error?.message || error),
        testedAt: new Date().toISOString()
      };
      renderSpeedPanel(state.client, state.speedTest);
      renderRawJson();
    } finally {
      els.runSpeedTest.disabled = false;
    }
  });
}

async function runSpeedTest() {
  const started = performance.now();
  const latencyMs = await measureLatencyMs();
  const download = await measureDownloadMbps();
  const totalMs = Math.round(performance.now() - started);
  return {
    status: 'COMPLETED',
    statusLabel: `DONE / ${formatMbps(download.mbps)} MBPS`,
    latencyMs: round1(latencyMs),
    downloadMbps: formatMbps(download.mbps),
    bytes: download.bytes,
    downloadMs: Math.round(download.ms),
    totalMs,
    server: 'SPEED.CLOUDFLARE.COM',
    testedAt: new Date().toISOString()
  };
}

async function measureLatencyMs() {
  const attempts = [];
  for (let i = 0; i < 3; i += 1) {
    const t0 = performance.now();
    const res = await fetch(`https://www.cloudflare.com/cdn-cgi/trace?ts=${Date.now()}-${i}`, {
      cache: 'no-store',
      mode: 'cors'
    });
    if (!res.ok) throw new Error(`LATENCY HTTP ${res.status}`);
    await res.text();
    attempts.push(performance.now() - t0);
  }
  attempts.sort((a, b) => a - b);
  return attempts[Math.floor(attempts.length / 2)];
}

async function measureDownloadMbps() {
  const bytes = 5_000_000;
  const url = `https://speed.cloudflare.com/__down?bytes=${bytes}&nocache=${Date.now()}`;
  const t0 = performance.now();
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error(`DOWNLOAD HTTP ${res.status}`);
  const blob = await res.blob();
  const ms = performance.now() - t0;
  const measuredBytes = blob.size || bytes;
  const mbps = (measuredBytes * 8) / (ms / 1000) / 1_000_000;
  return { bytes: measuredBytes, ms, mbps };
}

function renderRawJson(extra = {}) {
  els.rawJson.textContent = JSON.stringify({
    ...extra,
    ipApi: state.ipApi,
    client: state.client,
    speedTest: state.speedTest
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

  if (els.runSpeedTest) {
    els.runSpeedTest.title = 'RUNS A LIGHTWEIGHT BROWSER SPEED TEST (PING + DOWNLOAD).';
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

function normalizeDisplayValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).toUpperCase();
}

function round1(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return Math.round(value * 10) / 10;
}

function formatMbps(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1);
}
