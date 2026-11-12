import test from 'node:test';
import assert from 'node:assert/strict';
import { ScreenRecorder, chooseRecordingType, formatRecordingTime, recordingFilename } from '../src/recording/ScreenRecorder.js';

class FakeTrack extends EventTarget {
  constructor() { super(); this.readyState = 'live'; this.stopCount = 0; }
  stop() { this.readyState = 'ended'; this.stopCount += 1; }
  endFromBrowser() { this.readyState = 'ended'; this.dispatchEvent(new Event('ended')); }
  getSettings() { return { displaySurface: 'browser' }; }
}
class FakeMediaRecorder extends EventTarget {
  static instances = [];
  static isTypeSupported(type) { return type === 'video/webm;codecs=vp8'; }
  constructor(stream, options) { super(); this.stream = stream; this.options = options; this.mimeType = options.mimeType; this.state = 'inactive'; FakeMediaRecorder.instances.push(this); }
  start(timeslice) { this.timeslice = timeslice; this.state = 'recording'; }
  chunk(text) { this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob([text], { type: this.mimeType }) })); }
  stop() { this.state = 'inactive'; queueMicrotask(() => { this.chunk('last-frame'); this.dispatchEvent(new Event('stop')); }); }
}
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}) {
  const track = new FakeTrack();
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  let now = 0;
  let options;
  const revoked = [];
  const timers = new Set();
  let urls = 0;
  const platform = {
    getDisplayMedia: async value => { options = value; return stream; }, Recorder: FakeMediaRecorder,
    now: () => now, setInterval: fn => { timers.add(fn); return fn; }, clearInterval: id => timers.delete(id),
    createURL: () => `blob:test-${++urls}`, revokeURL: url => revoked.push(url), ...overrides,
  };
  const controller = new ScreenRecorder(platform);
  return { controller, track, stream, revoked, timers, setNow: value => { now = value; }, options: () => options };
}

test('negotiates a supported codec and matches the download extension', () => {
  assert.equal(chooseRecordingType(FakeMediaRecorder), 'video/webm;codecs=vp8');
  assert.equal(chooseRecordingType({ isTypeSupported: type => type === 'video/mp4' }), 'video/mp4');
  assert.equal(chooseRecordingType({}), '');
  assert.equal(recordingFilename('video/mp4', new Date(2026, 10, 12, 9, 4, 3)), 'BeeBuild-20261112-090403.mp4');
  assert.equal(formatRecordingTime(74_999), '01:14');
});

test('records all chunks locally and releases the chosen capture on stop', async () => {
  const value = fixture();
  assert.equal(await value.controller.start(), true);
  assert.equal(value.options().audio, false);
  assert.equal(value.options().preferCurrentTab, true);
  assert.equal(value.controller.snapshot().displaySurface, 'browser');
  const recorder = FakeMediaRecorder.instances.at(-1);
  recorder.chunk('first-frame');
  value.setNow(2500);
  value.timers.forEach(fn => fn());
  assert.equal(value.controller.snapshot().elapsedMs, 2500);
  value.controller.stop();
  assert.equal(value.controller.snapshot().phase, 'stopping');
  assert.equal(value.track.readyState, 'ended');
  await settle();
  const result = value.controller.snapshot().result;
  assert.equal(value.controller.snapshot().phase, 'ready');
  assert.equal(await result.blob.text(), 'first-framelast-frame');
  assert.equal(result.elapsedMs, 2500);
  assert.match(result.filename, /\.webm$/);
  assert.equal(value.timers.size, 0);
  value.controller.dispose();
  assert.deepEqual(value.revoked, ['blob:test-1']);
});

test('browser stop sharing finalizes the video exactly once', async () => {
  const value = fixture();
  await value.controller.start();
  value.setNow(1200);
  value.track.endFromBrowser();
  value.controller.stop();
  await settle();
  assert.equal(value.controller.snapshot().phase, 'ready');
  assert.equal(value.controller.snapshot().result.elapsedMs, 1200);
  value.controller.dispose();
});

test('an empty capture returns a visible error state without a broken download', async () => {
  class EmptyRecorder extends FakeMediaRecorder {
    stop() { this.state = 'inactive'; queueMicrotask(() => this.dispatchEvent(new Event('stop'))); }
  }
  const value = fixture({ Recorder: EmptyRecorder });
  await value.controller.start();
  value.setNow(200);
  value.controller.stop();
  await settle();
  assert.equal(value.controller.snapshot().phase, 'idle');
  assert.equal(value.controller.snapshot().result, null);
  assert.match(value.controller.snapshot().error, /没有录到可保存的画面/);
  assert.equal(value.controller.snapshot().elapsedMs, 0);
  assert.equal(value.track.readyState, 'ended');
  assert.equal(value.timers.size, 0);
  assert.deepEqual(value.revoked, []);
  value.controller.dispose();
});

test('canceling the source picker preserves an existing unsaved result', async () => {
  const value = fixture();
  await value.controller.start();
  value.controller.stop();
  await settle();
  const before = value.controller.snapshot().result;
  value.controller.platform.getDisplayMedia = async () => { throw new DOMException('cancelled', 'NotAllowedError'); };
  assert.equal(await value.controller.start(), false);
  assert.equal(value.controller.snapshot().phase, 'ready');
  assert.equal(value.controller.snapshot().result, before);
  assert.equal(value.controller.snapshot().error, '');
  assert.equal(value.revoked.length, 0);
  value.controller.dispose();
});

test('unmount while the picker is open stops a late stream without starting recording', async () => {
  let resolvePicker;
  const value = fixture({ getDisplayMedia: () => new Promise(resolve => { resolvePicker = resolve; }) });
  const pending = value.controller.start();
  assert.equal(value.controller.snapshot().phase, 'requesting');
  value.controller.dispose();
  resolvePicker(value.stream);
  assert.equal(await pending, false);
  assert.equal(value.track.readyState, 'ended');
  assert.equal(value.controller.snapshot().result, null);
});

test('an unavailable browser does not attempt capture', async () => {
  const value = fixture({ getDisplayMedia: undefined });
  assert.equal(value.controller.snapshot().supported, false);
  assert.equal(await value.controller.start(), false);
  assert.match(value.controller.snapshot().error, /不支持/);
  assert.equal(value.timers.size, 0);
});

test('recorder startup failure stops tracks and leaves a recoverable error', async () => {
  class BrokenRecorder extends FakeMediaRecorder { start() { throw new DOMException('encoder unavailable', 'NotSupportedError'); } }
  const value = fixture({ Recorder: BrokenRecorder });
  assert.equal(await value.controller.start(), false);
  assert.equal(value.track.readyState, 'ended');
  assert.equal(value.controller.snapshot().phase, 'idle');
  assert.match(value.controller.snapshot().error, /未能开始/);
  assert.equal(value.timers.size, 0);
});

test('starting again releases the previous object URL only after capture succeeds', async () => {
  const value = fixture();
  await value.controller.start(); value.controller.stop(); await settle();
  const nextTrack = new FakeTrack();
  value.controller.platform.getDisplayMedia = async () => ({ getTracks: () => [nextTrack], getVideoTracks: () => [nextTrack] });
  await value.controller.start();
  assert.deepEqual(value.revoked, ['blob:test-1']);
  assert.equal(value.controller.snapshot().result, null);
  value.controller.dispose();
  await settle();
  assert.equal(nextTrack.readyState, 'ended');
  assert.equal(value.controller.snapshot().result, null);
});
