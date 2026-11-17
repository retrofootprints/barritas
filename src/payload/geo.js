// geo: URI (RFC 5870): geo:38.7223,-9.1393[,alt][;u=…][?q=…]

export function parseGeo(text) {
  const m = text.trim().match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?([^?]*)(?:\?(.*))?$/i);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const params = new URLSearchParams(m[5] || '');
  const unc = (m[4] || '').match(/;u=([\d.]+)/);
  return { lat, lon, alt: m[3] !== undefined ? Number(m[3]) : null, uncertainty: unc ? Number(unc[1]) : null, query: params.get('q') || '' };
}

export function interpretGeo(text) {
  const g = parseGeo(text);
  if (!g) return null;
  const dms = (v, pos, neg) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const mi = Math.floor((a - d) * 60);
    const s = ((a - d) * 60 - mi) * 60;
    return `${d}°${mi}′${s.toFixed(1)}″${v >= 0 ? pos : neg}`;
  };
  return {
    title: 'Geographic location',
    summary: `${g.lat}, ${g.lon}`,
    fields: [
      ['Latitude', `${g.lat} (${dms(g.lat, 'N', 'S')})`],
      ['Longitude', `${g.lon} (${dms(g.lon, 'E', 'W')})`],
      ['Altitude', g.alt !== null ? `${g.alt} m` : ''],
      ['Uncertainty', g.uncertainty !== null ? `${g.uncertainty} m` : ''],
      ['Search / label', g.query],
    ],
    links: [
      { label: 'Open in maps app', href: `geo:${g.lat},${g.lon}` },
      { label: 'OpenStreetMap', href: `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=16/${g.lat}/${g.lon}` },
    ],
  };
}
