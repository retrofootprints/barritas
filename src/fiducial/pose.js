// Pose helpers: focal length estimate and coordinate mapping. (POSIT itself runs in the worker.)

/**
 * Focal length in pixels for an image `width` pixels wide.
 * - focal35: 35 mm-equivalent focal length (mm), if the user knows it (e.g. 26 mm for many phone main cameras)
 * - fov: assumed horizontal field of view in degrees (default 65°)
 */
export function focalPx(width, { fov = 65, focal35 = '' } = {}) {
  const f35 = Number(focal35);
  if (f35 > 0) return (f35 / 36) * width; // 36 mm = full-frame sensor width
  const deg = Math.min(170, Math.max(10, Number(fov) || 65));
  return width / 2 / Math.tan((deg * Math.PI) / 360);
}

/** Map a marker (corners + pose axes) from grabbed-frame coordinates to display coordinates. */
export function mapMarker(m, { scale, offsetX, offsetY }) {
  const f = (p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY });
  return {
    ...m,
    corners: m.corners.map(f),
    pose: m.pose && { ...m.pose, axes: m.pose.axes && Object.fromEntries(Object.entries(m.pose.axes).map(([k, p]) => [k, f(p)])) },
  };
}

export const fmtMm = (v) => `${Math.round(v)} mm`;
export const fmtDeg = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`;
