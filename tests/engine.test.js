import test from 'node:test';
import assert from 'node:assert/strict';
import { RebuildScheduler, textRevealAt, isVisibleBuildArea, estimateTaskDuration, buildRectsOverlap } from '../src/engine/engine.js';

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

test('a typical mixed viewport leaves readable gestures and finishes in about two seconds at 1x', () => {
  const { scheduler, advance, now } = fixture({ introDuration: 140 });
  const viewport = Array.from({ length: 48 }, (_, index) => ({
    id: `element-${index}`,
    kind: ['box', 'text', 'text', 'image'][index % 4],
    regionId: `column-${index % 4}`,
    regionRect: { x: index % 4 * 220, y: 0, width: 220, height: 600 },
    textLength: 120,
    fontSize: 14,
    lineHeight: 18,
    rect: { x: index % 4 * 220 + 20, y: Math.floor(index / 4) * 46 + 10, width: 180, height: 36 },
  }));
  scheduler.start(viewport);
  while (!scheduler.snapshot().viewportComplete && now() < 10000) advance(16);
  assert.ok(now() >= 1800 && now() <= 2600, `Completed at ${now()} ms`);
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
  const second = { ...first, id: 'second', rect: { ...first.rect, y: 100 } };
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

test('independent durations follow operation and content size rather than viewport task count', () => {
  const title = { kind: 'text', rect: { width: 240, height: 32 }, textLength: 12, fontSize: 28, lineHeight: 32, isHeading: true };
  const paragraph = { kind: 'text', rect: { width: 400, height: 100 }, textLength: 200, fontSize: 14, lineHeight: 20 };
  assert.ok(estimateTaskDuration(title) < estimateTaskDuration(paragraph));
  assert.ok(estimateTaskDuration(title) <= 510);
  for (const task of [title, paragraph, { kind: 'box', rect: { width: 140, height: 30 } }, { kind: 'image', rect: { width: 640, height: 240 } }, { kind: 'line', rect: { width: 640, height: 1 } }]) {
    assert.ok(estimateTaskDuration(task) >= 210 && estimateTaskDuration(task) <= 990);
  }
  assert.equal(estimateTaskDuration({ ...paragraph, duration: 123 }), 123);
});

test('agents reserve unique tasks inside their assigned semantic regions', () => {
  const { scheduler, advance, tasks } = fixture();
  const blueprint = Array.from({ length: 8 }, (_, index) => ({ ...tasks[0], id: `task-${index}`, regionId: index < 4 ? 'sidebar' : 'document', regionLabel: index < 4 ? '导航' : '正文', regionRect: { x: index < 4 ? 0 : 300, y: 0, width: index < 4 ? 260 : 600, height: 600 }, rect: { x: index < 4 ? 20 : 340, y: 20 + index % 4 * 100, width: 180, height: 30 } }));
  scheduler.start(blueprint, { intro: false });
  advance(160);
  const snapshot = scheduler.snapshot();
  const running = snapshot.tasks.filter((task) => task.status === 'running');
  assert.ok(running.length >= 2);
  assert.equal(new Set(running.map((task) => task.agentIndex)).size, running.length);
  running.forEach((task) => {
    const agent = snapshot.agents[task.agentIndex];
    assert.equal(agent.regionId, task.regionId);
    assert.equal(agent.taskId, task.id);
    assert.equal(agent.operation, 'type');
  });
  snapshot.agents.filter((agent) => !agent.taskId).forEach((agent) => {
    assert.ok(agent.position.x >= agent.regionRect.x && agent.position.x <= agent.regionRect.x + agent.regionRect.width);
  });
});

test('spatial locks serialize overlapping rectangles even across different semantic regions', () => {
  const { scheduler, advance, tasks } = fixture();
  const first = { ...tasks[0], id: 'overlay-box', kind: 'box', duration: 300, regionId: 'layout' };
  const second = { ...tasks[0], id: 'overlay-text', duration: 300, regionId: 'text' };
  assert.equal(buildRectsOverlap(first, second), true);
  scheduler.start([first, second], { intro: false });
  advance(160);
  assert.equal(scheduler.snapshot().tasks.filter((task) => task.status === 'running').length, 1);
  advance(160);
  assert.equal(scheduler.snapshot().tasks.filter((task) => task.status === 'complete').length, 1);
  assert.equal(scheduler.snapshot().tasks.filter((task) => task.status === 'running').length, 1);
  advance(400);
  assert.equal(scheduler.snapshot().viewportComplete, true);
});

test('new semantic regions recruit idle agents without changing a running task owner', () => {
  const { scheduler, advance, tasks } = fixture();
  const first = { ...tasks[0], regionId: 'left', regionRect: { x: 0, y: 0, width: 300, height: 600 } };
  scheduler.start([first], { intro: false });
  advance(160);
  const before = scheduler.snapshot().tasks[0];
  scheduler.syncViewport([first, { ...tasks[0], id: 'new-right', regionId: 'right', regionRect: { x: 320, y: 0, width: 580, height: 600 }, rect: { x: 350, y: 100, width: 200, height: 30 } }]);
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.tasks[0].agentIndex, before.agentIndex);
  assert.equal(snapshot.tasks[0].progress, before.progress);
  assert.equal(snapshot.agents[before.agentIndex].regionId, 'left');
  assert.ok(snapshot.agents.some((agent) => agent.regionId === 'right'));
});

test('box cursors trace the perimeter while text and image preserve their own action stages', () => {
  const { scheduler } = fixture();
  const task = { kind: 'box', rect: { x: 10, y: 20, width: 100, height: 50 } };
  const halfwayAcrossTop = scheduler.positionFor({ ...task, progress: 0.17 + 0.72 / 6 }, { x: 10, y: 20 });
  const bottomRight = scheduler.positionFor({ ...task, progress: 0.17 + 0.72 / 2 }, { x: 10, y: 20 });
  assert.ok(Math.abs(halfwayAcrossTop.x - 60) < 0.001);
  assert.equal(halfwayAcrossTop.y, 20);
  assert.ok(Math.abs(bottomRight.x - 110) < 0.001);
  assert.ok(Math.abs(bottomRight.y - 70) < 0.001);
});


test('one large semantic region runs distinct content owners in parallel', () => {
  const { scheduler, advance, tasks } = fixture();
  const blueprint = Array.from({ length: 18 }, (_, index) => ({
    ...tasks[0], id: `leaf-${index}`, regionId: 'article',
    regionRect: { x: 0, y: 0, width: 900, height: 600 },
    rect: { x: index % 3 * 280 + 20, y: Math.floor(index / 3) * 80 + 20, width: 240, height: 30 },
  }));
  scheduler.start(blueprint, { intro: false });
  advance(160);
  const snapshot = scheduler.snapshot();
  const running = snapshot.tasks.filter((task) => task.status === 'running');
  assert.equal(running.length, blueprint.length, 'Unrelated content should not wait for a regional worker cap');
  assert.equal(new Set(running.map((task) => task.ownerIndex)).size, running.length);
  running.forEach((task) => {
    assert.equal(task.agentIndex, task.ownerIndex);
    assert.equal(snapshot.agents[task.ownerIndex].anchorTaskId, task.id);
    assert.deepEqual(snapshot.agents[task.ownerIndex].workRect, task.rect);
  });
  scheduler.syncViewport(blueprint.map((task) => ({ ...task, rect: { ...task.rect, y: task.rect.y - 10 } })));
  assert.deepEqual(scheduler.snapshot().tasks.map((task) => task.ownerIndex), snapshot.tasks.map((task) => task.ownerIndex));
});

test('owners stay with their blocks through completion, replay and newly scrolled content', () => {
  const { scheduler, advance, tasks } = fixture();
  const first = { ...tasks[0], id: 'first', regionId: 'left', rect: { x: 20, y: 20, width: 200, height: 30 } };
  const second = { ...tasks[0], id: 'second', regionId: 'right', rect: { x: 400, y: 20, width: 200, height: 30 } };
  scheduler.start([first, second], { intro: false });
  const owners = scheduler.snapshot().tasks.map((task) => task.ownerIndex);
  advance(1200);
  const completed = scheduler.snapshot();
  assert.notDeepEqual(completed.agents[owners[0]].workRect, completed.agents[owners[1]].workRect);
  scheduler.syncViewport([first, second, { ...second, id: 'third', rect: { ...second.rect, y: 100 } }]);
  scheduler.replayVisible();
  assert.deepEqual(scheduler.snapshot().tasks.slice(0, 2).map((task) => task.ownerIndex), owners);
  advance(1200);
  assert.equal(scheduler.snapshot().viewportComplete, true);
});

test('a dense file viewport stays under two and a half seconds and does not starve regions beyond the agent count', () => {
  const { scheduler, advance, now } = fixture({ introDuration: 140 });
  const blueprint = Array.from({ length: 105 }, (_, index) => ({
    id: `file-cell-${index}`,
    kind: index % 5 === 0 ? 'box' : 'text',
    textLength: index % 5 === 1 ? 12 : 6,
    lineHeight: 20, fontSize: 13,
    regionId: `row-${Math.floor(index / 5)}`,
    regionRect: { x: 0, y: Math.floor(index / 5) * 26, width: 900, height: 26 },
    rect: { x: index % 5 * 175 + 20, y: Math.floor(index / 5) * 26, width: 130, height: 20 },
  }));
  scheduler.start(blueprint);
  while (!scheduler.snapshot().viewportComplete && now() < 5000) {
    advance(16);
    const running = scheduler.snapshot().tasks.filter((task) => task.status === 'running');
    assert.ok(running.length <= 24);
    running.forEach((task, index) => running.slice(index + 1).forEach((other) => assert.equal(buildRectsOverlap(task, other), false)));
  }
  // Lower bound catches gestures becoming too brief; upper bound catches queued-work stalls.
  assert.ok(now() >= 1600 && now() <= 2500, `Completed at ${now()} ms`);
  assert.equal(scheduler.snapshot().viewportComplete, true);
  const extra = Array.from({ length: 48 }, (_, index) => ({ ...blueprint[index], id: `extra-${index}`, regionId: `unique-region-${index}` }));
  scheduler.syncViewport(extra);
  advance(2000);
  assert.equal(scheduler.snapshot().viewportComplete, true, 'All 48 regions must receive a worker');
  assert.equal(scheduler.snapshot().agents.length, 36);
});
