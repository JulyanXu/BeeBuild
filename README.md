# BeeBuild

让 36 个光标重新画出熟悉的界面。一个基于 React + Vite 的中文桌面交互原型。

专用源码仓库：[JulyanXu/BeeBuild](https://github.com/JulyanXu/BeeBuild)（私有仓库，需要访问权限）。

## 体验

菜单栏的「演示场景」可切换设计笔记、长网页、应用列表。点击「重画当前窗口」或按 `Alt + Shift + B` 启动；底部控制条支持暂停、0.5/1/2/3× 调速、当前视口重播、录制和退出。`Esc` 先关闭当前菜单／对话框，再退出重画。

**滚动不断播。** 36 个光标在滚动、惯性滚动与窗口尺寸变化时继续工作；新进入视野的内容加入队列，已有任务保留进度。当前视口完成后，光标继续轻微巡游，等待更多内容。只有显式暂停会冻结播放，已完成的内容不会自动反复重画。设置中可录制页面内快捷键，也可隐藏移动光标、保留逐块呈现。

点击「录制」，按浏览器提示选择当前 BeeBuild 标签页；停止后预览并下载视频。录制不含声音，文件在本地生成，不上传。视频优先使用 WebM，按浏览器能力回退到 MP4；当前不导出 GIF。暂停重画不会暂停录制。

本原型的重画只读取三个模拟窗口的页面 DOM，不读取真实 Mac 应用或注册系统全局快捷键。录制通过浏览器的共享选择器获取用户明确选择的画面，需要支持屏幕共享和 `MediaRecorder` 的浏览器，以及 localhost 或 HTTPS；不支持时会说明不可用。浏览器录制能力与原生 Mac 窗口重建是两个独立功能。

## 开发与检查

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run build
npm test
```

核心动画调度位于 `src/engine/`；场景位于 `src/Scenes.jsx`，播放器和菜单位于 `src/App.jsx`，浏览器录制位于 `src/recording/`。布局与动画分离，通过 `data-build`/`data-kind` 把当前 DOM 测量为绘制蓝图。单一虚拟时钟控制指针、逐行文字、图片显现和分隔线；滚动只更新几何与可见任务，不暂停时钟。

使用 Node.js 22。完整测试包含构建产物检查，因此在干净检出中先执行 `npm run build`，再执行 `npm test`。仅检查纯播放逻辑可运行 `node --test tests/engine.test.js`。GitHub Actions 工作流位于 `.github/workflows/ci.yml`；运行状态以仓库实际结果为准。

## 维护约定

- 改动播放逻辑时同步检查调速连续性、显式暂停、36 个光标、视口完成后的持续播放、滚动增量更新与版本失效；浏览器中另外验证嵌套滚动和点击透传。
- 新场景使用稳定且唯一的 `data-build`，标注 `text/image/box/line`，避免父子元素重复标注；内容变化通过 `onContentChange` 通知引擎。
- 录制与播放分别管理生命周期。录制需要用户主动选择共享对象；处理取消、拒绝、停止共享和编码失败，释放媒体轨道与预览 URL。
- 保留选定视觉、交互规格与验收证据。`design-qa.md` 记录实际验证范围；不要把模拟窗口或编码单元测试描述为真实 Mac 捕获验收。
- 保持 `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs` 与 Sites 测试完整。发布前构建并检查 `dist/client/index.html`、`dist/server/index.js`、`dist/.openai/hosting.json`。

## 交付资料

- `design/selected-frosted-dock.png`：选定视觉；同目录保留另两张方案。
- `docs/interaction-spec.md`：交互规格和状态说明。
- `docs/native-mac-checklist.md`：原生实现方向与真机验收清单。
- `docs/assets.md`：图片资产来源和生成提示。
- `design-qa.md`：浏览器验收与视觉对照结果。
- `qa/`：关键场景及对照截图。

交互参考 [Swarm Rebuild](https://github.com/DhvanilPatel/swarm-cursors)，动画代码独立实现。UI 图标采用 Phosphor；摄影与 BeeBuild 图标由 ImageGen 生成。
