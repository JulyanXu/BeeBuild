import test from 'node:test';
import assert from 'node:assert/strict';
import { RebuildScheduler, textRevealAt, isVisibleBuildArea } from '../src/engine/engine.js';

function fixture(options = {}) {
  let now = 0;
  const scheduler = new RebuildScheduler({ now: () => now, introDuration: 0, ...options });
  const advance = (milliseconds) => {
    const target = now + milliseconds;
    while (now < target) { now = Math.min(target, now + 16); scheduler.tick(now); }
  };
  const tasks = [{ id: 'title', kind: 'text', duration: 1000, rect: { x: 20, y: 20, width: 200, height: 30 } }];
  return { scheduler, advance, tasks, now: () => now, jump: (value) => { now = value; } };
}

test('speed changes preserve progress and scale only subsequent elapsed time', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  advance(200);
  const before = scheduler.snapshot().tasks[0].progress;
  scheduler.setSpeed(2);
  assert.equal(scheduler.snapshot().tasks[0].progress, before);
  advance(200);
  assert.ok(Math.abs(scheduler.snapshot().tasks[0].progress - 0.6) < 0.001);
});

test('pause freezes the shared clock and resume does not catch up missed time', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  advance(160);
  scheduler.pause();
  const frozen = scheduler.snapshot().virtualTime;
  advance(2000);
  assert.equal(scheduler.snapshot().virtualTime, frozen);
  scheduler.resume();
  advance(160);
  assert.equal(scheduler.snapshot().virtualTime, frozen + 160);
});

test('stale scene callbacks cannot advance a newer revision', () => {
  const { scheduler, tasks } = fixture();
  const oldRevision = scheduler.start(tasks, { intro: false });
  scheduler.start([{ ...tasks[0], id: 'replacement' }], { intro: false });
  scheduler.tick(1000, oldRevision);
  assert.equal(scheduler.snapshot().virtualTime, 0);
  assert.equal(scheduler.snapshot().tasks[0].id, 'replacement');
});

test('child tasks unlock only after their parent completes', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start([{ ...tasks[0], id: 'parent', duration: 300 }, { ...tasks[0], id: 'child', parentId: 'parent', duration: 300 }], { intro: false });
  advance(200);
  assert.equal(scheduler.snapshot().tasks[1].status, 'queued');
  advance(120);
  assert.equal(scheduler.snapshot().tasks[0].status, 'complete');
  assert.equal(scheduler.snapshot().tasks[1].status, 'running');
});

test('exit invalidates callbacks and drops all animation work while preserving speed', () => {
  const { scheduler, tasks } = fixture();
  const revision = scheduler.start(tasks, { intro: false });
  scheduler.setSpeed(3);
  scheduler.exit();
  scheduler.tick(1000, revision);
  assert.equal(scheduler.snapshot().state, 'idle');
  assert.equal(scheduler.snapshot().tasks.length, 0);
  assert.equal(scheduler.snapshot().agents.length, 0);
  assert.equal(scheduler.snapshot().speed, 3);
});

test('a long frame is clamped instead of completing an entire scene', () => {
  const { scheduler, tasks, jump } = fixture();
  scheduler.start(tasks, { intro: false });
  jump(20000);
  scheduler.tick();
  assert.equal(scheduler.snapshot().virtualTime, 64);
  assert.equal(scheduler.snapshot().state, 'running');
});

test('completed viewport tasks remain complete when new visible tasks are planned', () => {
  const { scheduler, tasks } = fixture();
  scheduler.start([...tasks, { ...tasks[0], id: 'new-row' }], { intro: false, completedIds: ['title'] });
  assert.equal(scheduler.snapshot().tasks[0].status, 'complete');
  assert.equal(scheduler.snapshot().completed, 1);
  assert.equal(scheduler.snapshot().tasks[1].status, 'running');
});

test('a typical viewport runs for twelve to eighteen seconds at default speed', () => {
  const { scheduler, advance, tasks, now } = fixture({ introDuration: 500 });
  const viewport = Array.from({ length: 32 }, (_, index) => ({
    id: `element-${index}`,
    kind: ['box', 'text', 'text', 'image'][index % 4],
    rect: tasks[0].rect,
  }));
  scheduler.start(viewport);
  while (!scheduler.snapshot().viewportComplete && now() < 25000) advance(16);
  assert.ok(now() >= 12000 && now() <= 18000, `Completed at ${now()} ms`);
  assert.equal(scheduler.state, 'running');
});

test('pausing the intro retains every cursor at its frozen position', () => {
  const { scheduler, advance, tasks } = fixture({ introDuration: 500 });
  scheduler.start(tasks);
  advance(200);
  scheduler.pause();
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.agents.length, 36);
  assert.ok(snapshot.agents.every((agent) => agent.phase === 'intro'));
});

test('text reveal finishes one line before entering the next line', () => {
  const task = { rect: { width: 200, height: 60 }, lineHeight: 20, textLines: [
    { left: 0, top: 2, width: 200, height: 16 },
    { left: 0, top: 22, width: 200, height: 16 },
    { left: 0, top: 42, width: 100, height: 16 },
  ] };
  const first = textRevealAt(task, 0.2);
  const second = textRevealAt(task, 0.6);
  assert.equal(first.lineIndex, 0);
  assert.equal(first.x, 100);
  assert.equal(first.y, 2);
  assert.equal(second.lineIndex, 1);
  assert.equal(second.x, 100);
  assert.equal(second.y, 22);
  assert.equal(textRevealAt(task, 1).clipPath, 'inset(0)');
});

test('thin visible lines are buildable while fully clipped lines remain excluded', () => {
  assert.equal(isVisibleBuildArea({ width: 600, height: 1 }, 'line'), true);
  assert.equal(isVisibleBuildArea({ left: 10, right: 610, top: 40, bottom: 40.5 }, 'line'), true);
  assert.equal(isVisibleBuildArea({ width: 600, height: 0 }, 'line'), false);
  assert.equal(isVisibleBuildArea({ width: 0.5, height: 100 }, 'line'), true);
  assert.equal(isVisibleBuildArea({ width: 600, height: 1 }, 'box'), false);
});

test('scroll geometry merges preserve the clock, revision, speed and existing task progress', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  scheduler.setSpeed(2);
  advance(160);
  const before = scheduler.snapshot();
  scheduler.syncViewport([
    { ...tasks[0], rect: { ...tasks[0].rect, y: 80 } },
    { ...tasks[0], id: 'entering-content', rect: { ...tasks[0].rect, y: 150 } },
  ]);
  const after = scheduler.snapshot();
  assert.equal(after.revision, before.revision);
  assert.equal(after.virtualTime, before.virtualTime);
  assert.equal(after.speed, 2);
  assert.equal(after.tasks[0].progress, before.tasks[0].progress);
  assert.equal(after.tasks[0].startedAt, before.tasks[0].startedAt);
  assert.equal(after.tasks[0].rect.y, 80);
  assert.equal(after.tasks[1].status, 'running');
  advance(160);
  assert.ok(scheduler.snapshot().tasks[0].progress > after.tasks[0].progress);
  assert.equal(scheduler.snapshot().agents.length, 36);
});

test('continuous scrolling neither stops offscreen work nor hides the 36-agent swarm', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  for (let step = 0; step < 80; step++) {
    scheduler.syncViewport(step < 10 ? [{ ...tasks[0], rect: { ...tasks[0].rect, y: 20 - step } }] : []);
    advance(16);
    const snapshot = scheduler.snapshot();
    assert.equal(snapshot.state, 'running');
    assert.equal(snapshot.agents.length, 36);
    assert.ok(snapshot.agents.every((agent) => agent.position.x >= 10 && agent.position.y >= 10 && agent.position.x <= 880 && agent.position.y <= 576));
  }
  assert.equal(scheduler.snapshot().tasks[0].status, 'complete');
  assert.equal(scheduler.snapshot().virtualTime, 1280);
});

test('completed viewport keeps playing; arriving content joins without rebuilding completed elements', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  advance(1200);
  const completed = scheduler.snapshot();
  assert.equal(completed.state, 'running');
  assert.equal(completed.viewportComplete, true);
  assert.equal(completed.agents.length, 36);
  advance(400);
  const waiting = scheduler.snapshot();
  assert.ok(waiting.virtualTime > completed.virtualTime);
  assert.notDeepEqual(waiting.agents[0].position, completed.agents[0].position);
  scheduler.syncViewport([...tasks, { ...tasks[0], id: 'new-content' }]);
  assert.equal(scheduler.snapshot().tasks[0].status, 'complete');
  assert.equal(scheduler.snapshot().tasks[1].status, 'running');
  assert.equal(scheduler.snapshot().viewportComplete, false);
  assert.equal(scheduler.snapshot().virtualTime, waiting.virtualTime);
});

test('explicit pause freezes both working and idle agents while scroll updates geometry and queues content', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  advance(160);
  scheduler.pause();
  const before = scheduler.snapshot();
  scheduler.syncViewport([{ ...tasks[0], rect: { ...tasks[0].rect, y: 120 } }, { ...tasks[0], id: 'queued-while-paused' }]);
  advance(2000);
  const paused = scheduler.snapshot();
  assert.equal(paused.virtualTime, before.virtualTime);
  assert.equal(paused.tasks[0].progress, before.tasks[0].progress);
  assert.equal(paused.tasks[0].rect.y, 120);
  assert.equal(paused.tasks[1].status, 'queued');
  assert.deepEqual(paused.agents.map((agent) => agent.position), before.agents.map((agent) => agent.position));
  scheduler.resume();
  advance(160);
  assert.ok(scheduler.snapshot().tasks[0].progress > before.tasks[0].progress);
  assert.equal(scheduler.snapshot().tasks[1].status, 'running');
});

test('viewport replay resets only visible tasks and retains speed, elapsed time and offscreen completions', () => {
  const { scheduler, advance, tasks } = fixture();
  const first = tasks[0];
  const second = { ...first, id: 'second' };
  scheduler.start([first, second], { intro: false });
  advance(1200);
  scheduler.setSpeed(3);
  scheduler.syncViewport([first]);
  const before = scheduler.snapshot();
  scheduler.replayVisible();
  const replay = scheduler.snapshot();
  assert.equal(replay.virtualTime, before.virtualTime);
  assert.equal(replay.speed, 3);
  assert.equal(replay.tasks[0].progress, 0);
  assert.equal(replay.tasks[1].status, 'complete');
  assert.equal(replay.tasks[1].visible, false);
  assert.equal(replay.agents.length, 36);
});

test('resize reprojection retains task progress and keeps assisting agents inside the new viewport', () => {
  const { scheduler, advance, tasks } = fixture();
  scheduler.start(tasks, { intro: false });
  advance(160);
  const progress = scheduler.snapshot().tasks[0].progress;
  scheduler.syncViewport([{ ...tasks[0], rect: { x: 20, y: 25, width: 170, height: 30 } }], { viewport: { width: 640, height: 420 } });
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.tasks[0].progress, progress);
  assert.equal(snapshot.agents.length, 36);
  assert.ok(snapshot.agents.every((agent) => agent.position.x <= 620 && agent.position.y <= 396));
});
