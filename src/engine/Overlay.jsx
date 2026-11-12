import { Cursor } from '@phosphor-icons/react';
import { AGENT_COLORS, textRevealAt } from './engine.js';
import './engine.css';

const LABEL_WIDTH = 74;
const LABEL_HEIGHT = 25;
const clamp = (value, min, max) => Math.min(Math.max(min, value), Math.max(min, max));

export function RebuildOverlay({ engine, rootRef, avoidRef }) {
  if (engine.state === 'idle') return null;
  const width = rootRef.current?.clientWidth || 900;
  const height = rootRef.current?.clientHeight || 600;
  const rootBounds = rootRef.current?.getBoundingClientRect();
  const avoidBounds = avoidRef?.current?.getBoundingClientRect();
  const avoid = rootBounds && avoidBounds ? { left: avoidBounds.left - rootBounds.left, top: avoidBounds.top - rootBounds.top, right: avoidBounds.right - rootBounds.left, bottom: avoidBounds.bottom - rootBounds.top } : null;
  const placedLabels = [];
  const activeTasks = engine.agents.length ? engine.tasks.filter((task) => task.visible && task.status === 'running' && task.progress > 0.13 && task.progress < 0.96) : [];
  return (
    <div className="rebuild-overlay" aria-hidden="true">
      {activeTasks.map((task) => {
        const progress = Math.min(1, Math.max(0, (task.progress - 0.17) / 0.72));
        const color = AGENT_COLORS[task.agentIndex % AGENT_COLORS.length];
        const caret = task.kind === 'text' ? textRevealAt(task, progress) : null;
        const line = task.kind === 'line';
        const isImage = task.kind === 'image';
        const frameProgress = isImage ? Math.min(1, Math.max(0, (task.progress - 0.17) / 0.13)) : progress;
        const lineLabelAbove = line && task.clip.y >= 18;
        const clipTop = task.clip.y - (lineLabelAbove ? 18 : 0);
        return <div key={`${engine.revision}-${task.id}`} className="rebuild-task-clip" style={{ left: task.clip.x, top: clipTop, width: task.clip.width, height: task.clip.height + (line ? 18 : isImage ? 25 : 0), '--agent-color': color }}>
          <div className={`rebuild-task rebuild-task--${task.kind}`} style={{ left: task.rect.x - task.clip.x, top: task.rect.y - clipTop, width: task.rect.width, height: task.rect.height }}>
            {caret ? <span className="rebuild-text-caret" style={{ left: Math.min(caret.x, task.rect.width - 2), top: caret.y, height: caret.height, opacity: Math.floor(engine.virtualTime / 440) % 2 ? 0.4 : 1 }} /> : <div className="rebuild-selection" style={{ width: `${Math.max(1, frameProgress * 100)}%`, height: line ? '100%' : `${Math.max(2, frameProgress * 100)}%` }}>{isImage && [0,1,2,3].map(corner => <i key={corner} className={`rebuild-handle handle-${corner}`} />)}</div>}
            {task.kind !== 'text' && <span className="rebuild-dimensions" style={line ? { top: lineLabelAbove ? -16 : 3 } : isImage ? { top: task.rect.height + 4, left: 'auto', right: 6, background: '#92928d', color: '#fff', fontSize: 11 } : undefined}>{line ? `${Math.round(task.rect.width * progress)} px` : `${Math.round(task.rect.width * frameProgress)} × ${Math.round(task.rect.height * frameProgress)}`}</span>}
          </div>
        </div>;
      })}
      {activeTasks.slice(0, 2).map((task) => <div key={`guide-${task.id}`} className="rebuild-guide" style={{ left: Math.max(0, task.clip.x), top: task.clip.y, width: Math.min(width, task.clip.width + 60), '--agent-color': AGENT_COLORS[task.agentIndex % AGENT_COLORS.length] }} />)}
      {engine.agents.map((agent) => {
        const position = { ...agent.position };
        const showLabel = agent.phase === 'build' || agent.index % 6 === 0;
        if (agent.phase !== 'build' && avoid && position.x > avoid.left - 20 && position.x < avoid.right + 20 && position.y > avoid.top - 20 && position.y < avoid.bottom + 20) position.y = Math.max(20, avoid.top - 24);
        const flipLeft = position.x + 17 + LABEL_WIDTH > width - 6;
        const flipUp = position.y + 18 + LABEL_HEIGHT > height - 6;
        let labelX = clamp(flipLeft ? position.x - LABEL_WIDTH - 8 : position.x + 17, 6, width - LABEL_WIDTH - 6);
        let labelY = clamp(flipUp ? position.y - LABEL_HEIGHT - 8 : position.y + 18, 6, height - LABEL_HEIGHT - 6);
        if (avoid && labelX < avoid.right + 8 && labelX + LABEL_WIDTH > avoid.left - 8 && labelY < avoid.bottom + 8 && labelY + LABEL_HEIGHT > avoid.top - 8) labelY = Math.max(6, avoid.top - LABEL_HEIGHT - 10);
        for (let attempt = 0; showLabel && attempt < 12 && placedLabels.some(other => labelX < other.x + LABEL_WIDTH + 3 && labelX + LABEL_WIDTH + 3 > other.x && labelY < other.y + LABEL_HEIGHT + 3 && labelY + LABEL_HEIGHT + 3 > other.y); attempt++) {
          if (labelY > LABEL_HEIGHT + 10) labelY -= LABEL_HEIGHT + 5;
          else labelX = clamp(labelX + LABEL_WIDTH + 8, 6, width - LABEL_WIDTH - 6);
        }
        if (showLabel) placedLabels.push({x: labelX, y: labelY});
        const labelLeft = labelX - position.x;
        const labelTop = labelY - position.y;
        return <div key={agent.index} data-agent={agent.index + 1} data-phase={agent.phase} className={`rebuild-agent rebuild-agent--${agent.phase}`} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)`, '--agent-color': agent.color }}>
          <Cursor size={agent.phase === 'build' ? 23 : 21} weight="fill" className="rebuild-agent-arrow" />
          {showLabel && <span className="rebuild-agent-label" style={{ left: labelLeft, top: labelTop, width: LABEL_WIDTH, height: LABEL_HEIGHT, borderRadius: flipUp ? '6px 6px 3px 6px' : flipLeft ? '6px 3px 6px 6px' : undefined }}>Agent {String(agent.index + 1).padStart(2, '0')}</span>}
        </div>;
      })}
    </div>
  );
}
