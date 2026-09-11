import { SITE_COPY } from './site-copy'
import {
  parseNarrative,
  parseSiteCopy,
  type LiveAct,
  type LiveBeat,
  type LiveContent,
  type LiveNarrative,
  type LiveSiteCopy,
} from './live-content'
import { LIVE_EDIT_SOURCE, type LiveEditDraft, type LiveEditKey, type LiveEditSession } from './live-edit'

/**
 * 现场编辑会话（按需加载，普通访客永远不会下载这个文件）。
 *
 * ## 怎么知道页面上哪句话是哪条
 *
 * 不去逐个组件加标注——几百处 `<SiteText>`、`t()`、区块标题散在几十个组件里，
 * 很多还是作为字符串属性一路传下去的。这里在**内容进入组件之前**给每一段文字
 * 末尾接一个不可见标记（Unicode 的默认可忽略字符，浏览器不绘制），标记里编着
 * 这段文字在登记表里的序号。组件照常渲染，标记跟着文字落进 DOM；之后扫一遍
 * 文本节点就知道每句话从哪来。
 *
 * 档案数据（节目简介、游戏名、条目标题）是构建期烤进 HTML 的，不经过这里，
 * 所以由后台把原文发过来，按「元素的完整文字等于这句原文」去认。
 *
 * 只有编辑会话里的内容带标记；会话结束或刷新后一切照旧。
 */

const DIGITS = [0x200b, 0x200c, 0x200d, 0x2060].map((code) => String.fromCharCode(code))
const OPEN = String.fromCharCode(0x2063)
const CLOSE = String.fromCharCode(0x2064)
const MARKER = new RegExp('\\u2063([\\u200b\\u200c\\u200d\\u2060]+)\\u2064', 'g')
const ANY_MARKER = new RegExp('\\u2063[\\u200b\\u200c\\u200d\\u2060]+\\u2064', 'g')

const ATTR = 'data-i6-edit'
const UI_ID = 'i6-live-edit-ui'
const STYLE_ID = 'i6-live-edit-style'
const MARKED_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'] as const
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'video', 'audio', 'canvas'])
const INVENTORY_LIMIT = 400

type Kind = 'now' | 'publish'
type Path = (string | number)[]

const kindOf = (key: LiveEditKey): Kind => (key.doc === 'copy' || key.doc === 'narrative' ? 'now' : 'publish')
const keyId = (key: LiveEditKey) => `${key.doc}:${JSON.stringify(key.path)}`
const normalize = (text: string) => text.replace(ANY_MARKER, '').replace(/\s+/g, ' ').trim()

const BASELINE_TEXT = new Map(SITE_COPY.texts.map((item) => [item.id, item.text]))

export function startLiveEditSession(
  host: Window,
  origin: string,
  onDraft: (draft: LiveEditDraft) => void,
): LiveEditSession {
  // --- 登记表：一处文字 ↔ 一个序号 -------------------------------------------
  const keys: LiveEditKey[] = []
  const indexById = new Map<string, number>()

  const markerFor = (key: LiveEditKey): string => {
    const id = keyId(key)
    let index = indexById.get(id)
    if (index === undefined) {
      index = keys.length
      keys.push(key)
      indexById.set(id, index)
    }
    let digits = ''
    let rest = index
    do {
      digits = DIGITS[rest & 3] + digits
      rest >>= 2
    } while (rest > 0)
    return OPEN + digits + CLOSE
  }

  const decode = (digits: string): LiveEditKey | undefined => {
    let index = 0
    for (const char of digits) index = index * 4 + DIGITS.indexOf(char)
    return keys[index]
  }

  /**
   * 空串不加标记：组件大量用「有字才渲染」来决定显示与否，给空串加标记会把
   * 后台刻意留空的小标重新显示出来。换行前也补一个——按行拆段的组件
   * （`SiteTextParagraphs`）每一段都要能点。
   */
  const mark = (text: string, key: LiveEditKey): string => {
    if (text === '') return text
    const marker = markerFor(key)
    return text.replace(/\n/g, `${marker}\n`) + marker
  }

  // --- 给内容接标记 ---------------------------------------------------------
  const encodeCopy = (copy: LiveSiteCopy): LiveSiteCopy => {
    const c = (text: string, path: Path) => mark(text, { doc: 'copy', path })
    const block = (scope: 'homeSections' | 'pages') => (item: LiveSiteCopy['pages'][number]) => ({
      id: item.id,
      eyebrow: c(item.eyebrow, [scope, `@${item.id}`, 'eyebrow']),
      title: c(item.title, [scope, `@${item.id}`, 'title']),
      lede: c(item.lede, [scope, `@${item.id}`, 'lede']),
    })
    return {
      site: copy.site,
      nav: copy.nav.map((item) => ({ id: item.id, label: c(item.label, ['nav', `@${item.id}`, 'label']) })),
      hero: {
        status: c(copy.hero.status, ['hero', 'status']),
        eyebrow: c(copy.hero.eyebrow, ['hero', 'eyebrow']),
        title: c(copy.hero.title, ['hero', 'title']),
        body: copy.hero.body.map((line, index) => c(line, ['hero', 'body', index])),
        primaryAction: c(copy.hero.primaryAction, ['hero', 'primaryAction']),
        secondaryAction: c(copy.hero.secondaryAction, ['hero', 'secondaryAction']),
      },
      homeSections: copy.homeSections.map(block('homeSections')),
      rooms: copy.rooms.map((room) => ({
        id: room.id,
        kicker: c(room.kicker, ['rooms', `@${room.id}`, 'kicker']),
        title: c(room.title, ['rooms', `@${room.id}`, 'title']),
        body: c(room.body, ['rooms', `@${room.id}`, 'body']),
      })),
      pages: copy.pages.map(block('pages')),
      maintainers: copy.maintainers.map((person) => ({
        id: person.id,
        name: c(person.name, ['maintainers', `@${person.id}`, 'name']),
        role: c(person.role, ['maintainers', `@${person.id}`, 'role']),
      })),
      // 后台留空的句子在页面上显示默认文字，也得能点——把默认文字接上标记放进来。
      texts: copy.texts.map((item) => ({
        id: item.id,
        text: c(item.text.trim() !== '' ? item.text : (BASELINE_TEXT.get(item.id) ?? ''), ['texts', `@${item.id}`, 'text']),
      })),
    }
  }

  /**
   * 叙事里只标纯展示文字。`date`（编年史按它归年）、`chips`（蒙太奇按它取素材）、
   * `emphasis`（含构建期占位符）、颜色和规格都参与逻辑，不能碰。
   */
  const encodeNarrative = (narrative: LiveNarrative): LiveNarrative => {
    const n = (text: string, path: Path) => mark(text, { doc: 'narrative', path })
    const beat = (base: Path) => (item: LiveBeat): LiveBeat => {
      const at = [...base, 'beats', `@${item.id}`]
      return {
        ...item,
        kicker: n(item.kicker, [...at, 'kicker']),
        title: n(item.title, [...at, 'title']),
        body: n(item.body, [...at, 'body']),
        tail: n(item.tail, [...at, 'tail']),
        footnote: { ...item.footnote, text: n(item.footnote.text, [...at, 'footnote', 'text']) },
      }
    }
    const act = (scope: 'homeActs' | 'storyActs') => (item: LiveAct): LiveAct => {
      const at: Path = [scope, `@${item.id}`]
      return {
        ...item,
        kicker: n(item.kicker, [...at, 'kicker']),
        title: n(item.title, [...at, 'title']),
        body: item.body.map((line, index) => n(line, [...at, 'body', index])),
        label: n(item.label, [...at, 'label']),
        years: n(item.years, [...at, 'years']),
        closer: { line: n(item.closer.line, [...at, 'closer', 'line']), tail: n(item.closer.tail, [...at, 'closer', 'tail']) },
        beats: item.beats.map(beat(at)),
      }
    }
    return {
      homeActs: narrative.homeActs.map(act('homeActs')),
      storyActs: narrative.storyActs.map(act('storyActs')),
      highlights: narrative.highlights.map((item) => ({
        ...item,
        kicker: n(item.kicker, ['highlights', `@${item.id}`, 'kicker']),
        title: n(item.title, ['highlights', `@${item.id}`, 'title']),
        body: n(item.body, ['highlights', `@${item.id}`, 'body']),
      })),
      deletedIds: narrative.deletedIds,
    }
  }

  /** 后台文档里没有编年史卡片的封面（那是公开接口按档案现算的），从线上那份补过来。 */
  const withLiveCovers = (draft: LiveNarrative, live: LiveNarrative | null): LiveNarrative => {
    if (!live) return draft
    return {
      ...draft,
      storyActs: draft.storyActs.map((act) => {
        const liveAct = live.storyActs.find((candidate) => candidate.id === act.id)
        if (!liveAct) return act
        return {
          ...act,
          beats: act.beats.map((beat) => {
            if (beat.entryCover !== undefined) return beat
            const liveBeat = liveAct.beats.find((candidate) => candidate.id === beat.id)
            return liveBeat && liveBeat.entryId === beat.entryId ? { ...beat, entryCover: liveBeat.entryCover } : beat
          }),
        }
      }),
    }
  }

  const apply = (content: LiveContent, draft: LiveEditDraft | null): LiveContent => {
    const copy = draft?.copy ?? content.copy
    const narrative = draft?.narrative ? withLiveCovers(draft.narrative, content.narrative) : content.narrative
    scheduleScan()
    return {
      copy: copy ? encodeCopy(copy) : null,
      narrative: narrative ? encodeNarrative(narrative) : null,
      editorial: content.editorial,
    }
  }

  // --- 页面上的描边与点选 ---------------------------------------------------
  let editing = true
  let elementKeys = new Map<Element, LiveEditKey[]>()
  let publishIndex = new Map<string, LiveEditKey[]>()
  let selected = new Set<string>()
  let hovered: Element | null = null
  let lastInventory = ''
  let lastPath = ''
  let scanTimer: number | null = null

  const post = (message: Record<string, unknown>) => host.postMessage({ source: LIVE_EDIT_SOURCE, ...message }, origin)

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
html.i6-edit-outlines [${ATTR}~="now"]{outline:1px solid rgba(52,211,153,.55);outline-offset:2px}
html.i6-edit-outlines [${ATTR}~="publish"]{outline:1px dashed rgba(245,158,11,.8);outline-offset:2px}
html.i6-editing [${ATTR}]{cursor:pointer}
[${ATTR}].i6-edit-hover{outline:2px solid rgba(52,211,153,.95)!important;outline-offset:2px;background-color:rgba(52,211,153,.1)}
[${ATTR}~="publish"].i6-edit-hover{outline:2px dashed #f59e0b!important;background-color:rgba(245,158,11,.1)}
[${ATTR}].i6-edit-selected{outline:2px solid #34d399!important;outline-offset:2px;background-color:rgba(52,211,153,.16)}
[${ATTR}~="publish"].i6-edit-selected{outline:2px solid #f59e0b!important;background-color:rgba(245,158,11,.16)}
[${ATTR}].i6-edit-flash{animation:i6-edit-flash 1.4s ease-out}
@keyframes i6-edit-flash{0%{box-shadow:0 0 0 8px rgba(255,255,255,.4)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
#${UI_ID}{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;padding:2px 7px;border-radius:4px;font:600 12px/1.5 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#0b0d12;white-space:nowrap;display:none}
`
  document.head.appendChild(style)
  const tip = document.createElement('div')
  tip.id = UI_ID
  document.body.appendChild(tip)
  document.documentElement.classList.add('i6-editing', 'i6-edit-outlines')

  const textPreview = (element: Element) => normalize(element.textContent ?? '').slice(0, 80)

  const scan = () => {
    scanTimer = null
    const next = new Map<Element, Map<string, LiveEditKey>>()
    const add = (element: Element, key: LiveEditKey) => {
      let entry = next.get(element)
      if (!entry) {
        entry = new Map()
        next.set(element, entry)
      }
      entry.set(keyId(key), key)
    }

    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const value = node.nodeValue
      if (!value || !value.includes(OPEN)) continue
      const element = node.parentElement
      if (!element || element.id === UI_ID) continue
      MARKER.lastIndex = 0
      for (let match = MARKER.exec(value); match; match = MARKER.exec(value)) {
        const key = decode(match[1]!)
        if (key) add(element, key)
      }
    }

    const selector = MARKED_ATTRIBUTES.map((name) => `[${name}]`).join(',')
    for (const element of document.body.querySelectorAll(selector)) {
      for (const name of MARKED_ATTRIBUTES) {
        const value = element.getAttribute(name)
        if (!value || !value.includes(OPEN)) continue
        MARKER.lastIndex = 0
        for (let match = MARKER.exec(value); match; match = MARKER.exec(value)) {
          const key = decode(match[1]!)
          if (key) add(element, key)
        }
      }
    }

    // 档案数据：元素的完整文字等于某条原文。取最里层——外面那层只包着它时文字也一样。
    if (publishIndex.size > 0) {
      const candidates = new Map<Element, string>()
      const elements = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node) =>
          SKIP_TAGS.has((node as Element).tagName.toLowerCase()) || (node as Element).id === UI_ID
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      })
      for (let node = elements.nextNode(); node; node = elements.nextNode()) {
        const element = node as Element
        if (element.childElementCount > 12) continue
        const raw = element.textContent ?? ''
        if (raw.length < 2 || raw.length > 2400) continue
        const text = normalize(raw)
        if (publishIndex.has(text)) candidates.set(element, text)
      }
      for (const [element, text] of candidates) {
        let parent = element.parentElement
        while (parent && candidates.get(parent) === text) {
          candidates.delete(parent)
          parent = parent.parentElement
        }
      }
      for (const [element, text] of candidates) for (const key of publishIndex.get(text) ?? []) add(element, key)
    }

    for (const element of elementKeys.keys()) {
      if (!next.has(element)) element.removeAttribute(ATTR)
    }
    elementKeys = new Map()
    for (const [element, entry] of next) {
      const list = [...entry.values()]
      elementKeys.set(element, list)
      const kinds = [...new Set(list.map(kindOf))].sort().join(' ')
      if (element.getAttribute(ATTR) !== kinds) element.setAttribute(ATTR, kinds)
    }
    paintSelection()
    report()
  }

  const scheduleScan = () => {
    if (scanTimer !== null) return
    scanTimer = window.setTimeout(scan, 160)
  }

  const report = () => {
    const path = window.location.pathname
    if (path !== lastPath) {
      lastPath = path
      post({ type: 'location', path, title: document.title })
    }
    const seen = new Set<string>()
    const items: { key: LiveEditKey; text: string }[] = []
    let total = 0
    for (const [element, list] of elementKeys) {
      for (const key of list) {
        const id = keyId(key)
        if (seen.has(id)) continue
        seen.add(id)
        total += 1
        if (items.length < INVENTORY_LIMIT) items.push({ key, text: textPreview(element) })
      }
    }
    const serialized = JSON.stringify([path, total, items])
    if (serialized === lastInventory) return
    lastInventory = serialized
    post({ type: 'inventory', path, total, items })
  }

  const paintSelection = () => {
    for (const [element, list] of elementKeys) {
      element.classList.toggle('i6-edit-selected', list.some((key) => selected.has(keyId(key))))
    }
  }

  const editableFrom = (target: EventTarget | null): Element | null => {
    if (!editing || !(target instanceof Element)) return null
    const element = target.closest(`[${ATTR}]`)
    return element && elementKeys.has(element) ? element : null
  }

  const setHover = (element: Element | null) => {
    if (hovered === element) return
    hovered?.classList.remove('i6-edit-hover')
    hovered = element
    if (!element) {
      tip.style.display = 'none'
      return
    }
    element.classList.add('i6-edit-hover')
    const kinds = new Set((elementKeys.get(element) ?? []).map(kindOf))
    tip.textContent = kinds.has('now') && kinds.has('publish') ? '立即生效 · 需发布' : kinds.has('publish') ? '需发布' : '立即生效'
    tip.style.background = kinds.has('publish') && !kinds.has('now') ? '#f59e0b' : '#34d399'
    const rect = element.getBoundingClientRect()
    tip.style.display = 'block'
    tip.style.transform = `translate(${Math.max(0, Math.round(rect.left))}px, ${Math.max(0, Math.round(rect.top - 24))}px)`
  }

  const onOver = (event: Event) => setHover(editableFrom(event.target))
  const onScroll = () => setHover(null)

  /** 编辑状态下点到可改的字：拦下链接跳转和翻页，改成选中。按住 Alt / Option 点照常跳转。 */
  const onPress = (event: Event) => {
    if ((event as MouseEvent).altKey) return
    if (editableFrom(event.target)) event.stopPropagation()
  }
  const onClick = (event: MouseEvent) => {
    if (event.altKey) return
    const element = editableFrom(event.target)
    if (!element) return
    event.preventDefault()
    event.stopPropagation()
    const list = elementKeys.get(element) ?? []
    selected = new Set(list.map(keyId))
    paintSelection()
    post({ type: 'select', items: list.map((key) => ({ key, text: textPreview(element) })) })
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || selected.size === 0) return
    selected = new Set()
    paintSelection()
    post({ type: 'select', items: [] })
  }

  const isKey = (value: unknown): value is LiveEditKey =>
    typeof value === 'object' &&
    value !== null &&
    ['copy', 'narrative', 'catalog', 'entry'].includes((value as LiveEditKey).doc) &&
    Array.isArray((value as LiveEditKey).path)

  const onMessage = (event: MessageEvent) => {
    if (event.source !== host || event.origin !== origin) return
    const data = event.data as Record<string, unknown> | null
    if (!data || data.source !== LIVE_EDIT_SOURCE) return
    switch (data.type) {
      case 'draft': {
        onDraft({
          copy: data.copy === undefined ? null : parseSiteCopy({ copy: data.copy }),
          narrative: data.narrative === undefined ? null : parseNarrative({ narrative: data.narrative }),
        })
        break
      }
      case 'publish-items': {
        const next = new Map<string, LiveEditKey[]>()
        const items = Array.isArray(data.items) ? data.items : []
        for (const item of items as { key?: unknown; text?: unknown }[]) {
          if (!isKey(item?.key) || typeof item.text !== 'string') continue
          const text = normalize(item.text)
          if (text.length < 2) continue
          next.set(text, [...(next.get(text) ?? []), item.key])
        }
        publishIndex = next
        scheduleScan()
        break
      }
      case 'options': {
        editing = data.editing !== false
        document.documentElement.classList.toggle('i6-editing', editing)
        document.documentElement.classList.toggle('i6-edit-outlines', data.outlines !== false)
        if (!editing) setHover(null)
        break
      }
      case 'selected': {
        const list = Array.isArray(data.keys) ? data.keys.filter(isKey) : []
        selected = new Set(list.map(keyId))
        paintSelection()
        break
      }
      case 'reveal': {
        if (!isKey(data.key)) break
        const id = keyId(data.key)
        for (const [element, list] of elementKeys) {
          if (!list.some((key) => keyId(key) === id)) continue
          element.scrollIntoView({ block: 'center', behavior: 'smooth' })
          element.classList.remove('i6-edit-flash')
          void (element as HTMLElement).offsetWidth
          element.classList.add('i6-edit-flash')
          break
        }
        break
      }
    }
  }

  // 自己往 DOM 里写的属性和提示框不算页面变化，只看节点增删与文字变动。
  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => mutation.target === tip || tip.contains(mutation.target))) return
    scheduleScan()
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  window.addEventListener('message', onMessage)
  document.addEventListener('mouseover', onOver, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('pointerdown', onPress, true)
  window.addEventListener('mousedown', onPress, true)
  window.addEventListener('click', onClick, true)
  window.addEventListener('keydown', onKey)
  window.addEventListener('popstate', scheduleScan)

  post({ type: 'active', path: window.location.pathname })
  scheduleScan()

  return {
    apply,
    dispose: () => {
      observer.disconnect()
      if (scanTimer !== null) window.clearTimeout(scanTimer)
      window.removeEventListener('message', onMessage)
      document.removeEventListener('mouseover', onOver, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('pointerdown', onPress, true)
      window.removeEventListener('mousedown', onPress, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', scheduleScan)
      for (const element of elementKeys.keys()) {
        element.removeAttribute(ATTR)
        element.classList.remove('i6-edit-hover', 'i6-edit-selected', 'i6-edit-flash')
      }
      document.documentElement.classList.remove('i6-editing', 'i6-edit-outlines')
      style.remove()
      tip.remove()
    },
  }
}
