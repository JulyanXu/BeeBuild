export const RECORDING_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
];

export function chooseRecordingType(Recorder) {
  return RECORDING_TYPES.find(type => {
    try { return Recorder?.isTypeSupported?.(type); } catch { return false; }
  }) || '';
}

export function formatRecordingTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function recordingFilename(mimeType, date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogv' : 'webm';
  return `BeeBuild-${stamp}.${extension}`;
}

const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());

/** Local media capture only; injected platform APIs keep lifecycle behavior testable. */
export class ScreenRecorder {
  constructor(platform = {}) {
    const mediaDevices = globalThis.navigator?.mediaDevices;
    this.platform = {
      getDisplayMedia: mediaDevices?.getDisplayMedia?.bind(mediaDevices),
      Recorder: globalThis.MediaRecorder,
      createURL: blob => URL.createObjectURL(blob),
      revokeURL: url => URL.revokeObjectURL(url),
      now: () => performance.now(),
      setInterval: (fn, delay) => globalThis.setInterval(fn, delay),
      clearInterval: id => globalThis.clearInterval(id),
      ...platform,
    };
    this.supported = typeof this.platform.getDisplayMedia === 'function' && typeof this.platform.Recorder === 'function';
    this.value = { phase: 'idle', supported: this.supported, elapsedMs: 0, result: null, error: '', notice: '', displaySurface: '' };
    this.listeners = new Set();
    this.session = 0;
    this.disposed = false;
    this.stream = null;
    this.recorder = null;
    this.timer = null;
    this.trackEnded = null;
  }

  snapshot() { return { ...this.value }; }

  subscribe(listener) {
    this.disposed = false;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(patch) {
    this.value = { ...this.value, ...patch };
    if (!this.disposed) this.listeners.forEach(listener => listener(this.snapshot()));
  }

  releaseResult() {
    if (this.value.result?.url) this.platform.revokeURL(this.value.result.url);
  }

  clearTimer() {
    if (this.timer !== null) this.platform.clearInterval(this.timer);
    this.timer = null;
  }

  cleanupCapture() {
    this.clearTimer();
    if (this.trackEnded) this.stream?.getVideoTracks().forEach(track => track.removeEventListener('ended', this.trackEnded));
    this.trackEnded = null;
    stopTracks(this.stream);
    this.stream = null;
    this.recorder = null;
  }

  async start() {
    if (this.disposed || ['requesting', 'recording', 'stopping'].includes(this.value.phase)) return false;
    if (!this.supported) {
      this.update({ error: '当前浏览器不支持录制。请在支持屏幕共享的桌面浏览器中打开此页面。' });
      return false;
    }
    const token = ++this.session;
    const previousResult = this.value.result;
    const previousElapsed = this.value.elapsedMs;
    this.update({ phase: 'requesting', error: '', notice: '' });
    let stream;
    let recorder;
    try {
      // These are picker preferences, not authority to select a source for the user.
      stream = await this.platform.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: { ideal: 30, max: 30 }, cursor: 'never' },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude',
        monitorTypeSurfaces: 'exclude',
      });
      if (this.disposed || token !== this.session) { stopTracks(stream); return false; }
      const tracks = stream.getVideoTracks();
      if (!tracks.length || tracks.every(track => track.readyState === 'ended')) throw new Error('SOURCE_ENDED');
      const mimeType = chooseRecordingType(this.platform.Recorder);
      recorder = new this.platform.Recorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 8_000_000 });
      this.stream = stream;
      this.recorder = recorder;
      const chunks = [];
      let captureError = '';
      recorder.addEventListener('dataavailable', event => {
        if (token === this.session && event.data?.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener('error', () => {
        captureError = '录制意外中断。';
        if (token === this.session && recorder.state !== 'inactive') this.stop();
      });
      recorder.addEventListener('stop', () => {
        if (this.disposed || token !== this.session) return;
        const elapsedMs = this.value.phase === 'recording' ? this.platform.now() - this.startedAt : this.value.elapsedMs;
        const type = recorder.mimeType || chunks.find(chunk => chunk.type)?.type || mimeType || 'video/webm';
        this.cleanupCapture();
        if (!chunks.length) {
          this.update({ phase: 'idle', elapsedMs: 0, result: null, error: '没有录到可保存的画面，请重新选择标签页再试。' });
          return;
        }
        const blob = new Blob(chunks, { type });
        const result = { blob, url: this.platform.createURL(blob), mimeType: type, size: blob.size, filename: recordingFilename(type), elapsedMs };
        this.update({ phase: 'ready', elapsedMs, result, error: '', notice: captureError ? `${captureError}已保留录到的片段。` : '' });
      });
      this.trackEnded = () => this.stop();
      tracks.forEach(track => track.addEventListener('ended', this.trackEnded));
      recorder.start(1000);
      this.releaseResult();
      this.startedAt = this.platform.now();
      this.update({ phase: 'recording', elapsedMs: 0, result: null, displaySurface: tracks[0].getSettings?.().displaySurface || '', error: '', notice: '' });
      this.timer = this.platform.setInterval(() => {
        if (this.value.phase === 'recording') this.update({ elapsedMs: this.platform.now() - this.startedAt });
      }, 250);
      return true;
    } catch (error) {
      if (this.disposed || token !== this.session) { stopTracks(stream); return false; }
      // Invalidate callbacks from a recorder whose constructor or start failed.
      this.session += 1;
      if (recorder?.state && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* Tracks are still stopped below. */ }
      }
      this.cleanupCapture();
      stopTracks(stream);
      const cancelled = ['NotAllowedError', 'AbortError'].includes(error?.name);
      const message = cancelled ? '' : error?.name === 'InvalidStateError'
        ? '请回到当前页面，再点击「选择标签页并录制」。'
        : error?.name === 'NotReadableError'
          ? '无法读取选中的画面，请检查系统屏幕录制权限后再试。'
          : '未能开始录制，请重新选择当前标签页。';
      this.update({ phase: previousResult ? 'ready' : 'idle', result: previousResult, elapsedMs: previousElapsed, error: message, notice: cancelled ? '未开始录制。你可以随时重新选择标签页。' : '' });
      return false;
    }
  }

  stop() {
    if (!this.recorder || this.value.phase !== 'recording') return;
    this.clearTimer();
    this.update({ phase: 'stopping', elapsedMs: this.platform.now() - this.startedAt });
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    stopTracks(this.stream);
  }

  reset() {
    if (['requesting', 'recording', 'stopping'].includes(this.value.phase)) return;
    this.releaseResult();
    this.update({ phase: 'idle', elapsedMs: 0, result: null, error: '', notice: '' });
  }

  dispose() {
    this.disposed = true;
    this.session += 1;
    if (this.recorder?.state && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* A source can end before cleanup. */ }
    }
    this.cleanupCapture();
    this.releaseResult();
    this.value = { ...this.value, phase: 'idle', result: null, elapsedMs: 0 };
    this.listeners.clear();
  }
}
