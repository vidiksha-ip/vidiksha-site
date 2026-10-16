// Minimal Markdown -> HTML renderer with front matter. Covers what the blog needs:
// headings, paragraphs, bold/italic/code/links, lists, blockquotes, fenced code, tables, hr.
'use strict';

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push('<code>' + escText(c) + '</code>');
    return '\u0000' + (codes.length - 1) + '\u0000';
  });
  text = escText(text);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*\w])\*([^*]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return text;
}

function render(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const para = [];
  let i = 0;
  const flush = () => {
    if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para.length = 0; }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flush();
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escText(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const lvl = h[1].length;
      const text = h[2].trim();
      const id = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
      out.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }

    if (/^>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
      continue;
    }

    const listMatch = (l) => /^(\s*)([-*]|\d+\.)\s+/.exec(l);
    if (listMatch(line) && !/^\s/.test(line)) {
      flush();
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && listMatch(lines[i]) && !/^\s/.test(lines[i])) {
        let item = lines[i++].replace(/^([-*]|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !listMatch(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${tag}>`);
      continue;
    }

    if (/^\|/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = cells(rows[0]);
      const body = rows.slice(1).filter((r) => !/^\|?\s*:?-{2,}/.test(r)).map(cells);
      let html = '<div class="table-wrap"><table><thead><tr>' + header.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
      html += body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('');
      html += '</tbody></table></div>';
      out.push(html);
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

function parseFrontMatter(src) {
  const text = String(src).replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const raw of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/^(true|false)$/.test(v)) v = v === 'true';
    else v = v.replace(/^["']|["']$/g, '');
    data[kv[1]] = v;
  }
  return { data, body: text.slice(m[0].length) };
}

function wordCount(md) {
  return String(md).replace(/[#*`>|\-]/g, ' ').split(/\s+/).filter(Boolean).length;
}

module.exports = { render, inline, parseFrontMatter, wordCount, escText };
