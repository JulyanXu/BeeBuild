import { useEffect, useRef, useState } from 'react';
import {
  Archive, ArrowUpRight, BookOpen, BookmarkSimple, CaretDown, Check,
  Clock, Desktop, DownloadSimple, FileText, Folder, GridFour,
  HardDrives, Image, Leaf, List, MagnifyingGlass, Note, Star,
} from '@phosphor-icons/react';
import './scenes.css';

const build = (id, kind = 'text') => ({ 'data-build': id, 'data-kind': kind });

function useContentChange(values, onContentChange) {
  const callback = useRef(onContentChange);
  callback.current = onContentChange;
  useEffect(() => {
    const frame = requestAnimationFrame(() => callback.current?.());
    return () => cancelAnimationFrame(frame);
  }, values);
}

const notes = {
  grow: {
    title: '让想法自然生长', eyebrow: 'A SMALL FIELD GUIDE',
    intro: '这是一份关于设计与思考的个人笔记，记录在日常观察、实践与探索中积累的灵感。它不是一套固定的方法，而是希望帮助自己保持好奇，让想法在时间里自然生长。',
    sections: [
      ['从观察开始', '好的设计，往往源于对生活的细致观察。无论是一个日常的使用场景，还是一次偶然的视觉触动，都可能成为重要的灵感来源。', '我习惯随时记录下这些小小的发现，哪怕只是一片叶子的形状、一束光落下的位置，或者一个让人忍不住多看一眼的细节。'],
      ['给想法一点留白', '不是所有的灵感都需要立刻得到答案。有时候，把一个问题放在一旁，去散步，去看一本无关的书，新的连接反而会在不经意间出现。', '留白是一种选择：让重要的东西有呼吸的空间，也让下一次尝试有发生的可能。'],
      ['把喜欢的细节收集起来', '我把那些值得回头再看的东西放在这里。不急着归纳规律，先留下当时心动的理由。'],
      ['在小小的实践里验证', '一个想法从纸上走进现实，往往只需要一个很小的起点。做一个按钮，画一张草图，写下第一段文字，让它成为可以触碰和讨论的东西。', '比起一次就做得完整，我更喜欢保留试错的余地。在每一次反馈里靠近答案，也在每一次动手中理解自己。'],
      ['保持好奇，继续生长', '设计没有一个永远适用的终点。今天记下的想法，也许会在很久以后与另一段经历相遇，长成新的枝叶。', '所以，继续观察，继续记录。把日常过得认真一点，灵感会找到它自己的路。'],
    ],
  },
  details: {
    title: '交互细节', eyebrow: 'SMALL THINGS, BIG FEELINGS',
    intro: '那些让工具变得好用的瞬间，通常很轻。一个恰到好处的反馈，一次不用思考的返回，一段跟得上手势的动画，都在默默建立信任。',
    sections: [
      ['让每一次操作有回应', '按下按钮后，界面应该立刻告诉我发生了什么。反馈不必很热闹，一点颜色、一段位移，就足以让操作变得踏实。', '等待的时间无法总被缩短，但等待的感受可以被认真对待。'],
      ['让移动有来处', '元素出现和消失时，给它一个合理的方向。我们会自然记住物件的位置，也会期待界面遵循同样的空间逻辑。', '动画的节奏跟随内容，而不是让内容迁就动画。'],
      ['值得反复打磨的瞬间', '滚动、选中、撤销和返回，是每天都会遇到的小事。把这些小事做好，往往比增加一个新功能更有价值。'],
      ['让错误容易恢复', '保留可预期的撤销路径，不让一次无心的点击带走之前的工作。好的工具让人愿意尝试，因为他们知道自己能回来。'],
    ],
  },
  interfaces: {
    title: '值得收藏的界面', eyebrow: 'A COLLECTION OF GOOD DETAILS',
    intro: '一个好的界面，像一间采光舒服的房间。它知道如何安排秩序，也知道什么时候安静下来，让正在做的事情成为主角。',
    sections: [
      ['秩序来自一致', '相近的间距、统一的图标尺度和清晰的文字层级，让信息自然地落在合适的位置。', '一致性不是让每个地方都一样，而是让相同的行为拥有相同的预期。'],
      ['温度藏在材质里', '柔和的边缘、真实的光影和不过分饱和的颜色，能为数字世界带来一点触感。', '质感不必复杂。一个精确的阴影，有时候就能让整张画面成立。'],
      ['我的观察清单', '把看到的好设计拆成可描述的细节，下次动手时，便会多一份明确的判断。'],
      ['收藏之后，再回头看', '每隔一段时间重新看看这些收藏。留下仍然打动自己的部分，删去那些只在当时显得新鲜的装饰。'],
    ],
  },
  beebuild: {
    title: 'BeeBuild · 第一份草图', eyebrow: 'PROJECT JOURNAL / 001',
    intro: '让光标像一群小小的建造者，把熟悉的界面一点点重新画出来。一个关于日常、秩序，以及看见创造过程的实验。',
    sections: [
      ['一个简单的起点', '先从眼前的窗口开始。捕捉它的形状、文字与图像，再把它们交给不同的光标，在同一张画布上协作。', '真正令人着迷的不是速度，而是那些看得见的动作：拉出一个框，落下一行字，让一张图片慢慢出现。'],
      ['让控制保持轻巧', '随时暂停，调整节奏，或者从头再来。控制条只留下最常用的动作，把大部分空间还给正在发生的画面。'],
      ['接下来想尝试的事', '观察不同内容下的节奏：一页笔记、一篇文章，或者一组熟悉的文件。让每一种界面都有适合自己的重建方式。'],
    ],
  },
  archive: {
    title: '秋日散步记录', eyebrow: 'OCTOBER, SLOWLY',
    intro: '下午四点，绕过熟悉的街角，沿着河边走了一段路。树叶的颜色在一周之间变了很多，光却还是很温柔。',
    sections: [
      ['慢一点，才能看见', '路边一家新开的书店把门留了一半。门口摆着一盆很高的植物，几片叶子刚好接住了落日。', '拍下照片的时候，我想起界面中的留白也应该有这样的感觉。'],
      ['随手记下的颜色', '浅浅的麦色、偏灰的绿，还有路灯亮起之前天空的蓝。这些颜色不需要精确的名字，放在一起就足够舒服。'],
      ['带回日常', '把散步中看到的细节带回工作台，给正在做的设计留一点温度。'],
    ],
  },
};

const folders = [
  { id: 'all', label: '全部笔记', icon: Note, notes: ['grow', 'details', 'interfaces', 'beebuild', 'archive'] },
  { id: 'inspiration', label: '灵感收集', icon: Folder, notes: ['grow', 'details', 'interfaces'] },
  { id: 'projects', label: '项目记录', icon: Folder, notes: ['beebuild'] },
  { id: 'archive', label: '已归档', icon: Archive, notes: ['archive'] },
];

function NotesScene({ onContentChange, searchQuery = '' }) {
  const [folder, setFolder] = useState('inspiration');
  const [note, setNote] = useState('grow');
  const [savedItems, setSavedItems] = useState([true, false, true, false, false, true]);
  const article = notes[note];
  const visibleNotes = folders.find(item => item.id === folder).notes.filter(id => notes[id].title.toLowerCase().includes(searchQuery.toLowerCase()));
  const articleRef = useRef(null);
  useContentChange([folder, note, savedItems], onContentChange);
  useEffect(() => { articleRef.current?.scrollTo({ top: 0 }); }, [note]);
  const collection = ['窗边植物投在纸上的影子', '书店里恰到好处的行间距', '老相机清晰的机械反馈', '地图上克制而准确的颜色', '一封排版舒服的邮件', '晨间咖啡杯留下的圆形印记'];

  return <div className="notes-scene scene-content" aria-label="设计笔记">
    <aside className="notes-folders" aria-label="笔记文件夹">
      <div className="sidebar-caption" {...build('notes-folders-label')}>笔记</div>
      <nav>{folders.map(item => <button key={item.id} className={`folder-item ${folder === item.id ? 'is-current' : ''}`} aria-pressed={folder === item.id} {...build(`notes-folder-${item.id}`, 'box')} onClick={() => { setFolder(item.id); setNote(item.notes[0]); }}>
        <item.icon size={20} weight="regular" className={item.icon === Folder ? 'folder-icon' : ''} /><span>{item.label}</span>
      </button>)}</nav>
      <div className="sidebar-bottom" {...build('notes-folder-footer')}><span className="local-dot" />储存在此 Mac 上</div>
    </aside>
    <aside className="notes-list" aria-label="笔记列表">
      {visibleNotes.map(id => <button key={id} aria-pressed={note === id} className={`note-item ${note === id ? 'is-current' : ''}`} {...build(`notes-list-${id}`, 'box')} onClick={() => setNote(id)}>{notes[id].title}</button>)}
      {visibleNotes.length === 0 && <div className="notes-search-empty" {...build('notes-search-empty')}>没有匹配的笔记</div>}
      <div className="notes-count" {...build('notes-count')}>{visibleNotes.length} 则笔记</div>
    </aside>
    <article ref={articleRef} className="note-document scene-scroll" data-scroll-region="notes-document" aria-label={article.title} tabIndex={0}>
      <div className="note-document-inner" key={note}>
        <div className="note-eyebrow" {...build(`notes-${note}-eyebrow`)}>{article.eyebrow}</div>
        <h1 {...build(`notes-${note}-title`)}>{article.title}</h1>
        <p className="note-intro" {...build(`notes-${note}-intro`)}>{article.intro}</p>
        <figure className="note-hero" {...build(`notes-${note}-hero`, 'image')}><img src="/assets/tree-canopy.png" alt="阳光穿过绿意盎然的树冠，落在舒展的枝叶之间" /></figure>
        {article.sections.map(([title, ...paragraphs], index) => <section key={title} className="note-section">
          <h2 {...build(`notes-${note}-heading-${index}`)}>{title}</h2>
          {paragraphs.map((paragraph, p) => <p key={p} {...build(`notes-${note}-paragraph-${index}-${p}`)}>{paragraph}</p>)}
          {index === 2 && <div className="saved-observations" aria-label="收藏列表" data-scroll-region="notes-collection" tabIndex={0}>
            {collection.map((item, i) => <button key={item} className={`observation-item ${savedItems[i] ? 'is-saved' : ''}`} {...build(`notes-${note}-collection-${i}`, 'box')} aria-pressed={savedItems[i]} onClick={() => setSavedItems(items => items.map((value, position) => position === i ? !value : value))}>
              <BookmarkSimple size={17} weight={savedItems[i] ? 'fill' : 'regular'} /><span>{item}</span>{savedItems[i] && <Check size={14} />}
            </button>)}
          </div>}
          {index < article.sections.length - 1 && <hr {...build(`notes-${note}-divider-${index}`, 'line')} />}
        </section>)}
        <footer className="note-footer" {...build(`notes-${note}-footer`)}><Leaf size={16} />最后编辑于今天 10:24<span>慢慢来，也很好。</span></footer>
      </div>
    </article>
  </div>;
}

const stories = {
  nature: { category: '自然', tag: 'NATURE & EVERYDAY', title: '把自然，带回日常。', subtitle: '从一棵树、一束光和一次缓慢的散步开始，重新发现生活里微小而充沛的美。', sections: [['我们需要的，也许只是慢一点', '当生活被日程表填满，注意力开始变得稀薄。我们不断向前，却很少停下来，看看窗外的树长出了什么样的新叶。', '自然不会催促。它用自己的节奏提醒我们，生长是一件缓慢的事，也是值得等待的事。'], ['光线是房间里最好的装饰', '清晨的光柔软，午后的光明亮，傍晚的光带着一点金色。同一面墙，在一天之中拥有许多不同的表情。', '把书桌移向窗边，给一株植物留出位置。无需太多改变，日常就能多一点与外界相连的感觉。'], ['把观察变成习惯', '下次出门时，试着不戴耳机。留意街道上的声音，树叶在风里的形状，还有那些每天经过却从未仔细看过的角落。', '美并不遥远。它常常就在我们愿意多停留一秒的地方。']] },
  design: { category: '设计', tag: 'DESIGN & INTENTION', title: '好的设计，懂得留白。', subtitle: '去掉不必要的声音，让真正重要的事物，被轻松而清晰地看见。', sections: [['少一点，有时更完整', '我们习惯通过增加来解决问题：更多信息、更多功能、更多装饰。但有时，答案藏在一次减法里。', '留白不是没有内容，而是内容与内容之间恰当的距离。它让眼睛休息，也让思考发生。'], ['秩序带来轻松', '一张排版清晰的书页，一件顺手的器物，一条不需要寻找的路径。好的设计经常不被注意，因为它让一切变得自然。', '从文字的大小到按钮的位置，每个决定都应该回应一个真实的需要。'], ['给细节时间', '不要急着填满所有空间。试着把一个细节做到刚好，然后再决定下一步。', '用时间检验判断，也用使用检验设计。那些经得起日常的东西，值得被留下来。']] },
  life: { category: '生活', tag: 'LIVING WITH LESS', title: '寻常日子，也有光。', subtitle: '一杯热茶，一本翻到一半的书，一段没有目的地的路。为自己留一点轻盈的时间。', sections: [['在忙碌之间，留一个逗号', '早晨把咖啡倒进喜欢的杯子，认真吃完一顿早餐。在一天开始之前，先拥有一小段属于自己的时间。', '生活中的仪式可以很小，只要它让我们从惯性中回来。'], ['收藏真实的触感', '纸张翻动的声音，棉布晒过太阳的气味，木桌被使用后变得温润的表面。', '这些微小的触感，让抽象的日子重新变得具体。'], ['把今天过得柔软一点', '不需要每一天都很特别。给朋友发一条消息，给植物浇水，把窗打开。', '许多美好的事情，都是在如此普通的日子里慢慢积累的。']] },
};

function WebScene({ onContentChange, searchQuery = '' }) {
  const [topic, setTopic] = useState('nature');
  const [bookmarked, setBookmarked] = useState(false);
  const story = stories[topic];
  const matchedStories = Object.entries(stories).filter(([, item]) => JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase()));
  const scrollRef = useRef(null);
  useContentChange([topic, bookmarked], onContentChange);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); setBookmarked(false); }, [topic]);
  return <div className="web-scene scene-content">
    <header className="publication-header">
      <button className="publication-brand" onClick={() => setTopic('nature')} {...build('web-brand')}>FIELDNOTES<span>日常的另一种视角</span></button>
      <nav aria-label="文章主题">{Object.entries(stories).map(([id, item]) => <button key={id} className={topic === id ? 'is-current' : ''} aria-pressed={topic === id} onClick={() => setTopic(id)} {...build(`web-tab-${id}`)}>{item.category}</button>)}</nav>
      <span className="publication-issue" {...build('web-issue')}>VOL. 08 — 2026</span>
    </header>
    <div ref={scrollRef} className="publication-scroll scene-scroll" data-scroll-region="web-article" tabIndex={0}>
      {searchQuery && <div className="publication-search-results"><span {...build('web-search-summary')}>{matchedStories.length ? `找到 ${matchedStories.length} 篇相关文章` : '没有找到相关文章'}</span>{matchedStories.map(([id, item]) => <button key={id} onClick={() => setTopic(id)} {...build(`web-search-${id}`, 'box')}>{item.title}<ArrowUpRight size={14} /></button>)}</div>}
      <article className="publication-article" key={topic}>
        <div className="publication-eyebrow" {...build(`web-${topic}-eyebrow`)}><span />{story.tag}</div>
        <h1 {...build(`web-${topic}-title`)}>{story.title}</h1>
        <p className="publication-subtitle" {...build(`web-${topic}-subtitle`)}>{story.subtitle}</p>
        <div className="publication-byline" {...build(`web-${topic}-byline`, 'box')}><span>文 / 林间</span><span>2026 年 11 月 11 日</span><span>阅读约 4 分钟</span><button onClick={() => setBookmarked(value => !value)} aria-pressed={bookmarked}><BookmarkSimple size={18} weight={bookmarked ? 'fill' : 'regular'} />{bookmarked ? '已收藏' : '收藏'}</button></div>
        <figure className="publication-hero" {...build(`web-${topic}-image`, 'image')}><img src="/assets/tree-canopy.png" alt="从树荫下抬头看，阳光在绿色枝叶之间流动" /><figcaption>在缓慢生长的事物里，找回自己的节奏。</figcaption></figure>
        <div className="publication-body">{story.sections.map(([title, ...paragraphs], index) => <section key={title}>
          <div className="publication-section-number" {...build(`web-${topic}-number-${index}`)}>0{index + 1}</div>
          <h2 {...build(`web-${topic}-heading-${index}`)}>{title}</h2>
          {paragraphs.map((p, i) => <p key={i} {...build(`web-${topic}-paragraph-${index}-${i}`)}>{p}</p>)}
          {index === 0 && <blockquote {...build(`web-${topic}-quote`)}>“让注意力停留的地方，<br />成为生活开始生长的地方。”</blockquote>}
        </section>)}
          <div className="publication-end" {...build(`web-${topic}-end`, 'box')}><Leaf size={21} /><p>把日常看得更仔细一点。</p><span>FIELDNOTES</span></div>
          <div className="publication-related"><span {...build(`web-${topic}-related-label`)}>继续阅读</span>{Object.entries(stories).filter(([id]) => id !== topic).map(([id, item]) => <button key={id} onClick={() => setTopic(id)} {...build(`web-${topic}-related-${id}`, 'box')}><span>{item.title}</span><ArrowUpRight size={20} /></button>)}</div>
        </div>
      </article>
    </div>
  </div>;
}

const files = [
  { id: 'fieldnotes', name: '日常观察手记', type: '文件夹', size: '12 个项目', date: '今天 10:24', place: 'documents', icon: Folder, description: '日常散步、阅读与设计练习中，随手收集的观察和灵感。' },
  { id: 'canopy', name: '树影与光.png', type: 'PNG 图像', size: '3.2 MB', date: '今天 09:42', place: 'documents', icon: Image, description: '午后阳光穿过树冠，绿叶在风里轻轻晃动。', preview: true },
  { id: 'design', name: '设计灵感', type: '文件夹', size: '8 个项目', date: '昨天 16:18', place: 'documents', icon: Folder, description: '界面参考、配色方案与值得收藏的交互细节。' },
  { id: 'ideas', name: '一些还没长大的想法.md', type: 'Markdown 文档', size: '4 KB', date: '昨天 14:06', place: 'documents', icon: FileText, description: '先把想法写下来。或许还不完整，但每一个开始都值得被记录。' },
  { id: 'beebuild', name: 'BeeBuild', type: '文件夹', size: '6 个项目', date: '11 月 9 日', place: 'desktop', icon: Folder, description: '把熟悉的界面，一点一点重新建造。' },
  { id: 'moodboard', name: '秋日情绪板.png', type: 'PNG 图像', size: '2.8 MB', date: '11 月 8 日', place: 'desktop', icon: Image, description: '温暖的奶油色、柔和的鼠尾草绿，以及自然的纹理。', preview: true },
  { id: 'reading', name: '阅读清单.pdf', type: 'PDF 文稿', size: '248 KB', date: '11 月 7 日', place: 'downloads', icon: BookOpen, description: '关于设计、自然与生活的书。读过的，想读的，和准备再读一次的。' },
  { id: 'weekend', name: '周末散步路线.pdf', type: 'PDF 文稿', size: '164 KB', date: '11 月 6 日', place: 'downloads', icon: FileText, description: '从河边出发，经过一家书店，最后在街角的咖啡馆停下来。' },
  { id: 'archive', name: '十月归档', type: '文件夹', size: '21 个项目', date: '10 月 31 日', place: 'documents', icon: Folder, description: '为过去一个月做一个小小的整理，给新的想法留出空间。' },
  { id: 'morning-light', name: '晨光观察手记.md', type: 'Markdown 文档', size: '6 KB', date: '11 月 9 日', place: 'documents', icon: FileText, description: '连续一周记录阳光进入房间的时间，看看同一面墙如何拥有不同的表情。' },
  { id: 'interaction-study', name: '交互细节实验', type: '文件夹', size: '9 个项目', date: '11 月 9 日', place: 'documents', icon: Folder, description: '围绕暂停、继续和撤销做的小实验，寻找轻巧又明确的操作反馈。' },
  { id: 'reading-summary', name: '《设计中的设计》阅读摘要.pdf', type: 'PDF 文稿', size: '186 KB', date: '11 月 8 日', place: 'documents', icon: BookOpen, description: '摘录关于日常、感受与重新发现的段落，并写下读到它们时的联想。' },
  { id: 'type-spacing', name: '中文排版与行间距.md', type: 'Markdown 文档', size: '8 KB', date: '11 月 8 日', place: 'documents', icon: FileText, description: '比较不同字号、行高与段落宽度，记录长时间阅读时更舒服的组合。' },
  { id: 'week-review', name: '十一月第一周回顾.md', type: 'Markdown 文档', size: '5 KB', date: '11 月 7 日', place: 'documents', icon: FileText, description: '整理这一周完成的小事、遇到的问题，以及下周最想继续的一个方向。' },
  { id: 'color-notes', name: '街角的颜色', type: '文件夹', size: '14 个项目', date: '11 月 7 日', place: 'documents', icon: Folder, description: '从书店招牌、旧墙面和植物里收集颜色，保存它们原本相邻的关系。' },
  { id: 'motion-rhythm', name: '动画节奏练习.md', type: 'Markdown 文档', size: '7 KB', date: '11 月 6 日', place: 'documents', icon: FileText, description: '让同一个动作分别缓慢、轻快和果断地发生，观察速度如何改变感受。' },
  { id: 'garden-journal', name: '阳台植物记录.md', type: 'Markdown 文档', size: '11 KB', date: '11 月 6 日', place: 'documents', icon: FileText, description: '新叶、浇水和换盆的日期，以及植物在不同季节里悄悄发生的变化。' },
  { id: 'observation-walk', name: '河边散步观察.pdf', type: 'PDF 文稿', size: '327 KB', date: '11 月 5 日', place: 'documents', icon: FileText, description: '沿河步道上的长椅、指示牌与树影，组成了一份关于公共空间的小笔记。' },
  { id: 'interface-order', name: '界面的秩序感.md', type: 'Markdown 文档', size: '9 KB', date: '11 月 5 日', place: 'documents', icon: FileText, description: '从对齐、重复和间距出发，拆解那些看起来安静却很容易使用的界面。' },
  { id: 'paper-experiments', name: '纸上原型', type: '文件夹', size: '7 个项目', date: '11 月 4 日', place: 'documents', icon: Folder, description: '用简单的纸片和文字试验信息顺序，在动手实现之前先把流程走一遍。' },
  { id: 'objects-reading', name: '《日用之美》阅读摘要.pdf', type: 'PDF 文稿', size: '203 KB', date: '11 月 4 日', place: 'documents', icon: BookOpen, description: '关于器物、使用与时间的读书笔记，提醒自己留意每天触碰的东西。' },
  { id: 'sound-of-day', name: '日常声音清单.md', type: 'Markdown 文档', size: '3 KB', date: '11 月 3 日', place: 'documents', icon: FileText, description: '翻书、键盘和雨落在窗台上的声音，为以后的动效配音留下具体参考。' },
  { id: 'small-tools', name: '轻巧工具的设计原则.md', type: 'Markdown 文档', size: '12 KB', date: '11 月 3 日', place: 'documents', icon: FileText, description: '只在需要的时候出现，始终知道如何退出，让工具成为顺手的小习惯。' },
  { id: 'bookshop-map', name: '想再去一次的书店.pdf', type: 'PDF 文稿', size: '284 KB', date: '11 月 2 日', place: 'documents', icon: BookOpen, description: '记录书架的排列、窗边座位和店里正在播放的音乐，下次散步时再去看看。' },
  { id: 'micro-feedback', name: '微交互反馈对照表.md', type: 'Markdown 文档', size: '6 KB', date: '11 月 2 日', place: 'documents', icon: FileText, description: '把悬停、点击、等待与完成的反馈放在一起，检查它们是否有共同的节奏。' },
  { id: 'workbench', name: '工作台整理', type: '文件夹', size: '5 个项目', date: '11 月 1 日', place: 'documents', icon: Folder, description: '整理仍在进行的草图与参考资料，把接下来要用的东西放在容易找到的位置。' },
  { id: 'quiet-moments', name: '安静时刻的观察.md', type: 'Markdown 文档', size: '4 KB', date: '10 月 30 日', place: 'documents', icon: FileText, description: '记录那些没有发生什么，却让人想停留片刻的画面：空椅子、窗帘和一杯茶。' },
  { id: 'first-draft', name: '第一版草图回顾.pdf', type: 'PDF 文稿', size: '418 KB', date: '10 月 29 日', place: 'documents', icon: FileText, description: '回头看看最初的草图，标记仍然成立的想法，以及已经被实践改变的判断。' },
  { id: 'questions', name: '留给明天的问题.md', type: 'Markdown 文档', size: '5 KB', date: '10 月 28 日', place: 'documents', icon: FileText, description: '暂时不必回答的问题也值得留下，让下一次阅读或散步带来新的连接。' },
];
const fileLocations = [
  { id: 'recent', label: '最近使用', icon: Clock }, { id: 'desktop', label: '桌面', icon: Desktop },
  { id: 'documents', label: '文稿', icon: FileText }, { id: 'downloads', label: '下载', icon: DownloadSimple },
  { id: 'favorites', label: '个人收藏', icon: Star },
];

function AppsScene({ onContentChange, searchQuery = '' }) {
  const [location, setLocation] = useState('documents');
  const query = searchQuery;
  const [selected, setSelected] = useState('canopy');
  const [view, setView] = useState('list');
  const [favorites, setFavorites] = useState(['canopy', 'fieldnotes']);
  const visibleFiles = files.filter(file => (location === 'recent' || (location === 'favorites' ? favorites.includes(file.id) : file.place === location)) && file.name.toLowerCase().includes(query.toLowerCase()));
  const selectedFile = visibleFiles.find(file => file.id === selected);
  useContentChange([location, view, selected, favorites], onContentChange);
  const selectLocation = id => { setLocation(id); const nextFile = files.find(file => id === 'recent' || (id === 'favorites' ? favorites.includes(file.id) : file.place === id)); setSelected(nextFile?.id || null); };
  return <div className="files-scene scene-content">
    <aside className="files-sidebar" aria-label="文件位置"><div className="sidebar-caption" {...build('apps-favorites-caption')}>个人收藏</div>
      {fileLocations.map(item => <button key={item.id} className={`file-location ${location === item.id ? 'is-current' : ''}`} aria-pressed={location === item.id} onClick={() => selectLocation(item.id)} {...build(`apps-location-${item.id}`, 'box')}><item.icon size={19} /><span>{item.label}</span></button>)}
      <div className="sidebar-caption location-caption" {...build('apps-locations-caption')}>位置</div>
      <div className="file-location file-disk" {...build('apps-disk', 'box')}><HardDrives size={19} /><span>Macintosh HD</span></div>
      <div className="sidebar-caption tags-caption" {...build('apps-tags-caption')}>标签</div>
      <button className="file-location" onClick={() => selectLocation('favorites')} {...build('apps-tag-green', 'box')}><span className="file-tag-dot" />灵感</button>
    </aside>
    <main className="files-main">
      <div className="files-controls"><h2 {...build('apps-location-title')}>{fileLocations.find(item => item.id === location)?.label}</h2><span className="files-location-path" {...build('apps-location-path')}>Macintosh HD / 用户 / Studio</span><div className="files-view-options" {...build('apps-view-options', 'box')}><button className={view === 'grid' ? 'is-current' : ''} aria-label="图标视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><GridFour size={19} /></button><button className={view === 'list' ? 'is-current' : ''} aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={20} /></button></div></div>
      {view === 'list' && <div className="files-column-labels" {...build('apps-column-labels', 'box')}><span>名称 <CaretDown size={11} /></span><span>修改日期</span><span>种类</span></div>}
      <div className={`files-content scene-scroll is-${view}`} data-scroll-region="apps-file-list" tabIndex={0} aria-label="文件列表">
        {visibleFiles.map(file => <button key={file.id} className={`file-row ${selected === file.id ? 'is-current' : ''}`} aria-pressed={selected === file.id} onClick={() => setSelected(file.id)} {...build(`apps-file-${file.id}`, 'box')}><span className="file-name"><file.icon size={view === 'grid' ? 54 : 21} weight={file.icon === Folder ? 'fill' : 'regular'} className={file.icon === Folder ? 'file-folder-icon' : 'file-document-icon'} /><span>{file.name}</span></span><span className="file-date">{file.date}</span><span className="file-type">{file.type}</span></button>)}
        {visibleFiles.length === 0 && <div className="files-empty" {...build('apps-empty', 'box')}><MagnifyingGlass size={34} /><p>没有找到“{query}”</p><span>试试另一个文件名称</span></div>}
      </div>
      <footer className="files-status" {...build('apps-status')}><Folder size={13} /><span>{fileLocations.find(item => item.id === location)?.label}</span><span>{visibleFiles.length} 个项目</span></footer>
    </main>
    {selectedFile && <aside className="file-detail scene-scroll" data-scroll-region="apps-detail" aria-label="文件详情" key={selectedFile.id}>
      {selectedFile.preview ? <figure className="file-detail-preview" {...build(`apps-detail-${selectedFile.id}-preview`, 'image')}><img src="/assets/tree-canopy.png" alt={selectedFile.description} /></figure> : <div className="file-detail-large-icon" {...build(`apps-detail-${selectedFile.id}-icon`, 'image')}><selectedFile.icon size={88} weight={selectedFile.icon === Folder ? 'fill' : 'regular'} /></div>}
      <h3 {...build(`apps-detail-${selectedFile.id}-name`)}>{selectedFile.name}</h3>
      <p className="file-detail-type" {...build(`apps-detail-${selectedFile.id}-type`)}>{selectedFile.type} · {selectedFile.size}</p>
      <button className={`file-favorite-button ${favorites.includes(selectedFile.id) ? 'is-saved' : ''}`} onClick={() => setFavorites(items => items.includes(selectedFile.id) ? items.filter(id => id !== selectedFile.id) : [...items, selectedFile.id])} {...build(`apps-detail-${selectedFile.id}-favorite`, 'box')}><Star size={15} weight={favorites.includes(selectedFile.id) ? 'fill' : 'regular'} />{favorites.includes(selectedFile.id) ? '已加入个人收藏' : '加入个人收藏'}</button>
      <hr {...build(`apps-detail-${selectedFile.id}-divider`, 'line')} />
      <h4 {...build(`apps-detail-${selectedFile.id}-information`)}>信息</h4><dl {...build(`apps-detail-${selectedFile.id}-metadata`, 'box')}><div><dt>修改时间</dt><dd>{selectedFile.date}</dd></div><div><dt>大小</dt><dd>{selectedFile.size}</dd></div><div><dt>位置</dt><dd>Macintosh HD / {fileLocations.find(item => item.id === selectedFile.place)?.label}</dd></div></dl>
      <h4 {...build(`apps-detail-${selectedFile.id}-description-label`)}>备注</h4><p className="file-detail-description" {...build(`apps-detail-${selectedFile.id}-description`)}>{selectedFile.description}</p>
    </aside>}
  </div>;
}

export function SceneContent({ scene, onContentChange, searchQuery = '' }) {
  if (scene === 'web') return <WebScene onContentChange={onContentChange} searchQuery={searchQuery} />;
  if (scene === 'apps') return <AppsScene onContentChange={onContentChange} searchQuery={searchQuery} />;
  return <NotesScene onContentChange={onContentChange} searchQuery={searchQuery} />;
}
