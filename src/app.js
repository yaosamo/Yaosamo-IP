const els = {
  ip: document.getElementById('ip-address'),
  summary: document.getElementById('ip-summary'),
  networkRows: document.getElementById('network-rows'),
  geoRows: document.getElementById('geo-rows'),
  browserRows: document.getElementById('browser-rows'),
  deviceRows: document.getElementById('device-rows'),
  rawJson: document.getElementById('raw-json'),
  rowTemplate: document.getElementById('row-template')
};

init();

async function init() {
  const client = collectClientData();
  renderClientSections(client);

  try {
    const ipData = await fetchIpData();
    renderIpData(ipData, client);
    els.rawJson.textContent = JSON.stringify({ ipApi: ipData, client }, null, 2);
  } catch (error) {
    els.ip.textContent = 'UNAVAILABLE';
    els.summary.textContent = String(error?.message || error || 'IP LOOKUP FAILED').toUpperCase();
    els.rawJson.textContent = JSON.stringify({ error: String(error), client }, null, 2);
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
  ]);

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
  ]);
}

function renderClientSections(client) {
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
  ]);

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
  ]);
}

function renderRows(container, entries) {
  container.innerHTML = '';
  for (const [key, rawValue] of entries) {
    const node = els.rowTemplate.content.firstElementChild.cloneNode(true);
    const keyEl = node.querySelector('.key');
    const valueEl = node.querySelector('.value');
    keyEl.textContent = String(key || 'FIELD').toUpperCase();
    const value = normalizeDisplayValue(rawValue);
    valueEl.textContent = value;
    if (value === 'N/A' || value === 'UNKNOWN') valueEl.classList.add('is-empty');
    if (/YES$/.test(value) && /(ONLINE|SECURE|DST|MOBILE|COOKIES|ROUTEABLE)/.test(keyEl.textContent)) valueEl.classList.add('is-accent');
    if (/PROXY|TOR|VPN/.test(keyEl.textContent) && value !== 'NONE DETECTED') valueEl.classList.add('is-warn');
    container.appendChild(node);
  }
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
