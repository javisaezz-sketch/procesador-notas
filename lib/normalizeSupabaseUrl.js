export function normalizeSupabaseUrl(urlRaw) {
  if (!urlRaw || typeof urlRaw !== 'string') return urlRaw;
  let u = urlRaw.trim();
  if (u.startsWith('hhttps://')) {
    u = u.replace(/^hhttps:\/\//, 'https://');
  }
  u = u.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  return u;
}
