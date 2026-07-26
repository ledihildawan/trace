// A deliberately small subset of Markdown for day notes.
//
// Supported: paragraphs, single line breaks, `-`/`*`/`+` bullets, `1.` ordered
// lists, **bold**, *italic* and `code`.
//
// Not supported, on purpose: links, images, raw HTML, headings, tables, code
// fences. Notes are user input and can arrive from an imported archive, so the
// renderer below only ever creates a fixed set of elements and only ever puts
// text through textContent. There is no HTML string anywhere in this file, so
// there is nothing for markup in a note to escape into.

const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
// Code first so its contents are never re-parsed, then bold before italic so
// ** is not mistaken for two single asterisks.
const INLINE = /`([^`\n]+)`|\*\*([^\n]+?)\*\*|\*([^\n]+?)\*/g;

// Splits one line into styled runs. Nesting is not supported: the first
// matching marker wins and its contents are taken literally.
export function parseSpans(line) {
  const text = String(line ?? '');
  const spans = [];
  let last = 0;
  let match;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    if (match[1] !== undefined) spans.push({ text: match[1], code: true });
    else if (match[2] !== undefined) spans.push({ text: match[2], bold: true });
    else spans.push({ text: match[3], italic: true });
    last = INLINE.lastIndex;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.filter((span) => span.text !== '');
}

// Turns note source into blocks:
//   { type: 'paragraph', lines: Span[][] }
//   { type: 'list', ordered: boolean, items: Span[][] }
export function parseRichText(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };
  const intoList = (ordered, content) => {
    flushParagraph();
    if (!list || list.ordered !== ordered) {
      flushList();
      list = { type: 'list', ordered, items: [] };
    }
    list.items.push(parseSpans(content));
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      intoList(false, bullet[1]);
      continue;
    }
    const ordered = ORDERED.exec(line);
    if (ordered) {
      intoList(true, ordered[1]);
      continue;
    }
    flushList();
    paragraph.push(parseSpans(line));
  }

  flushParagraph();
  flushList();
  return blocks;
}

const SPAN_TAG = { code: 'code', bold: 'strong', italic: 'em' };

function appendSpans(parent, spans, doc) {
  for (const span of spans) {
    const tag = SPAN_TAG[Object.keys(SPAN_TAG).find((key) => span[key])];
    if (!tag) {
      parent.append(doc.createTextNode(span.text));
      continue;
    }
    const el = doc.createElement(tag);
    el.textContent = span.text; // never innerHTML
    parent.append(el);
  }
}

// Builds a DocumentFragment. Callers append it; nothing is parsed as HTML.
export function renderRichText(source, doc = document) {
  const fragment = doc.createDocumentFragment();

  for (const block of parseRichText(source)) {
    if (block.type === 'list') {
      const listEl = doc.createElement(block.ordered ? 'ol' : 'ul');
      for (const item of block.items) {
        const li = doc.createElement('li');
        appendSpans(li, item, doc);
        listEl.append(li);
      }
      fragment.append(listEl);
      continue;
    }

    const p = doc.createElement('p');
    block.lines.forEach((spans, index) => {
      if (index > 0) p.append(doc.createElement('br'));
      appendSpans(p, spans, doc);
    });
    fragment.append(p);
  }

  return fragment;
}
