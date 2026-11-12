import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppleLogo, WifiHigh, MagnifyingGlass, SlidersHorizontal, SidebarSimple, NotePencil, Trash, TextAa, ListBullets, Table, ImageSquare, CaretDown, Pause, Play, ArrowCounterClockwise, X, Check, Globe, Note, Folder, GearSix, Keyboard, Info, ArrowRight } from '@phosphor-icons/react';
import { SceneContent } from './Scenes.jsx';
import { useRebuild } from './engine/useRebuild.js';
import { RebuildOverlay } from './engine/Overlay.jsx';
import { RecordingControl } from './recording/RecordingControl.jsx';
import './scenes.css';
import './engine/engine.css';

const SCENES = [
  { id: 'notes', name: '设计笔记', description: '文字、图片与灵感', icon: Note },
  { id: 'web', name: '长网页', description: '跟随阅读，继续构建', icon: Globe },
  { id: 'apps', name: '应用列表', description: '每一个细节，都能重画', icon: Folder },
];
const DEFAULT_SHORTCUT = { code: 'KeyB', key: 'B', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };
const shortcutLabel = s => `${s.ctrlKey ? '⌃' : ''}${s.altKey ? '⌥' : ''}${s.shiftKey ? '⇧' : ''}${s.metaKey ? '⌘' : ''}${s.key}`;
function Mark({ className = '' }) { return <span className={`brand-mark ${className}`}><img src="/assets/beebuild-mark.png" alt="" /></span>; }

export function App() {
  const [scene, setScene] = useState('notes');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [shortcut, setShortcut] = useState(DEFAULT_SHORTCUT);
  const [shortcutRecording, setShortcutRecording] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rootRef = useRef(null);
  const dockRef = useRef(null);
  const dialogRef = useRef(null);
  const changed = useCallback(() => setRevision(v => v + 1), []);
  const engine = useRebuild({ rootRef, sceneKey: scene, contentRevision: revision });
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const currentScene = SCENES.find(item => item.id === scene);
  const active = engine.state !== 'idle';
  const paused = engine.state === 'paused';
  const complete = engine.viewportComplete;
  const chooseScene = id => { setScene(id); setQuery(''); setMenu(null); };
  const begin = () => { engine.start(); setMenu(null); };
  const togglePlayback = () => {
    if (!active) begin();
    else if (paused) engine.resume();
    else engine.pause();
  };
  useEffect(() => {
    const outside = event => { if (!event.target.closest('[data-popover]')) setMenu(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => {
    if (dialog) dialogRef.current?.querySelector('button')?.focus();
    else setShortcutRecording(false);
  }, [dialog]);
  useEffect(() => {
    const handler = event => {
      if (shortcutRecording) return;
      if (event.key === 'Escape') {
        setMenu(null);
        if (dialog) setDialog(null); else if (menu) setMenu(null); else engineRef.current.exit();
        return;
      }
      if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.code === shortcut.code && ['altKey', 'shiftKey', 'ctrlKey', 'metaKey'].every(k => !!event[k] === !!shortcut[k])) {
        event.preventDefault();
        const value = engineRef.current;
        value.state === 'idle' ? value.start() : value.exit();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcut, dialog, menu, shortcutRecording]);
  useEffect(() => {
    let cancelled = false;
    let timer;
    const image = new window.Image();
    const ready = () => { Promise.resolve(document.fonts?.ready).then(() => { if (!cancelled && !reduceMotion) timer = setTimeout(() => engineRef.current.start(), 650); }); };
    image.onload = ready; image.onerror = ready; image.src = '/assets/tree-canopy.png';
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  const recordKey = event => {
    if (!shortcutRecording) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setShortcutRecording(false); return; }
    if (!/^(Key[A-Z]|Digit[0-9])$/.test(event.code) || !(event.altKey || event.ctrlKey || event.metaKey)) return;
    setShortcut({ code: event.code, key: event.code.replace(/Key|Digit/, ''), altKey: event.altKey, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    setShortcutRecording(false);
  };
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const list = [...dialogRef.current.querySelectorAll('button, input, select, [tabindex="0"]')].filter(el => !el.disabled);
    if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === list.at(-1)) { event.preventDefault(); list[0]?.focus(); }
  };
  return <main className={`desktop ${reduceMotion ? 'reduced-motion' : ''}`}>
    <header className="mac-menubar" aria-label="BeeBuild 菜单栏">
      <div className="menu-left"><AppleLogo size={21} weight="fill" aria-hidden="true" />
        <div className="menu-anchor" data-popover>
          <button className={`menu-item brand-menu ${menu === 'brand' ? 'selected' : ''}`} onClick={() => setMenu(menu === 'brand' ? null : 'brand')} aria-expanded={menu === 'brand'}>BeeBuild</button>
          {menu === 'brand' && <div className="dropdown app-menu">
            <button onClick={begin}><Mark /><span>重画当前窗口</span><kbd>{shortcutLabel(shortcut)}</kbd></button><div className="menu-rule" />
            <button onClick={() => { setDialog('settings'); setMenu(null); }}><GearSix /><span>设置…</span></button>
            <button onClick={() => { setDialog('about'); setMenu(null); }}><Info /><span>关于 BeeBuild</span></button><div className="menu-rule" />
            <button onClick={() => { engine.exit(); setMenu(null); }} disabled={!active}><X /><span>结束重画</span><kbd>esc</kbd></button>
          </div>}
        </div>
        <div className="menu-anchor" data-popover>
          <button className={`menu-item ${menu === 'scene' ? 'selected' : ''}`} onClick={() => setMenu(menu === 'scene' ? null : 'scene')} aria-expanded={menu === 'scene'}>演示场景<CaretDown size={10} /></button>
          {menu === 'scene' && <div className="dropdown scene-menu">
            <p className="dropdown-caption">换一个窗口，重新发现它。</p>
            {SCENES.map(item => <button key={item.id} onClick={() => chooseScene(item.id)} aria-current={scene === item.id ? 'true' : undefined}><item.icon size={23} /><span><strong>{item.name}</strong><small>{item.description}</small></span>{scene === item.id && <Check className="menu-check" size={17} />}</button>)}
            <div className="menu-rule" /><p className="dropdown-footnote">交互演示 · 当前为模拟窗口</p>
          </div>}
        </div>
        <button className="menu-item help-menu" onClick={() => setDialog('help')}>使用说明</button>
      </div>
      <div className="menu-right">
        <button className={`status-button ${active ? 'is-active' : ''}`} title="重画当前窗口" aria-label="菜单栏：重画当前窗口" onClick={begin}><Mark /></button><WifiHigh size={21} weight="bold" aria-hidden="true" />
        <button className="menubar-icon" aria-label="搜索当前窗口" onClick={() => document.getElementById('window-search')?.focus()}><MagnifyingGlass size={20} /></button>
        <button className="menubar-icon" aria-label="打开设置" onClick={() => setDialog('settings')}><SlidersHorizontal size={20} /></button>
      </div>
    </header>
    <section ref={rootRef} className={`application-window scene-${scene}`} aria-label={`${currentScene.name}模拟窗口`} data-engine-state={engine.state} data-engine-speed={engine.speed} data-playback-time={Math.round(engine.virtualTime || 0)} data-viewport-complete={!!complete}>
      <header className="window-titlebar">
        <div className="window-title-left">
          <div className="traffic-lights" aria-hidden="true" data-build={`${scene}-traffic`} data-kind="box"><i /><i /><i /></div>
          <SidebarSimple size={25} className="titlebar-sidebar" aria-hidden="true" data-build={`${scene}-sidebar-icon`} data-kind="box" />
          <h1 data-build={`${scene}-window-title`} data-kind="text">{currentScene.name}</h1>
        </div>
        <div className="window-tools" aria-hidden="true" data-build={`${scene}-window-tools`} data-kind="box"><NotePencil /><Trash /><span /><TextAa /><ListBullets /><Table /><ImageSquare /></div>
        <label className="window-search" data-build={`${scene}-search`} data-kind="box"><MagnifyingGlass size={18} /><input id="window-search" type="search" aria-label="搜索当前场景" placeholder="搜索" value={query} onChange={event => { setQuery(event.target.value); changed(); }} /></label>
      </header>
      <SceneContent key={scene} scene={scene} onContentChange={changed} searchQuery={query} />
      {!reduceMotion && <RebuildOverlay engine={engine} rootRef={rootRef} avoidRef={dockRef} />}
      {reduceMotion && active && !complete && <div className="motion-alternative" role="status">轻柔模式 · {paused ? '已暂停' : '正在逐块呈现'}</div>}
    </section>
    <div ref={dockRef} className={active ? 'control-dock' : 'launcher-dock'} role="toolbar" aria-label="重画控制">
      {active ? <>
      <div className="dock-brand"><Mark /><strong>BeeBuild</strong><small className="swarm-count" title="36 个光标同时参与">36</small></div><span className="dock-divider" />
      <button className="playback-button" onClick={togglePlayback} aria-label={paused ? '继续重画' : '暂停重画'}>{paused ? <Play size={19} weight="fill" /> : <Pause size={19} weight="fill" />}<span>{paused ? '继续' : '暂停'}</span></button>
      <div className="speed-container" data-popover>
        <button className="dock-pill speed-button" onClick={() => setMenu(menu === 'speed' ? null : 'speed')} aria-label={`播放速度 ${engine.speed} 倍`} aria-expanded={menu === 'speed'}>{engine.speed}×<CaretDown size={14} /></button>
        {menu === 'speed' && <div className="dropdown speed-menu"><p className="dropdown-caption">施工速度</p>{[0.5, 1, 2, 3].map(speed => <button key={speed} onClick={() => { engine.setSpeed(speed); setMenu(null); }} aria-label={`${speed} 倍速`}><span>{speed}×</span><small>{speed === 0.5 ? '慢慢欣赏' : speed === 1 ? '从容有序' : speed === 2 ? '轻快一些' : '全速开工'}</small>{engine.speed === speed && <Check size={16} />}</button>)}</div>}
      </div>
      <button className="dock-pill replay-button" onClick={engine.replay} aria-label="重播当前视口"><ArrowCounterClockwise size={22} /><span>重播</span></button>
      </> : <><Mark /><div className="launcher-copy"><strong>让熟悉的界面，重新发生。</strong><span>36 个光标，一起把界面重新画出来。</span></div><button className="launch-button" onClick={begin}>重画当前窗口<ArrowRight size={18} /></button><kbd>{shortcutLabel(shortcut)}</kbd></>}
      <RecordingControl onRecordingStart={() => { if (engineRef.current.state === 'idle') engineRef.current.start(); }} />
      {active && <><span className="dock-divider last" /><button className="close-build" onClick={() => { engine.exit(); setMenu(null); }} aria-label="退出重画" title="退出重画 · Esc"><X size={23} /></button></>}
    </div>
    <div className="quiet-footer"><span>BeeBuild <span className="footer-dot">·</span> 交互原型</span><span>{active ? paused ? '已暂停，灵感不着急' : complete ? '36 个光标待命 · 滚动，继续发现更多' : '自由滚动，36 个光标持续施工' : '在上方「演示场景」中切换窗口'}</span></div>
    <div className="sr-only" role="status" aria-live="polite">{engine.state === 'paused' ? '重画已暂停' : complete && active ? '当前视口已完成，播放继续，滚动后绘制更多内容' : engine.state === 'idle' ? '重画已退出，原界面可正常操作' : ''}</div>
    {dialog && <div className="dialog-scrim" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(null); }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-heading" ref={dialogRef} onKeyDown={trapFocus}>
        <button className="dialog-close" onClick={() => setDialog(null)} aria-label="关闭对话框"><X size={21} /></button><Mark className="dialog-mark" />
        <h2 id="dialog-heading">{dialog === 'settings' ? '按你的节奏。' : dialog === 'help' ? '看见界面重新生长。' : 'BeeBuild'}</h2>
        <p className="dialog-lead">{dialog === 'settings' ? '把一次小小的重画，变成顺手的日常。' : dialog === 'help' ? '让光标接手片刻，享受构建的过程。' : '给熟悉的屏幕，一次重新开始。'}</p>
        {dialog === 'settings' ? <>
          <div className="setting-row"><div><strong><Keyboard size={19} />唤起快捷键</strong><small>页面聚焦时有效，点击右侧重新录制。</small></div><button className={`shortcut-recorder ${shortcutRecording ? 'recording' : ''}`} onClick={() => setShortcutRecording(true)} onKeyDown={recordKey}>{shortcutRecording ? '按下组合键…' : shortcutLabel(shortcut)}</button></div>
          <div className="setting-row"><div><strong>减少光标动效</strong><small>隐藏移动光标，保留逐块呈现。</small></div><button className={`switch ${reduceMotion ? 'on' : ''}`} role="switch" aria-checked={reduceMotion} aria-label="减少光标动效" onClick={() => setReduceMotion(v => !v)}><span /></button></div>
          <div className="setting-row"><div><strong>默认速度</strong><small>即时应用于当前的重画。</small></div><select aria-label="默认播放速度" value={engine.speed} onChange={event => engine.setSpeed(Number(event.target.value))}>{[.5, 1, 2, 3].map(s => <option key={s} value={s}>{s}×</option>)}</select></div>
          <p className="dialog-note">快捷键设置仅在本次预览中保留。原生 Mac 版将提供系统级唤起。</p>
        </> : dialog === 'help' ? <>
          <ol className="help-steps"><li><span>01</span><div><strong>选一个熟悉的窗口</strong><p>在「演示场景」切换笔记、长网页与应用列表。</p></div></li><li><span>02</span><div><strong>让光标开工</strong><p>点击重画，或使用 {shortcutLabel(shortcut)}。文字、图片与控件会逐步出现。</p></div></li><li><span>03</span><div><strong>随意滚动，随时掌控</strong><p>滚动不会中断播放，只有暂停会冻结光标。调速保持进度；重播只重画当前视口。按 Esc 退出重画。</p></div></li><li><span>04</span><div><strong>把这段创作留住</strong><p>点击「录制」，选择当前 BeeBuild 标签页。停止后预览并下载视频；暂停绘制时录制仍会继续。</p></div></li></ol>
          <button className="dialog-primary" onClick={() => { setDialog(null); begin(); }}>开始体验<ArrowRight size={18} /></button>
        </> : <>
          <p className="about-copy">这是 BeeBuild 的交互原型。三个模拟窗口展示 36 个光标协同重画、连续滚动和播放控制。动画与录制文件都在本地处理。</p>
          <div className="about-note"><strong>关于原生 Mac 版</strong><p>真实窗口捕获与全局快捷键将在原生应用中实现。屏幕录制权限用于读取画面，辅助功能权限用于更细致地识别界面；本原型不会读取你的其他窗口。</p></div>
          <button className="text-button" onClick={() => setDialog('help')}>查看使用说明<ArrowRight size={16} /></button>
        </>}
      </section>
    </div>}
  </main>;
}
