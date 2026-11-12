export const BUILD_SPEEDS = [0.5, 1, 2, 3];
export const AGENT_COLORS = ['#00b6a1', '#48b22c', '#e6ac00', '#a65df4', '#f56b72', '#2e83ff', '#8552eb', '#ee982e'];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (value) => 1 - Math.pow(1 - clamp(value), 3);
const weights = { text: 1.2, image: 1.5, box: 1, line: 0.7 };

export function isVisibleBuildArea(rect, kind = 'box') {
  const width = rect.width ?? rect.right - rect.left;
  const height = rect.height ?? rect.bottom - rect.top;
  return kind === 'line' ? width >= 0.5 && height >= 0.5 : width > 2 && height > 2;
}

/** The same line geometry drives the DOM reveal, text caret, and agent position. */
export function textRevealAt(task, progress) {
  const { width, height } = task.rect;
  const lineHeight = Math.max(1, task.lineHeight || height);
  const count = Math.max(1, Math.round(height / lineHeight));
  const lines = task.textLines?.length ? task.textLines : Array.from({ length: count }, (_, index) => ({
    left: 0,
    top: index * lineHeight,
    width,
    height: Math.min(lineHeight, height - index * lineHeight),
  }));
  const totalWidth = lines.reduce((sum, line) => sum + Math.max(1, line.width), 0);
  let remaining = clamp(progress) * totalWidth;
  let index = 0;
  while (index < lines.length - 1 && remaining >= Math.max(1, lines[index].width)) {
    remaining -= Math.max(1, lines[index].width);
    index += 1;
  }
  const line = lines[index];
  const x = clamp(line.left + Math.min(line.width, remaining), 0, width);
  const top = index === 0 ? 0 : (lines[index - 1].top + lines[index - 1].height + line.top) / 2;
  const bottom = index === lines.length - 1 ? height : (line.top + line.height + lines[index + 1].top) / 2;
  return {
    lineIndex: index,
    x,
    y: clamp(line.top, 0, height),
    height: Math.max(1, Math.min(line.height, lineHeight, height - line.top)),
    clipPath: progress >= 1 ? 'inset(0)' : `polygon(0 0, ${width}px 0, ${width}px ${top}px, ${x}px ${top}px, ${x}px ${bottom}px, 0 ${bottom}px)`,
  };
}

/** A deterministic animation clock. DOM work and requestAnimationFrame live outside it. */
export class RebuildScheduler {
  constructor({ now = () => performance.now(), agentCount = 36, duration = 14000, introDuration = 500, maxDelta = 64 } = {}) {
    this.now = now;
    this.agentCount = agentCount;
    this.duration = duration;
    this.introDuration = introDuration;
    this.maxDelta = maxDelta;
    this.speed = 1;
    this.revision = 0;
    this.state = 'idle';
    this.virtualTime = 0;
    this.tasks = [];
    this.lastRealTime = null;
    this.origin = { x: 400, y: 160 };
    this.viewport = { width: 900, height: 600 };
    this.agents = [];
  }

  start(blueprint, { now = this.now(), intro = true, completedIds = [], paused = false, origin = this.origin, viewport = this.viewport } = {}) {
    this.revision += 1;
    this.origin = origin;
    this.viewport = viewport;
    this.virtualTime = 0;
    this.lastRealTime = now;
    this.introEnds = intro ? this.introDuration : 0;
    const complete = new Set(completedIds);
    const ids = new Set();
    this.tasks = blueprint.filter((task) => {
      if (ids.has(task.id) || task.visible === false) return false;
      ids.add(task.id);
      return true;
    }).map((task, order) => ({
      ...task,
      order,
      revision: this.revision,
      visible: true,
      status: complete.has(task.id) ? 'complete' : 'queued',
      progress: complete.has(task.id) ? 1 : 0,
      agentIndex: null,
      startedAt: null,
    }));

    // Keep the first viewport around fourteen seconds, even with a larger swarm.
    const pending = this.tasks.filter((task) => task.status !== 'complete');
    const laneCount = Math.max(1, Math.min(this.agentCount, pending.length));
    const loads = Array(laneCount).fill(0);
    const counts = Array(laneCount).fill(0);
    pending.forEach((task) => {
      const lane = loads.indexOf(Math.min(...loads));
      loads[lane] += weights[task.kind] || 1;
      counts[lane] += 1;
    });
    this.durationUnit = Math.max(500, (this.duration - this.introEnds - (laneCount - 1) * 35 - (Math.max(...counts) - 1) * 100) / Math.max(1, ...loads));
    this.tasks.forEach((task) => { task.duration = task.duration ?? Math.max(500, this.durationUnit * (weights[task.kind] || 1)); });
    this.agents = Array.from({ length: this.agentCount }, (_, index) => ({
      index,
      taskId: null,
      position: { ...origin },
      from: { ...origin },
      availableAt: this.introEnds + index * 35,
      phase: 'assist',
    }));
    this.resumeState = this.introEnds ? 'intro' : 'running';
    this.state = paused ? 'paused' : this.resumeState;
    if (this.state === 'running') this.assignTasks();
    this.refreshAgentPositions(true);
    return this.revision;
  }

  /** Merge viewport geometry without resetting the clock, task progress, or scene revision. */
  syncViewport(blueprint, { viewport = this.viewport } = {}) {
    if (this.state === 'idle') return;
    this.viewport = viewport;
    const byId = new Map(this.tasks.map((task) => [task.id, task]));
    this.tasks.forEach((task) => { task.visible = false; });
    blueprint.forEach((entry) => {
      const task = byId.get(entry.id);
      if (task) {
        const dx = entry.rect.x - task.rect.x;
        const dy = entry.rect.y - task.rect.y;
        const agent = this.agents[task.agentIndex];
        if (agent?.taskId === task.id) agent.from = { x: agent.from.x + dx, y: agent.from.y + dy };
        for (const key of ['rect', 'clip', 'lineHeight', 'textLines', 'kind', 'parentId']) {
          if (entry[key] !== undefined) task[key] = entry[key];
        }
        task.visible = entry.visible !== false;
      } else if (entry.visible !== false && !byId.has(entry.id)) {
        const added = {
          ...entry,
          visible: true,
          order: this.tasks.length,
          revision: this.revision,
          status: 'queued',
          progress: 0,
          agentIndex: null,
          startedAt: null,
          duration: entry.duration ?? Math.max(500, this.durationUnit * (weights[entry.kind] || 1)),
        };
        this.tasks.push(added);
        byId.set(added.id, added);
      }
    });
    if (this.state === 'running') this.assignTasks();
    this.refreshAgentPositions();
  }

  replayVisible(realTime = this.now()) {
    if (this.state === 'idle') return;
    this.tick(realTime);
    this.revision += 1;
    const visibleIds = new Set(this.tasks.filter((task) => task.visible).map((task) => task.id));
    this.tasks.forEach((task) => {
      task.revision = this.revision;
      if (visibleIds.has(task.id)) Object.assign(task, { status: 'queued', progress: 0, startedAt: null, agentIndex: null });
    });
    this.agents.forEach((agent) => {
      if (visibleIds.has(agent.taskId)) { agent.taskId = null; agent.availableAt = this.virtualTime + agent.index * 20; }
    });
    this.state = 'running';
    this.resumeState = 'running';
    this.introEnds = 0;
    this.lastRealTime = realTime;
    this.assignTasks();
    this.refreshAgentPositions();
  }

  tick(realTime = this.now(), expectedRevision = this.revision) {
    if (expectedRevision !== this.revision) return this.snapshot();
    if (this.lastRealTime === null) this.lastRealTime = realTime;
    const delta = clamp(realTime - this.lastRealTime, 0, this.maxDelta);
    this.lastRealTime = realTime;
    if (!['intro', 'running'].includes(this.state)) return this.snapshot();
    this.virtualTime += delta * this.speed;
    if (this.state === 'intro' && this.virtualTime >= this.introEnds) {
      this.state = 'running';
    }
    if (this.state === 'running') {
      this.tasks.forEach((task) => {
        if (task.status !== 'running') return;
        task.progress = clamp((this.virtualTime - task.startedAt) / task.duration);
        const agent = this.agents[task.agentIndex];
        if (task.progress >= 1) {
          task.status = 'complete';
          agent.taskId = null;
          agent.availableAt = this.virtualTime + 100;
        }
      });
      this.assignTasks();
    }
    this.refreshAgentPositions();
    return this.snapshot();
  }

  assignTasks() {
    const byId = new Map(this.tasks.map((task) => [task.id, task]));
    this.agents.forEach((agent) => {
      if (agent.taskId || this.virtualTime < agent.availableAt) return;
      const task = this.tasks.find((candidate) => candidate.visible && candidate.status === 'queued' && (!candidate.parentId || !byId.has(candidate.parentId) || byId.get(candidate.parentId).status === 'complete'));
      if (!task) return;
      task.status = 'running';
      task.startedAt = this.virtualTime;
      task.agentIndex = agent.index;
      agent.taskId = task.id;
      agent.from = { ...agent.position };
    });
  }

  hoverPosition(index) {
    const fraction = (value) => value - Math.floor(value);
    const seed = (offset) => fraction(Math.sin((index + 1) * 127.1 + offset * 311.7) * 43758.5453);
    // A stable low-discrepancy scatter avoids rows, columns, and repeated color bands.
    const u = clamp(fraction(0.19 + (index + 1) * 0.7548776662) + (seed(1) - 0.5) * 0.07, 0.025, 0.975);
    const v = clamp(fraction(0.37 + (index + 1) * 0.5698402910) + (seed(2) - 0.5) * 0.07, 0.025, 0.975);
    const usableWidth = Math.max(100, this.viewport.width - 84);
    const usableHeight = Math.max(100, this.viewport.height - 110);
    const time = this.virtualTime / 1000;
    const phase = seed(3) * Math.PI * 2;
    const frequency = 0.25 + seed(4) * 0.32;
    const driftX = (8 + seed(5) * 12) * (Math.sin(time * frequency + phase) + 0.25 * Math.cos(time * frequency * 0.61 + phase * 1.7));
    const driftY = (6 + seed(6) * 10) * Math.cos(time * frequency * 0.77 + phase * 0.83);
    return {
      x: clamp(36 + u * usableWidth + driftX, 16, this.viewport.width - 24),
      y: clamp(48 + v * usableHeight + driftY, 20, this.viewport.height - 32),
    };
  }

  refreshAgentPositions(force = false) {
    if (this.state === 'paused' && !force) return;
    const isIntro = this.state === 'intro' || (this.state === 'paused' && this.resumeState === 'intro');
    const byId = new Map(this.tasks.map((task) => [task.id, task]));
    this.agents.forEach((agent) => {
      if (isIntro) {
        const ring = Math.floor(agent.index / 12);
        const angle = agent.index % 12 / 12 * Math.PI * 2 + this.virtualTime / 600 + ring * 0.2;
        const radius = 55 + ring * 46;
        agent.position = { x: this.origin.x + Math.cos(angle) * radius, y: this.origin.y + Math.sin(angle) * radius * 0.58 };
        agent.phase = 'intro';
        return;
      }
      const task = byId.get(agent.taskId);
      const position = task?.visible ? this.positionFor(task, agent.from) : null;
      const withinViewport = position && position.x >= 10 && position.x <= this.viewport.width - 20 && position.y >= 10 && position.y <= this.viewport.height - 24;
      const withinClip = position && (!task.clip || task.progress < 0.17 || (position.x >= task.clip.x - 2 && position.x <= task.clip.x + task.clip.width + 2 && position.y >= task.clip.y - 2 && position.y <= task.clip.y + task.clip.height + 2));
      if (withinViewport && withinClip) { agent.position = position; agent.phase = 'build'; }
      else { agent.position = this.hoverPosition(agent.index); agent.phase = 'assist'; }
    });
  }

  positionFor(task, from) {
    const rect = task.rect;
    const entry = { x: rect.x, y: rect.y };
    if (task.progress < 0.17) {
      const t = ease(task.progress / 0.17);
      return { x: from.x + (entry.x - from.x) * t, y: from.y + (entry.y - from.y) * t };
    }
    const reveal = clamp((task.progress - 0.17) / 0.72);
    if (task.kind === 'text') {
      const caret = textRevealAt(task, reveal);
      return { x: rect.x + caret.x, y: rect.y + caret.y + caret.height * 0.8 };
    }
    if (task.kind === 'image') {
      if (task.progress < 0.3) {
        const drag = clamp((task.progress - 0.17) / 0.13);
        return { x: rect.x + rect.width * drag, y: rect.y + rect.height * drag };
      }
      return { x: rect.x + rect.width, y: rect.y + rect.height };
    }
    return { x: rect.x + rect.width * reveal, y: rect.y + rect.height * reveal };
  }

  setSpeed(speed, realTime = this.now()) {
    if (!BUILD_SPEEDS.includes(speed)) return;
    this.tick(realTime);
    this.speed = speed;
  }

  pause(realTime = this.now()) {
    if (!['intro', 'running'].includes(this.state)) return;
    this.tick(realTime);
    this.resumeState = this.state;
    this.state = 'paused';
  }

  resume(realTime = this.now()) {
    if (this.state !== 'paused') return;
    this.lastRealTime = realTime;
    this.state = this.resumeState || 'running';
    if (this.state === 'running') this.assignTasks();
    this.refreshAgentPositions();
  }

  resetRealTime(realTime = this.now()) { this.lastRealTime = realTime; }

  exit() {
    this.revision += 1;
    this.state = 'idle';
    this.tasks = [];
    this.agents = [];
    this.virtualTime = 0;
    this.lastRealTime = null;
  }

  snapshot() {
    const visibleTasks = this.tasks.filter((task) => task.visible);
    const workingCount = this.tasks.filter((task) => task.visible && task.status === 'running').length;
    return {
      state: this.state,
      speed: this.speed,
      revision: this.revision,
      virtualTime: this.virtualTime,
      tasks: this.tasks.map((task) => ({ ...task })),
      agents: this.state === 'idle' ? [] : this.agents.map((agent) => ({
        ...agent,
        color: AGENT_COLORS[agent.index % AGENT_COLORS.length],
        introProgress: clamp(this.virtualTime / Math.max(1, this.introEnds)),
      })),
      completed: visibleTasks.filter((task) => task.status === 'complete').length,
      total: visibleTasks.length,
      viewportComplete: visibleTasks.every((task) => task.status === 'complete'),
      workingCount: this.state === 'paused' ? 0 : workingCount,
      agentCount: this.agentCount,
      activeCount: ['paused', 'idle'].includes(this.state) ? 0 : this.agents.length,
    };
  }
}
