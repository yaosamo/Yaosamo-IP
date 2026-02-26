import {
  ASCII_REVEAL_CHARS,
  ASCII_TUNING_STORAGE_KEY,
  DEFAULT_ASCII_TUNING,
  FIELD_TOOLTIPS,
  SNAPSHOT_TOOLTIPS
} from './app-constants.js';
import { fetchIpData, fetchPublicIpOnly, normalizeIpOnly } from './ip-services.js';

const els = {
  heroKicker: document.getElementById('hero-kicker'),
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
  runSpeedTest: document.getElementById('run-speed-test'),
  ctrlReplayAll: document.getElementById('ctrl-replay-all'),
  ctrlResetAscii: document.getElementById('ctrl-reset-ascii'),
  ctrlBaseMs: document.getElementById('ctrl-base-ms'),
  ctrlBaseMsValue: document.getElementById('ctrl-base-ms-value'),
  ctrlCharMs: document.getElementById('ctrl-char-ms'),
  ctrlCharMsValue: document.getElementById('ctrl-char-ms-value'),
  ctrlMinMs: document.getElementById('ctrl-min-ms'),
  ctrlMinMsValue: document.getElementById('ctrl-min-ms-value'),
  ctrlMaxMs: document.getElementById('ctrl-max-ms'),
  ctrlMaxMsValue: document.getElementById('ctrl-max-ms-value'),
  ctrlHoverCooldown: document.getElementById('ctrl-hover-cooldown'),
  ctrlHoverCooldownValue: document.getElementById('ctrl-hover-cooldown-value'),
  ctrlAsciiChars: document.getElementById('ctrl-ascii-chars'),
  ctrlAsciiSample: document.getElementById('ctrl-ascii-sample'),
  panelAsciiControlsTest: document.getElementById('panel-ascii-controls-test'),
  rawJson: document.getElementById('raw-json'),
  rowTemplate: document.getElementById('row-template')
};

const state = {
  ipApi: null,
  client: null,
  speedTest: null,
  asciiFx: { ...DEFAULT_ASCII_TUNING }
};

const ASCII_TUNING_DEFAULTS = DEFAULT_ASCII_TUNING;
const asciiRevealTokens = new WeakMap();
const asciiCharHoverTokens = new WeakMap();
const asciiCharHoverActive = new WeakSet();

init();

async function init() {
  loadAsciiTuningFromStorage();
  applyStaticTooltips();
  bindAsciiControlsVisibilityToggle();
  bindAsciiTestControls();
  primeAsciiStaticTexts();
  bindAsciiHoverReplay();
  bindIpAutofit();
  const client = collectClientData();
  state.client = client;
  renderHeroCopy(client);
  renderClientSections(client);
  renderSpeedPanel(client, null);
  bindSpeedTest();
  let seededIp = null;
  const ipSeedTask = fetchPublicIpOnly()
    .then((ip) => {
      if (!ip) return null;
      seededIp = ip;
      setAsciiText(els.ip, ip, { onFrame: fitIpHeading, onDone: fitIpHeading });
      return ip;
    })
    .catch(() => null);

  try {
    const ipData = await fetchIpData();
    state.ipApi = ipData;
    renderIpData(ipData, client);
    renderRawJson();
  } catch (error) {
    await ipSeedTask;
    if (seededIp) {
      const ipOnly = normalizeIpOnly(seededIp);
      state.ipApi = ipOnly;
      renderIpData(ipOnly, client);
      setAsciiText(els.summary, "I could read your IP, but the location provider didn't return full details.");
    } else {
      setAsciiText(els.ip, 'UNAVAILABLE', { onFrame: fitIpHeading, onDone: fitIpHeading });
      setAsciiText(els.summary, "I couldn't read your public IP details right now.");
    }
    renderRawJson({ error: String(error) });
  }
}

function loadAsciiTuningFromStorage() {
  try {
    const raw = window.localStorage?.getItem(ASCII_TUNING_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    const next = { ...state.asciiFx };
    const numericKeys = ['baseMs', 'charMs', 'minMs', 'maxMs', 'hoverCooldownMs'];
    for (const key of numericKeys) {
      const n = Number(parsed[key]);
      if (Number.isFinite(n)) next[key] = n;
    }
    if (typeof parsed.chars === 'string' && parsed.chars.length) {
      next.chars = parsed.chars;
    }

    state.asciiFx = next;
    normalizeAsciiTuningRanges();
  } catch {
    // Ignore malformed local data.
  }
}

function saveAsciiTuningToStorage() {
  try {
    window.localStorage?.setItem(ASCII_TUNING_STORAGE_KEY, JSON.stringify(state.asciiFx));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

function bindAsciiControlsVisibilityToggle() {
  window.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    if (key !== 'k') return;
    if (!(event.metaKey || event.ctrlKey)) return;

    event.preventDefault();
    const panel = els.panelAsciiControlsTest;
    if (!panel) return;
    panel.classList.toggle('is-test-hidden');
  });
}

function renderIpData(ipData, client) {
  setAsciiText(els.ip, ipData.ip || 'UNKNOWN', { onFrame: fitIpHeading, onDone: fitIpHeading });
  setAsciiText(els.summary, compactSummary(ipData, client));
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

function renderHeroCopy(client) {
  if (!els.heroKicker) return;
  const isMobile = !!client?.mobile;
  if (isMacDevice(client)) {
    setAsciiText(els.heroKicker, 'NICE LOOKING MAC! YOUR IP ADDRESS IS');
    return;
  }
  const device = friendlyDeviceName(client);
  if (isMobile) {
    setAsciiText(els.heroKicker, `YOU'RE USING ${device.toUpperCase()}.\nYOUR IP ADDRESS IS`);
    return;
  }
  setAsciiText(els.heroKicker, `YOU'RE USING ${device.toUpperCase()}. GREAT CHOICE. YOUR IP ADDRESS IS`);
}

function bindIpAutofit() {
  let rafId = 0;
  const schedule = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      fitIpHeading();
    });
  };
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', schedule, { once: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(schedule).catch(() => {});
  }
  schedule();
}

function fitIpHeading() {
  const el = els.ip;
  if (!el) return;

  const maxPx = 72;
  const minPx = 18;
  el.style.fontSize = `${maxPx}px`;

  // Shrink until the text fits the hero content width.
  while (el.scrollWidth > el.clientWidth && parseFloat(el.style.fontSize) > minPx) {
    el.style.fontSize = `${Math.max(minPx, parseFloat(el.style.fontSize) - 1)}px`;
    if (parseFloat(el.style.fontSize) <= minPx) break;
  }
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
}

function bindSpeedTest() {
  const speedButtons = Array.from(document.querySelectorAll('[data-run-speed-test]'));
  if (!speedButtons.length) return;

  let isRunning = false;

  const setButtonsDisabled = (disabled) => {
    for (const button of speedButtons) button.disabled = disabled;
  };

  const handleRun = async () => {
    if (isRunning) return;
    isRunning = true;
    setButtonsDisabled(true);
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
      setButtonsDisabled(false);
      isRunning = false;
    }
  };

  for (const button of speedButtons) {
    button.addEventListener('click', handleRun);
  }
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
    const keyText = String(key || 'FIELD').toUpperCase();
    keyEl.classList.add('ascii-fx');
    valueEl.classList.add('ascii-fx');
    setAsciiText(keyEl, keyText);
    applyFieldTooltip(keyEl, keyText);
    const value = normalizeDisplayValue(rawValue);
    setAsciiText(valueEl, value);
    if (value === 'N/A' || value === 'UNKNOWN') valueEl.classList.add('is-empty');
    if (/YES$/.test(value) && /(ONLINE|SECURE|DST|MOBILE|COOKIES|ROUTEABLE)/.test(keyEl.textContent)) valueEl.classList.add('is-accent');
    if (/PROXY|TOR|VPN/.test(keyEl.textContent) && value !== 'NONE DETECTED') valueEl.classList.add('is-warn');
    container.appendChild(node);
  }
  if (countEl) setAsciiText(countEl, `${normalizedEntries.length} FIELDS`);
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
  for (const button of document.querySelectorAll('[data-run-speed-test]')) {
    button.title = 'RUNS A LIGHTWEIGHT BROWSER SPEED TEST (PING + DOWNLOAD).';
  }
}

function applyFieldTooltip(el, key) {
  const text = FIELD_TOOLTIPS[key];
  if (!el || !text) return;
  el.title = text;
  el.setAttribute('aria-label', `${key}: ${text}`);
}

function renderSnapshots(ipData, client) {
  setText(els.snapCountry, ipData.country_code || ipData.country);
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
  setAsciiText(el, normalizeDisplayValue(value));
}

function primeAsciiStaticTexts() {
  const selectors = [
    '.panel h2',
    '.panel-count',
    '.snapshot-key',
    '.speed-btn'
  ];
  document.querySelectorAll(selectors.join(',')).forEach((el) => {
    setAsciiText(el, el.textContent || '', { force: true });
  });
}

function bindAsciiTestControls() {
  const sliderConfigs = [
    ['baseMs', els.ctrlBaseMs, els.ctrlBaseMsValue],
    ['charMs', els.ctrlCharMs, els.ctrlCharMsValue],
    ['minMs', els.ctrlMinMs, els.ctrlMinMsValue],
    ['maxMs', els.ctrlMaxMs, els.ctrlMaxMsValue],
    ['hoverCooldownMs', els.ctrlHoverCooldown, els.ctrlHoverCooldownValue]
  ];

  for (const [key, inputEl, valueEl] of sliderConfigs) {
    if (!(inputEl instanceof HTMLInputElement) || !(valueEl instanceof HTMLElement)) continue;
    const sync = () => {
      state.asciiFx[key] = Number(inputEl.value);
      normalizeAsciiTuningRanges();
      valueEl.textContent = String(state.asciiFx[key]);
      saveAsciiTuningToStorage();
    };
    inputEl.value = String(state.asciiFx[key]);
    sync();
    inputEl.addEventListener('input', sync);
  }

  if (els.ctrlAsciiChars instanceof HTMLInputElement) {
    els.ctrlAsciiChars.value = state.asciiFx.chars;
    els.ctrlAsciiChars.addEventListener('input', () => {
      state.asciiFx.chars = els.ctrlAsciiChars.value || ASCII_REVEAL_CHARS;
      saveAsciiTuningToStorage();
      replayAsciiSample();
    });
  }

  if (els.ctrlReplayAll) {
    els.ctrlReplayAll.addEventListener('click', () => replayAllAsciiTexts());
  }

  if (els.ctrlResetAscii) {
    els.ctrlResetAscii.addEventListener('click', () => {
      state.asciiFx = { ...ASCII_TUNING_DEFAULTS };
      applyAsciiControlStateToInputs();
      saveAsciiTuningToStorage();
      replayAsciiSample();
      replayAllAsciiTexts();
    });
  }

  replayAsciiSample();
}

function normalizeAsciiTuningRanges() {
  if (state.asciiFx.minMs > state.asciiFx.maxMs) {
    state.asciiFx.maxMs = state.asciiFx.minMs;
    if (els.ctrlMaxMs instanceof HTMLInputElement) els.ctrlMaxMs.value = String(state.asciiFx.maxMs);
    if (els.ctrlMaxMsValue) els.ctrlMaxMsValue.textContent = String(state.asciiFx.maxMs);
  }
}

function applyAsciiControlStateToInputs() {
  const items = [
    [els.ctrlBaseMs, els.ctrlBaseMsValue, state.asciiFx.baseMs],
    [els.ctrlCharMs, els.ctrlCharMsValue, state.asciiFx.charMs],
    [els.ctrlMinMs, els.ctrlMinMsValue, state.asciiFx.minMs],
    [els.ctrlMaxMs, els.ctrlMaxMsValue, state.asciiFx.maxMs],
    [els.ctrlHoverCooldown, els.ctrlHoverCooldownValue, state.asciiFx.hoverCooldownMs]
  ];
  for (const [inputEl, valueEl, value] of items) {
    if (inputEl instanceof HTMLInputElement) inputEl.value = String(value);
    if (valueEl) valueEl.textContent = String(value);
  }
  if (els.ctrlAsciiChars instanceof HTMLInputElement) {
    els.ctrlAsciiChars.value = state.asciiFx.chars;
  }
}

function replayAsciiSample() {
  if (!els.ctrlAsciiSample) return;
  els.ctrlAsciiSample.dataset.asciiFinal = els.ctrlAsciiSample.dataset.asciiFinal || 'ASCII EFFECT SAMPLE';
  replayAsciiText(els.ctrlAsciiSample);
}

function replayAllAsciiTexts() {
  document.querySelectorAll('.ascii-fx').forEach((el) => {
    if (el instanceof HTMLElement) replayAsciiText(el);
  });
}

function bindAsciiHoverReplay() {
  const root = document.querySelector('.app-shell');
  if (!root) return;

  root.addEventListener('mouseover', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const charEl = target.closest('.ascii-fx-char');
    if (!(charEl instanceof HTMLElement) || !root.contains(charEl)) return;
    if (event.relatedTarget instanceof Node && charEl.contains(event.relatedTarget)) return;
    scrambleHoveredChar(charEl);
  });
}

function replayAsciiText(el) {
  const finalText = el.dataset.asciiFinal ?? el.textContent ?? '';
  const isIp = el === els.ip;
  setAsciiText(el, finalText, {
    force: true,
    onFrame: isIp ? fitIpHeading : undefined,
    onDone: isIp ? fitIpHeading : undefined
  });
}

function setAsciiText(el, nextText, options = {}) {
  if (!el) return;
  const finalText = String(nextText ?? '');
  el.dataset.asciiFinal = finalText;
  el.classList.add('ascii-fx');

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    el.textContent = finalText;
    options.onDone?.();
    return;
  }

  if (!options.force && el.textContent === finalText) {
    options.onDone?.();
    return;
  }

  const prevToken = asciiRevealTokens.get(el);
  if (prevToken) prevToken.cancelled = true;

  const token = { cancelled: false };
  asciiRevealTokens.set(el, token);
  el.classList.add('is-scrambling');

  const duration = asciiDurationForText(finalText);
  const chars = finalText.split('');
  const fixedMask = chars.map((ch) => /\s/.test(ch));
  const started = performance.now();

  const tick = (now) => {
    if (token.cancelled) {
      el.classList.remove('is-scrambling');
      return;
    }
    const t = Math.min(1, (now - started) / duration);
    const revealCount = Math.floor(chars.length * t);
    let out = '';

    for (let i = 0; i < chars.length; i += 1) {
      if (fixedMask[i]) {
        out += chars[i];
      } else if (i < revealCount || t === 1) {
        out += chars[i];
      } else {
        const charsPool = state.asciiFx.chars || ASCII_REVEAL_CHARS;
        out += charsPool[Math.floor(Math.random() * charsPool.length)];
      }
    }

    el.textContent = out;
    options.onFrame?.();

    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }

    renderAsciiChars(el, finalText);
    el.classList.remove('is-scrambling');
    options.onDone?.();
  };

  requestAnimationFrame(tick);
}

function asciiDurationForText(text) {
  const finalText = String(text ?? '');
  return Math.max(
    state.asciiFx.minMs,
    Math.min(state.asciiFx.maxMs, state.asciiFx.baseMs + finalText.length * state.asciiFx.charMs)
  );
}

function renderAsciiChars(el, text) {
  const chars = Array.from(String(text ?? ''));
  const html = chars.map((char, index) => {
    if (char === '\n') return '<br>';
    const safeChar = escapeHtml(char === ' ' ? '\u00A0' : char);
    const delay = `${Math.min(220, index * 10)}ms`;
    const attrChar = escapeHtml(char);
    return `<span class="ascii-fx-char" data-ascii-char="${attrChar}" data-ascii-index="${index}" style="--char-delay:${delay}">${safeChar}</span>`;
  }).join('');
  el.innerHTML = html;
}

function scrambleHoveredChar(charEl) {
  const now = performance.now();
  const last = Number(charEl.dataset.asciiCharHoverTs || 0);
  const charHoverCooldown = asciiCharHoverCooldownMs();
  if (now - last < charHoverCooldown) return;
  charEl.dataset.asciiCharHoverTs = String(now);

  scrambleCharSpan(charEl, 1);

  const parent = charEl.parentElement;
  if (!parent) return;
  const index = Number(charEl.dataset.asciiIndex);
  if (!Number.isFinite(index)) return;
  const prev = parent.querySelector(`.ascii-fx-char[data-ascii-index="${index - 1}"]`);
  const next = parent.querySelector(`.ascii-fx-char[data-ascii-index="${index + 1}"]`);
  if (prev instanceof HTMLElement) scrambleCharSpan(prev, 0.55);
  if (next instanceof HTMLElement) scrambleCharSpan(next, 0.55);
}

function scrambleCharSpan(span, intensity = 1) {
  const finalCharRaw = span.dataset.asciiChar ?? span.textContent ?? '';
  const finalChar = finalCharRaw === ' ' ? ' ' : finalCharRaw;
  if (!finalChar || /\s/.test(finalChar)) {
    span.textContent = finalChar === ' ' ? '\u00A0' : finalChar;
    return;
  }

  if (asciiCharHoverActive.has(span)) return;
  asciiCharHoverActive.add(span);

  const token = { cancelled: false };
  asciiCharHoverTokens.set(span, token);
  span.classList.add('is-char-scrambling');

  const charsPool = state.asciiFx.chars || ASCII_REVEAL_CHARS;
  const duration = asciiCharHoverDurationMs(intensity);
  const started = performance.now();

  const tick = (now) => {
    if (token.cancelled) {
      span.classList.remove('is-char-scrambling');
      asciiCharHoverActive.delete(span);
      asciiCharHoverTokens.delete(span);
      return;
    }
    const t = Math.min(1, (now - started) / duration);
    if (t >= 1) {
      span.textContent = finalChar;
      span.classList.remove('is-char-scrambling');
      asciiCharHoverActive.delete(span);
      asciiCharHoverTokens.delete(span);
      return;
    }

    // Bias toward the final char as the animation settles.
    const settle = t > 0.7 && Math.random() < ((t - 0.7) / 0.3);
    span.textContent = settle ? finalChar : charsPool[Math.floor(Math.random() * charsPool.length)];
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function asciiCharHoverCooldownMs() {
  // Char hover should feel responsive, but still track the tuning control.
  const v = Number(state.asciiFx.hoverCooldownMs) || 0;
  if (v <= 0) return 0;
  return Math.max(12, Math.round(v * 0.12));
}

function asciiCharHoverDurationMs(intensity = 1) {
  const base = Math.max(1, asciiDurationForText('X'));
  const scaledMin = Math.max(22, Math.round(state.asciiFx.minMs * 0.2));
  const scaledMax = Math.max(scaledMin, Math.round(state.asciiFx.maxMs * 0.2));
  const raw = base * (0.45 + intensity * 0.7);
  return Math.max(scaledMin, Math.min(scaledMax, raw));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compactSummary(ipData, client) {
  const place = [ipData.city, ipData.region, ipData.country].filter(Boolean).join(', ');
  const isp = ipData.connection?.isp || ipData.connection?.org;
  const networkHint = [client.connectionType, client.effectiveType].filter((v) => v && v !== 'N/A').join(' / ');

  if (place && isp && networkHint) {
    return `It looks like you're connecting from ${place} with ${isp} (${networkHint}).`;
  }
  if (place && isp) {
    return `It looks like you're connecting from ${place} with ${isp}.`;
  }
  if (place) {
    return `It looks like you're connecting from ${place}.`;
  }
  if (isp) {
    return `You're online through ${isp}.`;
  }
  return 'Your connection details are ready.';
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

function friendlyDeviceName(client) {
  const ua = String(client?.userAgent || '');
  const platform = String(client?.platform || '');
  const maxTouchPoints = Number(client?.maxTouchPoints || 0);

  // iOS user agents include "like Mac OS X", so detect Apple mobile first.
  if (/iPhone/i.test(ua)) return 'an iPhone';
  if (/iPad/i.test(ua)) return 'an iPad';
  if (/iPod/i.test(ua)) return 'an iPod touch';
  if (/Mac/i.test(platform) && maxTouchPoints > 1) return 'an iPad';

  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    if (/MacBookPro/i.test(ua)) return 'a MacBook Pro';
    if (/MacBookAir/i.test(ua)) return 'a MacBook Air';
    return 'a Mac';
  }
  if (/Android/i.test(ua)) return client?.mobile ? 'an Android phone' : 'an Android device';
  if (/Windows/i.test(platform) || /Windows/i.test(ua)) return 'a Windows computer';
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'a Linux machine';
  return client?.mobile ? 'a mobile device' : 'this device';
}

function isMacDevice(client) {
  const ua = String(client?.userAgent || '');
  const platform = String(client?.platform || '');
  const maxTouchPoints = Number(client?.maxTouchPoints || 0);

  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  // iPadOS desktop mode often reports MacIntel platform with touch points > 1.
  if (/Mac/i.test(platform) && maxTouchPoints > 1) return false;

  return /Mac/i.test(platform) || /Macintosh/i.test(ua);
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
