(function (global) {
  'use strict';

  // Keep this to the small set of tags used in local content.
  // Escape the text first, then add those tags back.
  function render(value) {
    const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
    const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = text => esc(text)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    const out = [], stack = [];
    const closeList = () => { if (stack.length) out.push('</ul>'); stack.length = 0; };
    lines.forEach(raw => {
      const line = raw.trimEnd();
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      const check = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (!line.trim()) { closeList(); if (out.length && !out[out.length - 1].endsWith('</p>')) out.push('<br>'); return; }
      if (heading) { closeList(); const level = heading[1].length; out.push(`<h${level}>${inline(heading[2])}</h${level}>`); return; }
      if (check) { if (!stack.length) out.push('<ul class="md-list">'); stack.push('list'); out.push(`<li class="md-check"><span aria-hidden="true">${check[1].toLowerCase() === 'x' ? '☑' : '☐'}</span> ${inline(check[2])}</li>`); return; }
      if (bullet) { if (!stack.length) out.push('<ul class="md-list">'); stack.push('list'); out.push(`<li>${inline(bullet[1])}</li>`); return; }
      closeList(); out.push(`<p>${inline(line)}</p>`);
    });
    closeList();
    return out.join('');
  }
  global.AtriaSafeMarkdown = Object.freeze({ render });
})(window);
