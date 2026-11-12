export const BUILD_SPEEDS = [0.5, 1, 2, 3];
export const AGENT_COLORS = ['#00b6a1', '#48b22c', '#e6ac00', '#a65df4', '#f56b72', '#2e83ff', '#8552eb', '#ee982e'];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (value) => 1 - Math.pow(1 - clamp(value), 3);
const operations = { text: 'type', image: 'image', box: 'layout', line: 'line' };
// Give each gesture time to read while retaining independent, parallel actions.
const ACTION_DURATION_SCALE = 1.5;

export function estimateTaskDuration(task) {
  if (Number.isFinite(task.duration) && task.duration > 0) return task.duration;
  const { width, height } = task.rect;
  if (task.kind === 'text') {
    const lineHeight = task.lineHeight || height;
    const lines = Math.max(1, task.textLines?.length || Math.round(height / Math.max(1, lineHeight)));
    const textWidth = task.textLines?.reduce((sum, line) => sum + line.width, 0) || width * lines;
    const length = task.textLength || textWidth / Math.max(7, (task.fontSize || lineHeight * 0.7) * 0.65);
    if (task.isHeading || ((task.fontSize || 0) >= 24 && lines <= 2)) return ACTION_DURATION_SCALE * clamp(150 + Math.min(170, length * 7), 170, 340);
    return ACTION_DURATION_SCALE * clamp(160 + Math.sqrt(length) * 23 + lines * 16, 190, 620);
  }
  if (task.kind === 'image') return ACTION_DURATION_SCALE * clamp(390 + Math.sqrt(width * height) * 0.45, 430, 660);
  if (task.kind === 'line') return ACTION_DURATION_SCALE * clamp(100 + Math.max(width, height) * 0.15, 140, 260);
  return ACTION_DURATION_SCALE * clamp(110 + Math.sqrt(width * height) * 0.28 + (width + height) * 0.06, 140, 360);
}

export function buildRectsOverlap(first, second) {
  const a = first.clip || first.rect;
  const b = second.clip || second.rect;
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
}

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
  constructor({ now = () => performance.now(), agentCount = 36, introDuration = 140, maxDelta = 64 } = {}) {
    this.now = now;
    this.agentCount = agentCount;
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
    this.regions = new Map();
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
      regionId: task.regionId || 'content',
      regionLabel: task.regionLabel || '内容',
      status: complete.has(task.id) ? 'complete' : 'queued',
      progress: complete.has(task.id) ? 1 : 0,
      agentIndex: null,
      ownerIndex: null,
      startedAt: null,
    }));

    this.tasks.forEach((task) => { task.duration = estimateTaskDuration(task); });
    this.regions.clear();
    this.updateRegions(blueprint);
    this.agents = Array.from({ length: this.agentCount }, (_, index) => ({
      index,
      taskId: null,
      position: { ...origin },
      from: { ...origin },
      availableAt: this.introEnds,
      phase: 'assist',
      operation: 'assist',
      regionId: null,
      regionLabel: '',
      regionRect: null,
      workRect: null,
      anchorTaskId: null,
    }));
    this.allocateRegions();
    this.resumeState = this.introEnds ? 'intro' : 'running';
    this.state = paused ? 'paused' : this.resumeState;
    this.refreshAgentPositions(true);
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
        for (const key of ['rect', 'clip', 'lineHeight', 'textLines', 'textLength', 'fontSize', 'isHeading', 'kind', 'parentId', 'regionId', 'regionLabel', 'regionRect', 'taskLabel']) {
          if (entry[key] !== undefined) task[key] = entry[key];
        }
        task.visible = entry.visible !== false;
      } else if (entry.visible !== false && !byId.has(entry.id)) {
        const added = {
          ...entry,
          visible: true,
          order: this.tasks.length,
          revision: this.revision,
          regionId: entry.regionId || 'content',
          regionLabel: entry.regionLabel || '内容',
          status: 'queued',
          progress: 0,
          agentIndex: null,
          ownerIndex: null,
          startedAt: null,
          duration: estimateTaskDuration(entry),
        };
        this.tasks.push(added);
        byId.set(added.id, added);
      }
    });
    this.updateRegions(blueprint);
    this.allocateRegions();
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
      if (visibleIds.has(agent.taskId)) { agent.taskId = null; agent.availableAt = this.virtualTime; }
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
          agent.availableAt = this.virtualTime + 18;
        }
      });
      this.assignTasks();
    }
    this.refreshAgentPositions();
    return this.snapshot();
  }

  assignTasks() {
    this.allocateRegions();
    const byId = new Map(this.tasks.map((task) => [task.id, task]));
    const running = this.tasks.filter((task) => task.status === 'running' && task.visible);
    this.agents.forEach((agent) => {
      if (agent.taskId || this.virtualTime < agent.availableAt || running.length >= 24) return;
      const available = this.tasks.filter((candidate) => candidate.ownerIndex === agent.index && candidate.visible && candidate.status === 'queued' && (!candidate.parentId || !byId.has(candidate.parentId) || byId.get(candidate.parentId).status === 'complete') && !running.some((other) => buildRectsOverlap(candidate, other)));
      available.sort((a, b) => {
        const distance = (task) => Math.hypot(task.rect.x - agent.position.x, task.rect.y - agent.position.y);
        return distance(a) - distance(b) || a.order - b.order;
      });
      const task = available[0];
      if (!task) return;
      task.status = 'running';
      task.startedAt = this.virtualTime;
      task.agentIndex = agent.index;
      agent.taskId = task.id;
      agent.anchorTaskId = task.id;
      agent.from = { ...agent.position };
      this.setAgentArea(agent, task);
      agent.operation = operations[task.kind] || 'layout';
      running.push(task);
    });
  }

  updateRegions(blueprint) {
    this.regions.forEach((region) => { region.visible = false; region.taskCount = 0; });
    blueprint.forEach((task) => {
      if (task.visible === false) return;
      const id = task.regionId || 'content';
      const rect = task.regionRect || { x: 0, y: 0, width: this.viewport.width, height: this.viewport.height };
      let region = this.regions.get(id);
      if (!region) {
        region = { id, label: task.regionLabel || '内容', rect, order: this.regions.size, taskCount: 0, visible: false };
        this.regions.set(id, region);
      }
      region.label = task.regionLabel || region.label;
      region.rect = rect;
      region.visible = true;
      region.taskCount += 1;
    });
    if (!this.regions.size) this.regions.set('content', { id: 'content', label: '内容', rect: { x: 0, y: 0, width: this.viewport.width, height: this.viewport.height }, order: 0, visible: true, taskCount: 0 });
    this.agents.forEach((agent) => {
      const region = this.regions.get(agent.regionId);
      if (region) { agent.regionLabel = region.label; agent.regionRect = { ...region.rect }; }
    });
  }

  setAgentArea(agent, task) {
    const region = this.regions.get(task.regionId);
    agent.regionId = task.regionId;
    agent.regionLabel = task.regionLabel;
    agent.regionRect = { ...(region?.rect || task.regionRect || task.rect) };
    agent.workRect = { ...(task.clip || task.rect) };
  }

  /** Reserve each content block once. Scrolling changes geometry, never ownership. */
  allocateRegions() {
    if (!this.agents.length) return;
    const pending = this.tasks.filter((task) => task.visible && task.ownerIndex == null);
    const workloads = this.agents.map((agent) => this.tasks.reduce((sum, task) => sum + (task.ownerIndex === agent.index && task.status !== 'complete' && (task.visible || task.status === 'running') ? task.duration * (1 - task.progress) : 0), 0));
    const homes = this.agents.map((agent) => this.tasks.find((task) => task.ownerIndex === agent.index && task.visible) || null);
    // Interleave semantic regions so the first wave reaches the entire viewport.
    const queues = new Map();
    pending.forEach((task) => {
      if (!queues.has(task.regionId)) queues.set(task.regionId, []);
      queues.get(task.regionId).push(task);
    });
    const ordered = [];
    while ([...queues.values()].some((queue) => queue.length)) {
      queues.forEach((queue) => { if (queue.length) ordered.push(queue.shift()); });
    }
    ordered.forEach((task) => {
      const score = (agent) => {
        const home = homes[agent.index];
        const point = home?.rect || agent.position;
        const distance = Math.hypot(task.rect.x - point.x, task.rect.y - point.y);
        return workloads[agent.index] + distance * 0.12 + (home && home.regionId !== task.regionId ? 65 : 0);
      };
      const owner = [...this.agents].sort((a, b) => score(a) - score(b) || a.index - b.index)[0];
      task.ownerIndex = owner.index;
      workloads[owner.index] += task.status === 'complete' ? 0 : task.duration;
      homes[owner.index] ||= task;
    });

    const byId = new Map(this.tasks.map((task) => [task.id, task]));
    const standby = [];
    const counts = new Map();
    this.agents.forEach((agent) => {
      const owned = this.tasks.filter((task) => task.visible && task.ownerIndex === agent.index);
      const previous = byId.get(agent.anchorTaskId);
      const active = byId.get(agent.taskId);
      const anchor = active?.visible ? active : owned.find((task) => task.status === 'queued') || (previous?.visible && previous.ownerIndex === agent.index ? previous : owned.at(-1));
      if (anchor) {
        agent.anchorTaskId = anchor.id;
        if (!active || active.visible) this.setAgentArea(agent, anchor);
        counts.set(anchor.regionId, (counts.get(anchor.regionId) || 0) + 1);
      } else standby.push(agent);
    });
    const visible = [...this.regions.values()].filter((region) => region.visible);
    const fallback = { id: 'content', label: '内容', rect: { x: 0, y: 0, width: this.viewport.width, height: this.viewport.height } };
    // Extra pointers keep separate interior stations instead of tracing one perimeter.
    standby.forEach((agent) => {
      const region = [...visible].sort((a, b) => b.rect.width * b.rect.height / ((counts.get(b.id) || 0) + 1) - a.rect.width * a.rect.height / ((counts.get(a.id) || 0) + 1))[0] || fallback;
      const station = counts.get(region.id) || 0;
      counts.set(region.id, station + 1);
      const bounds = region.rect;
      const fraction = (value) => value - Math.floor(value);
      const x = bounds.x + bounds.width * (0.12 + fraction((agent.index + 1) * 0.61803398875) * 0.76);
      const y = bounds.y + bounds.height * (0.12 + fraction((agent.index + 1) * 0.38196601125 + station * 0.17) * 0.76);
      agent.standbyRect = { x: x - 3, y: y - 3, width: 6, height: 6 };
      if (!agent.taskId) {
        agent.anchorTaskId = null;
        agent.regionId = region.id;
        agent.regionLabel = region.label;
        agent.regionRect = { ...bounds };
        agent.workRect = agent.standbyRect;
      }
    });
  }

  hoverPosition(index) {
    const agent = this.agents[index];
    const anchor = this.tasks.find((task) => task.id === agent.anchorTaskId && task.visible);
    const bounds = anchor ? anchor.clip || anchor.rect : agent.standbyRect || agent.workRect || { x: this.origin.x, y: this.origin.y, width: 1, height: 1 };
    const time = this.virtualTime / 1000;
    const phase = (index + 1) * 2.39996323;
    const x = bounds.x + bounds.width * 0.5 + Math.min(2, bounds.width * 0.08) * Math.sin(time * 0.7 + phase);
    const y = bounds.y + bounds.height * 0.5 + Math.min(1.5, bounds.height * 0.08) * Math.cos(time * 0.5 + phase);
    return {
      x: clamp(x, 16, this.viewport.width - 24),
      y: clamp(y, 20, this.viewport.height - 32),
    };
  }

  refreshAgentPositions(force = false) {
    if (this.state === 'paused' && !force) return;
    const isIntro = this.state === 'intro' || (this.state === 'paused' && this.resumeState === 'intro');
    const byId = new Map(this.tasks.map((task) => [task.id, task]));
    this.agents.forEach((agent) => {
      if (isIntro) {
        agent.position = this.hoverPosition(agent.index);
        agent.phase = 'intro';
        agent.operation = 'assist';
        return;
      }
      const task = byId.get(agent.taskId);
      const position = task?.visible ? this.positionFor(task, agent.from) : null;
      const withinViewport = position && position.x >= 10 && position.x <= this.viewport.width - 20 && position.y >= 10 && position.y <= this.viewport.height - 24;
      const withinClip = position && (!task.clip || task.progress < 0.17 || (position.x >= task.clip.x - 2 && position.x <= task.clip.x + task.clip.width + 2 && position.y >= task.clip.y - 2 && position.y <= task.clip.y + task.clip.height + 2));
      if (withinViewport && withinClip) { agent.position = position; agent.phase = 'build'; agent.operation = operations[task.kind] || 'layout'; }
      else { agent.position = this.hoverPosition(agent.index); agent.phase = 'assist'; agent.operation = 'assist'; }
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
    if (task.kind === 'line') return rect.width >= rect.height ? { x: rect.x + rect.width * reveal, y: rect.y + rect.height } : { x: rect.x + rect.width, y: rect.y + rect.height * reveal };
    const perimeter = (rect.width + rect.height) * 2;
    let distance = perimeter * reveal;
    if (distance <= rect.width) return { x: rect.x + distance, y: rect.y };
    distance -= rect.width;
    if (distance <= rect.height) return { x: rect.x + rect.width, y: rect.y + distance };
    distance -= rect.height;
    if (distance <= rect.width) return { x: rect.x + rect.width - distance, y: rect.y + rect.height };
    return { x: rect.x, y: rect.y + rect.height - (distance - rect.width) };
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
    this.regions.clear();
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
