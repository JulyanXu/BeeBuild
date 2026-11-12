import { useEffect, useMemo, useRef, useState } from 'react';
import { RebuildScheduler, textRevealAt, isVisibleBuildArea } from './engine.js';

const intersect = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });

class RebuildController {
  constructor() {
    this.scheduler = new RebuildScheduler();
    this.root = null;
    this.records = new Map();
    this.scrolling = false;
    this.geometryDirty = false;
    this.raf = null;
    this.scrollTimer = null;
    this.lastPublish = 0;
    this.onChange = null;
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onFrame = this.onFrame.bind(this);
    this.onVisibility = () => this.scheduler.resetRealTime();
  }

  mount(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    root?.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.onResize);
    if (root) this.observer?.observe(root);
    this.publish();
  }

  snapshot() {
    return { ...this.scheduler.snapshot(), scrolling: this.scrolling };
  }

  publish() { this.onChange?.(this.snapshot()); }

  collect() {
    if (!this.root) return [];
    const rootRect = this.root.getBoundingClientRect();
    const rootClip = { left: rootRect.left + this.root.clientLeft, top: rootRect.top + this.root.clientTop, right: rootRect.left + this.root.clientLeft + this.root.clientWidth, bottom: rootRect.top + this.root.clientTop + this.root.clientHeight };
    const blueprint = [];
    const regions = new Map();
    const regionBounds = new Map();
    const visibleRegionBounds = (regionElement) => {
      if (regionBounds.has(regionElement)) return regionBounds.get(regionElement);
      let bounds = intersect(regionElement.getBoundingClientRect(), rootClip);
      for (let ancestor = regionElement.parentElement; ancestor && ancestor !== this.root; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) bounds = intersect(bounds, ancestor.getBoundingClientRect());
      }
      const result = { x: bounds.left - rootClip.left, y: bounds.top - rootClip.top, width: Math.max(0, bounds.right - bounds.left), height: Math.max(0, bounds.bottom - bounds.top) };
      regionBounds.set(regionElement, result);
      return result;
    };
    this.root.querySelectorAll('[data-build]').forEach((element) => {
      const id = element.dataset.build;
      const kind = element.dataset.kind || 'box';
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4 || 20;
      let clip = intersect(rect, rootClip);
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== this.root && isVisibleBuildArea(clip, kind)) {
        const style = getComputedStyle(ancestor);
        const bounds = ancestor.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) clip = intersect(clip, bounds);
        ancestor = ancestor.parentElement;
      }
      if (!isVisibleBuildArea(clip, kind) || !isVisibleBuildArea(rect, kind) || computed.display === 'none') return;
      const regionElement = element.closest('[data-build-region]') || this.root;
      const regionId = regionElement.dataset.buildRegion || 'content';
      const regionLabel = regionElement.dataset.regionLabel || '界面';
      const area = visibleRegionBounds(regionElement);
      const previousArea = regions.get(regionId);
      // Semantic containers provide context; each leaf gets its own task owner.
      if (previousArea) {
        const right = Math.max(previousArea.x + previousArea.width, area.x + area.width);
        const bottom = Math.max(previousArea.y + previousArea.height, area.y + area.height);
        previousArea.x = Math.min(previousArea.x, area.x);
        previousArea.y = Math.min(previousArea.y, area.y);
        previousArea.width = right - previousArea.x;
        previousArea.height = bottom - previousArea.y;
      } else regions.set(regionId, { ...area });
      if (!this.records.has(element)) {
        this.records.set(element, { id, opacity: element.style.opacity, clipPath: element.style.clipPath, willChange: element.style.willChange, baseOpacity: computed.opacity });
      }
      const textLines = [];
      if (kind === 'text') {
        const range = document.createRange();
        range.selectNodeContents(element);
        Array.from(range.getClientRects()).filter((line) => line.width > 0 && line.height > 0).sort((a, b) => a.top - b.top || a.left - b.left).forEach((line) => {
          const last = textLines.at(-1);
          const next = { left: line.left - rect.left, top: line.top - rect.top, width: line.width, height: line.height };
          if (last && Math.abs(last.top - next.top) < Math.max(3, lineHeight * 0.25)) {
            const right = Math.max(last.left + last.width, next.left + next.width);
            const bottom = Math.max(last.top + last.height, next.top + next.height);
            last.left = Math.min(last.left, next.left);
            last.top = Math.min(last.top, next.top);
            last.width = right - last.left;
            last.height = bottom - last.top;
          } else textLines.push(next);
        });
      }
      blueprint.push({
        id,
        kind,
        regionId,
        regionLabel,
        taskLabel: element.dataset.taskLabel || (kind === 'text' ? element.textContent.trim().replace(/\s+/g, ' ').slice(0, 5) : kind === 'image' ? '放置图片' : kind === 'line' ? '绘制分隔线' : `${regionLabel.slice(0, 3)}控件`),
        textLength: element.textContent?.trim().length || 0,
        fontSize: parseFloat(computed.fontSize) || 14,
        isHeading: /^H[1-6]$/.test(element.tagName),
        visible: true,
        parentId: element.dataset.parent || null,
        lineHeight,
        textLines,
        rect: { x: rect.left - rootClip.left, y: rect.top - rootClip.top, width: rect.width, height: rect.height },
        clip: { x: clip.left - rootClip.left, y: clip.top - rootClip.top, width: clip.right - clip.left, height: clip.bottom - clip.top },
      });
    });
    return blueprint.map(task => ({ ...task, regionRect: { ...regions.get(task.regionId) } })).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  }

  restore(element, record) {
    element.style.opacity = record.opacity;
    element.style.clipPath = record.clipPath;
    element.style.willChange = record.willChange;
  }

  restoreAll() { this.records.forEach((record, element) => this.restore(element, record)); }

  applyFrame() {
    const tasks = new Map(this.scheduler.tasks.map((task) => [task.id, task]));
    this.records.forEach((record, element) => {
      const task = tasks.get(record.id);
      if (!task || task.status === 'complete') {
        this.restore(element, record);
        return;
      }
      element.style.willChange = 'clip-path, opacity';
      if (task.status === 'queued' || task.progress < 0.17) {
        element.style.opacity = '0';
        return;
      }
      const reveal = Math.min(1, Math.max(0, (task.progress - 0.17) / 0.72));
      element.style.opacity = record.baseOpacity;
      if (task.kind === 'text') element.style.clipPath = textRevealAt(task, reveal).clipPath;
      else if (task.kind === 'line') element.style.clipPath = `inset(0 ${(1 - reveal) * 100}% 0 0)`;
      else if (task.kind === 'image') {
        const imageReveal = Math.min(1, Math.max(0, (task.progress - 0.3) / 0.6));
        element.style.clipPath = `inset(0 0 ${(1 - imageReveal) * 100}% 0)`;
      }
      else {
        element.style.clipPath = record.clipPath;
        element.style.opacity = `${Math.max(0, (reveal - 0.68) / 0.32) * Number(record.baseOpacity)}`;
      }
    });
  }

  cancelFrame() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  scheduleFrame(geometryOnly = false) {
    if (this.raf === null && (['intro', 'running'].includes(this.scheduler.state) || (geometryOnly && this.scheduler.state === 'paused'))) this.raf = requestAnimationFrame(this.onFrame);
  }

  onFrame(now) {
    this.raf = null;
    if (this.scheduler.state === 'idle') return;
    const geometryChanged = this.geometryDirty;
    if (geometryChanged) this.syncGeometry();
    this.scheduler.tick(now);
    this.applyFrame();
    if (geometryChanged || now - this.lastPublish >= 30 || this.scheduler.state === 'paused') {
      this.lastPublish = now;
      this.publish();
    }
    this.scheduleFrame();
  }

  viewport() { return { width: this.root?.clientWidth || 900, height: this.root?.clientHeight || 600 }; }

  syncGeometry() {
    this.scheduler.syncViewport(this.collect(), { viewport: this.viewport() });
    this.geometryDirty = false;
  }

  plan({ intro = false, paused = false } = {}) {
    this.cancelFrame();
    this.restoreAll();
    this.records.clear();
    const tasks = this.collect();
    this.scheduler.start(tasks, {
      intro,
      paused,
      viewport: this.viewport(),
      origin: { x: (this.root?.clientWidth || 800) * 0.52, y: Math.min(180, (this.root?.clientHeight || 600) * 0.3) },
    });
    this.geometryDirty = false;
    this.applyFrame();
    this.publish();
    this.scheduleFrame();
  }

  start() {
    clearTimeout(this.scrollTimer);
    this.scrolling = false;
    this.plan({ intro: true });
  }

  pause() {
    if (this.geometryDirty) this.syncGeometry();
    this.scheduler.pause();
    this.cancelFrame();
    this.applyFrame();
    this.publish();
  }

  resume() {
    if (this.scheduler.state !== 'paused') return;
    if (this.geometryDirty) this.syncGeometry();
    this.scheduler.resume();
    this.applyFrame();
    this.publish();
    this.scheduleFrame();
  }

  setSpeed(speed) {
    this.scheduler.setSpeed(speed);
    this.applyFrame();
    this.publish();
  }

  replay() {
    clearTimeout(this.scrollTimer);
    this.scrolling = false;
    if (this.scheduler.state === 'idle') this.plan();
    else {
      this.syncGeometry();
      this.scheduler.replayVisible();
      this.applyFrame();
      this.publish();
      this.scheduleFrame();
    }
  }

  onScroll() {
    if (this.scheduler.state === 'idle') return;
    this.scrolling = true;
    this.geometryDirty = true;
    this.scheduleFrame(true);
    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.scrolling = false;
      this.publish();
    }, 150);
  }

  onResize() {
    if (this.scheduler.state === 'idle' || !this.root) return;
    this.geometryDirty = true;
    this.scheduleFrame(true);
  }

  changeContent(sceneKey, contentRevision) {
    const signature = `${sceneKey}:${contentRevision}`;
    if (this.signature === undefined) { this.signature = signature; return; }
    if (this.signature === signature) return;
    this.signature = signature;
    const state = this.scheduler.state;
    this.cancelFrame();
    clearTimeout(this.scrollTimer);
    this.restoreAll();
    this.records.clear();
    this.scrolling = false;
    this.geometryDirty = false;
    this.scheduler.exit();
    if (state !== 'idle') this.plan({ paused: state === 'paused' });
    else this.publish();
  }

  exit() {
    this.cancelFrame();
    clearTimeout(this.scrollTimer);
    this.restoreAll();
    this.records.clear();
    this.scrolling = false;
    this.geometryDirty = false;
    this.scheduler.exit();
    this.publish();
  }

  unmount() {
    this.onChange = null;
    this.exit();
    this.root?.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.observer?.disconnect();
    this.root = null;
  }
}

export function useRebuild({ rootRef, sceneKey, contentRevision = 0 }) {
  const controllerRef = useRef(null);
  if (!controllerRef.current) controllerRef.current = new RebuildController();
  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState(() => controller.snapshot());
  useEffect(() => {
    controller.mount(rootRef.current, setSnapshot);
    return () => controller.unmount();
  }, [controller, rootRef]);
  useEffect(() => controller.changeContent(sceneKey, contentRevision), [controller, sceneKey, contentRevision]);
  const actions = useMemo(() => Object.fromEntries(['setSpeed', 'start', 'pause', 'resume', 'replay', 'exit'].map((name) => [name, controller[name].bind(controller)])), [controller]);
  return { ...snapshot, ...actions };
}
