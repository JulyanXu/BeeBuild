import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowCounterClockwise, Check, MonitorPlay, Record, Square, VideoCamera, X } from '@phosphor-icons/react';
import { formatRecordingTime } from './ScreenRecorder.js';
import { useScreenRecorder } from './useScreenRecorder.js';
import './recording.css';

const sizeLabel = bytes => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function RecordingControl({ onRecordingStart }) {
  const recording = useScreenRecorder();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const previousPhase = useRef(recording.phase);
  const active = recording.phase === 'recording';
  const busy = ['requesting', 'stopping'].includes(recording.phase);

  useEffect(() => {
    if (recording.phase === 'ready' && previousPhase.current !== 'ready') setOpen(true);
    previousPhase.current = recording.phase;
  }, [recording.phase]);
  useEffect(() => { if (recording.error) setOpen(true); }, [recording.error]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    panelRef.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); setOpen(false);
      } else if (event.key === 'Tab') {
        const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), a[href], video, [tabindex="0"]')];
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); (previouslyFocused?.isConnected ? previouslyFocused : triggerRef.current)?.focus(); };
  }, [open]);

  const start = async () => {
    setOpen(false);
    const started = await recording.start();
    if (started) onRecordingStart?.();
    else setOpen(true);
  };
  const toggle = () => {
    if (active) recording.stop();
    else if (!busy) setOpen(value => !value);
  };
  const result = recording.result;
  return <>
    <button ref={triggerRef} className={`recording-trigger record-button dock-pill ${active ? 'is-recording' : ''}`} onClick={toggle} disabled={busy} aria-label={active ? '结束录制并预览' : busy ? recording.phase === 'requesting' ? '正在选择录制来源' : '正在生成视频' : '录制动画'} aria-expanded={open} title={active ? '结束录制并预览' : '录制动画'}>
      {active ? <><span className="recording-live-dot" /><span className="recording-timer">{formatRecordingTime(recording.elapsedMs)}</span><Square size={13} weight="fill" /></> : <><VideoCamera size={20} /><span className="record-label">{recording.phase === 'requesting' ? '选择中' : recording.phase === 'stopping' ? '生成中' : '录制'}</span></>}
    </button>
    {open && createPortal(<div className="recording-scrim" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="recording-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="recording-title">
        <button className="recording-panel-close" aria-label="关闭录制面板" onClick={() => setOpen(false)}><X size={21} /></button>
        <div className={`recording-panel-icon ${result ? 'is-ready' : ''}`}>{result ? <Check size={25} /> : <VideoCamera size={26} />}</div>
        <p className="recording-eyebrow">A LITTLE MOMENT, SAVED.</p>
        <h2 id="recording-title">{result ? '把这一刻，留下来。' : '录下重新生长的过程。'}</h2>
        {result ? <>
          <p className="recording-lead">视频已在本地生成，可以预览后保存。</p>
          <video className="recording-preview" src={result.url} controls playsInline preload="metadata" aria-label="录制视频预览" />
          <div className="recording-file-meta"><span>{formatRecordingTime(result.elapsedMs)}</span><span>{result.mimeType.includes('mp4') ? 'MP4' : 'WebM'}</span><span>{sizeLabel(result.size)}</span></div>
          {recording.notice && <p className="recording-notice" role="status">{recording.notice}</p>}
          {recording.error && <p className="recording-error" role="alert">{recording.error}</p>}
          <div className="recording-result-actions"><button className="recording-secondary" onClick={start}><ArrowCounterClockwise size={17} />再录一次</button><a className="recording-primary" href={result.url} download={result.filename}><ArrowDown size={18} />保存视频</a></div>
          <p className="recording-footnote">内容不上传。关闭页面后，未保存的视频将被清除。</p>
        </> : <>
          <p className="recording-lead">光标的移动、滚动与暂停，都会留在视频里。</p>
          {recording.supported ? <>
            <div className="recording-source-note"><MonitorPlay size={23} /><div><strong>选择当前 BeeBuild 标签页</strong><p>接下来浏览器会请你选择录制画面。选择当前标签页，开始后继续自由操作。</p></div></div>
            <div className="recording-facts"><span><Check size={14} />本地生成</span><span><Check size={14} />不录制声音</span><span><Check size={14} />无需登录</span></div>
            {recording.notice && <p className="recording-notice" role="status">{recording.notice}</p>}
            {recording.error && <p className="recording-error" role="alert">{recording.error}</p>}
            <button className="recording-primary recording-start" onClick={start}><Record size={19} />选择标签页并录制</button>
            <p className="recording-footnote">录制期间，点击控制条上的停止按钮结束。<br />保存为浏览器支持的视频格式；全程不上传画面。</p>
          </> : <div className="recording-unavailable" role="status"><strong>当前浏览器无法录制</strong><p>请在支持屏幕共享的桌面浏览器中打开此页面，再录下你的动画。</p></div>}
        </>}
      </section>
    </div>, document.body)}
    <span className="sr-only" aria-live="polite">{active ? '动画录制中，点击录制按钮结束并预览。' : recording.phase === 'ready' ? '录制完成，视频已在本地生成。' : ''}</span>
  </>;
}
