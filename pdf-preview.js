document.addEventListener('DOMContentLoaded', async () => {
  const previewListEl = document.getElementById('preview-list');
  const previewTitleEl = document.getElementById('preview-title');
  const previewMetaEl = document.getElementById('preview-meta');
  const printBtn = document.getElementById('action-print');
  const coverRangeEl = document.getElementById('pdf-cover-range');
  const coverSourceEl = document.getElementById('pdf-cover-source');
  const coverThoughtsEl = document.getElementById('pdf-cover-thoughts');

  // Load data and config
  const notesResp = await chrome.runtime.sendMessage({ type: 'DB_GET_NOTES' });
  const allNotes = (notesResp && notesResp.data) ? notesResp.data : [];
  const cfgResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'pdfExportConfig' });
  const config = (cfgResp && cfgResp.data) ? cfgResp.data : {};

  // Parse config
  const startStr = config.startStr || '';
  const endStr = config.endStr || '';
  const site = config.site || '';
  const start = startStr ? new Date(startStr + 'T00:00:00') : null;
  const end = endStr ? new Date(endStr + 'T23:59:59') : null;

  // Filter notes
  let filtered = allNotes;
  if (start || end) {
    filtered = filtered.filter(n => {
      const t = new Date(n.createdAt).getTime();
      const okStart = start ? t >= start.getTime() : true;
      const okEnd = end ? t <= end.getTime() : true;
      return okStart && okEnd;
    });
  }
  
  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  if (site) {
    filtered = filtered.filter(n => getHostname(n.url) === site);
  }

  const titleParts = [];
  if (startStr || endStr) {
    titleParts.push(`${startStr || 'Start'} to ${endStr || 'Present'}`);
  } else {
    titleParts.push('All Time');
  }
  
  if (site) {
    previewTitleEl.textContent = `Footprints from ${site}`;
  } else {
    previewTitleEl.textContent = 'Footprints Export';
  }
  
  previewMetaEl.textContent = `${titleParts.join(' • ')} • ${filtered.length} items`;

  const formatMonthYear = (str, fallback) => {
    if (!str) return fallback;
    const d = new Date(str + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  let coverRangeText;
  if (startStr || endStr) {
    const startLabel = formatMonthYear(startStr, 'Start');
    const endLabel = formatMonthYear(endStr, 'Present');
    coverRangeText = `${startLabel} – ${endLabel}`;
  } else {
    coverRangeText = 'All time';
  }
  if (coverRangeEl) coverRangeEl.textContent = coverRangeText;

  const sourceText = site ? `source: ${site}` : 'source: All websites';
  if (coverSourceEl) coverSourceEl.textContent = sourceText;

  if (coverThoughtsEl) {
    coverThoughtsEl.textContent = `thoughts: ${filtered.length}`;
  }

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (sorted.length === 0) {
    previewListEl.innerHTML = '<div style="text-align:center; color:#666; padding: 20px;">No footprints found for this selection.</div>';
  } else {
    const groups = new Map();
    sorted.forEach(n => {
      let key;
      if (!n.range && (!n.quote || n.quote.trim() === '')) {
        key = `unique-note-${n.id}`;
      } else {
        key = n.range ? JSON.stringify(n.range) : `quote:${(n.quote || '').trim()}:${n.url || ''}`;
      }
      let group = groups.get(key);
      if (!group) {
        group = { quote: n.quote || '', range: n.range || null, url: n.url || '', items: [] };
        groups.set(key, group);
      }
      group.items.push(n);
    });

    previewListEl.innerHTML = '';
    Array.from(groups.values()).forEach(group => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const hasReference = group.quote || group.range;

      if (group.quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'note-quote';
        quoteDiv.textContent = group.quote;
        li.appendChild(quoteDiv);
      }

      const listEl = document.createElement('ul');
      listEl.className = 'note-items';

      group.items.forEach(item => {
        if (!item.content || !item.content.trim()) return;

        const itemLi = document.createElement('li');
        itemLi.className = 'note-item';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'note-content';
        contentDiv.textContent = item.content;
        itemLi.appendChild(contentDiv);

        if (hasReference) {
          const metaDiv = document.createElement('div');
          metaDiv.className = 'note-meta';

          const dateSpan = document.createElement('span');
          const dt = new Date(item.createdAt);
          dateSpan.textContent = Number.isNaN(dt.getTime()) ? '' : dt.toLocaleString();
          metaDiv.appendChild(dateSpan);

          const hostSpan = document.createElement('span');
          hostSpan.textContent = getHostname(group.url || item.url || '');
          metaDiv.appendChild(hostSpan);

          itemLi.appendChild(metaDiv);
        }
        listEl.appendChild(itemLi);
      });

      li.appendChild(listEl);

      const footerDiv = document.createElement('div');
      footerDiv.className = 'note-item-footer';

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'note-actions';

      const createTimeSpan = document.createElement('span');
      createTimeSpan.className = 'group-create-time';
      if (group.items.length > 0) {
        createTimeSpan.textContent = new Date(group.items[0].createdAt).toLocaleString();
      }
      actionsDiv.appendChild(createTimeSpan);

      footerDiv.appendChild(actionsDiv);
      li.appendChild(footerDiv);

      previewListEl.appendChild(li);
    });
  }

  // Handle Print/Export
  printBtn.addEventListener('click', async () => {
    window.print();
    
    // Save history
    try {
      const histResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'pdfExportHistory' });
      const list = (histResp && histResp.data && Array.isArray(histResp.data)) ? histResp.data : [];
      list.unshift({
        createdAt: new Date().toISOString(),
        start: startStr || null,
        end: endStr || null,
        site: site || null,
        count: filtered.length
      });
      if (list.length > 10) list.length = 10;
      await chrome.runtime.sendMessage({ type: 'DB_SET_SETTING', payload: { key: 'pdfExportHistory', value: list } });
    } catch (e) {
      console.error('Failed to save history', e);
    }
  });
}); 
