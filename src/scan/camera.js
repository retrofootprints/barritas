// Camera access: getUserMedia, device picker, torch, zoom, frame grabbing.

const MAX_FRAME_SIDE = 1280; // frames are scaled down to this before decoding

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.track = null;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  get active() { return !!this.stream; }

  async start(deviceId) {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(window.isSecureContext
        ? 'This browser does not support camera access.'
        : 'Camera access needs a secure (https://) page.');
    }
    const video = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      throw new Error(cameraErrorText(e));
    }
    this.track = this.stream.getVideoTracks()[0];
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    if (!this.video.videoWidth) {
      await new Promise((r) => this.video.addEventListener('loadedmetadata', r, { once: true }));
    }
    return this.track;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    if (this.video.srcObject) this.video.srcObject = null;
  }

  get deviceId() { return this.track?.getSettings?.().deviceId || ''; }

  async listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  capabilities() {
    try { return this.track?.getCapabilities?.() || {}; } catch { return {}; }
  }

  async setTorch(on) {
    await this.track?.applyConstraints({ advanced: [{ torch: !!on }] });
  }

  async setZoom(value) {
    await this.track?.applyConstraints({ advanced: [{ zoom: Number(value) }] });
  }

  get width() { return this.video.videoWidth; }
  get height() { return this.video.videoHeight; }

  /**
   * Grab the current frame (optionally only a centred region of interest) as ImageData.
   * Returns { image, scale, offsetX, offsetY } — multiply decoded coordinates by `scale` and add
   * the offsets to get video pixel coordinates.
   */
  grab(roiFraction = 0) {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return null;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;
    if (roiFraction > 0) {
      sw = Math.round(vw * roiFraction);
      sh = Math.round(vh * roiFraction);
      sx = Math.round((vw - sw) / 2);
      sy = Math.round((vh - sh) / 2);
    }
    const k = Math.min(1, MAX_FRAME_SIDE / Math.max(sw, sh));
    const w = Math.round(sw * k);
    const h = Math.round(sh * k);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, w, h);
    return { image: this.ctx.getImageData(0, 0, w, h), scale: 1 / k, offsetX: sx, offsetY: sy };
  }

  /** Copy the current full-resolution frame into a canvas (freeze-frame). */
  snapshot(canvas) {
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(this.video, 0, 0);
    return canvas;
  }
}

function cameraErrorText(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access for this site in your browser settings and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No suitable camera was found.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is in use by another app or could not be started.';
    default:
      return `Could not start the camera: ${e?.message || e}`;
  }
}

/** Map a quad from grabbed-frame coordinates to video pixel coordinates. */
export function mapQuad(quad, { scale, offsetX, offsetY }) {
  return quad && quad.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
}
