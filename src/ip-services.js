export async function fetchPublicIpOnly() {
  const attempts = [];
  const providers = [
    async () => {
      const res = await fetch('https://api64.ipify.org?format=json', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`IPIFY64 HTTP ${res.status}`);
      const data = await res.json();
      return data?.ip;
    },
    async () => {
      const res = await fetch('https://api.ipify.org?format=json', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`IPIFY HTTP ${res.status}`);
      const data = await res.json();
      return data?.ip;
    },
    async () => {
      const res = await fetch('https://ipwho.is/', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`IPWHO.IS HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.success === false) throw new Error(data.message || 'IPWHO.IS FAILED');
      return data?.ip;
    }
  ];

  for (const provider of providers) {
    try {
      const ip = await provider();
      if (ip) return ip;
      attempts.push('MISSING IP');
    } catch (error) {
      attempts.push(String(error?.message || error));
    }
  }

  throw new Error(`PUBLIC IP FAILED / ${attempts.join(' / ')}`);
}

export async function fetchIpData() {
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
    const res = await fetch('https://ipwhois.io/', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`IPWHOIS.IO HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.success === false) throw new Error(data.message || 'IPWHOIS.IO FAILED');
    return normalizeIpWhoisIo(data);
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

  try {
    const res = await fetch('https://api64.ipify.org?format=json', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`IPIFY HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.ip) throw new Error('IPIFY MISSING IP');
    return normalizeIpOnly(data.ip);
  } catch (error) {
    attempts.push(String(error?.message || error));
  }

  throw new Error(`IP LOOKUP FAILED / ${attempts.join(' / ')}`);
}

export function normalizeIpOnly(ip) {
  return {
    ip,
    type: inferIpType(ip),
    connection: {},
    timezone: {},
    flag: {}
  };
}

function normalizeIpWhoisIo(data) {
  const tzId = data.timezone?.id;
  return {
    ip: data.ip,
    type: data.type,
    country: data.country,
    country_code: data.country_code,
    region: data.region,
    city: data.city,
    postal: data.postal,
    latitude: numberOrUndefined(data.latitude),
    longitude: numberOrUndefined(data.longitude),
    connection: {
      isp: data.connection?.isp,
      org: data.connection?.org,
      asn: data.connection?.asn,
      domain: data.connection?.domain,
      hostname: data.connection?.hostname
    },
    flag: {
      emoji: data.flag?.emoji
    },
    timezone: {
      id: tzId,
      abbr: data.timezone?.abbr,
      utc: data.timezone?.utc,
      current_time: tzId ? currentTimeForZone(tzId) : undefined,
      is_dst: typeof data.timezone?.is_dst === 'boolean' ? data.timezone.is_dst : (tzId ? isDstNowInZone(tzId) : undefined)
    },
    security: data.security
  };
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

function inferIpType(ip) {
  if (!ip) return undefined;
  return String(ip).includes(':') ? 'IPv6' : 'IPv4';
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
