document.addEventListener('DOMContentLoaded', () => {
  const sidebarEl = document.querySelector('.sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  const searchInputEl = document.getElementById('sidebar-search-input');
  const exportDialog = document.getElementById('export-dialog');
  const closeExportBtn = document.getElementById('close-export');
  const exportTextEl = document.getElementById('export-text');
  const downloadExportBtn = document.getElementById('download-export');
  const importDialog = document.getElementById('import-dialog');
  const closeImportBtn = document.getElementById('close-import');
  const importFileEl = document.getElementById('import-file');
  const importStatusEl = document.getElementById('import-status');
  const applyImportBtn = document.getElementById('apply-import');
  const aboutDialog = document.getElementById('about-dialog');
  const closeAboutBtn = document.getElementById('close-about');
  const menuExportBtn = document.getElementById('menu-export');
  const menuImportBtn = document.getElementById('menu-import');
  const menuAboutBtn = document.getElementById('menu-about');

  const viewTimelineBtn = document.getElementById('view-timeline');
  const viewMasonryBtn = document.getElementById('view-masonry');
  const sidebarCalendar = document.getElementById('sidebar-calendar');
  const sidebarCategories = document.getElementById('sidebar-categories');
  const categoryListEl = document.getElementById('category-list');

  const timelineListEl = document.getElementById('timeline-list');
  const emptyStateEl = document.getElementById('empty-state');
  const timelineDateEl = document.getElementById('timeline-date');
  const timelineCountEl = document.getElementById('timeline-count');
  const prevDayBtn = document.getElementById('prev-day');
  const nextDayBtn = document.getElementById('next-day');
  const calPrevBtn = document.getElementById('cal-prev');
  const calNextBtn = document.getElementById('cal-next');
  const calYearSelect = document.getElementById('cal-year');
  const calMonthSelect = document.getElementById('cal-month');
  const calGridEl = document.getElementById('cal-grid');

  let allNotes = [];
  let rangeStart = null;
  let rangeEnd = null;
  let calendarMonth = null;
  let selectedDayKey = null;
  let noteCountsByDay = new Map();
  let searchQuery = '';
  let pendingImportData = null;
  let currentView = 'timeline';
  let selectedCategory = 'All';

  setDefaultTodayRange();
  initCalendarControls();
  initViewToggles();
  initSidebar();
  initMenuAndDialogs();
  loadAllNotes();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.notes) {
      allNotes = changes.notes.newValue || [];
      noteCountsByDay = buildNoteCountsByDay(allNotes);
      renderCalendar();
      renderList();
    }
  });

  async function loadAllNotes() {
    const result = await chrome.storage.local.get(['notes']);
    allNotes = result.notes || [];
    noteCountsByDay = buildNoteCountsByDay(allNotes);
    renderCalendar();
    renderList();
  }

  function setDefaultTodayRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    rangeStart = new Date(y, m, d, 0, 0, 0, 0);
    rangeEnd = new Date(y, m, d, 23, 59, 59, 999);
    updateHeader(rangeStart, rangeEnd);
    selectedDayKey = toDayKey(rangeStart);
    calendarMonth = new Date(y, m, 1);
  }

  function initCalendarControls() {
    if (!calYearSelect || !calMonthSelect) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 5; y++) years.push(y);
    calYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    calMonthSelect.innerHTML = Array.from({ length: 12 }).map((_, i) => {
      const v = i + 1;
      return `<option value="${i}">${v}</option>`;
    }).join('');

    const syncSelects = () => {
      calYearSelect.value = String(calendarMonth.getFullYear());
      calMonthSelect.value = String(calendarMonth.getMonth());
    };

    syncSelects();

    calPrevBtn?.addEventListener('click', () => {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
      syncSelects();
      renderCalendar();
    });

    calNextBtn?.addEventListener('click', () => {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
      syncSelects();
      renderCalendar();
    });

    calYearSelect.addEventListener('change', () => {
      const y = Number(calYearSelect.value);
      calendarMonth = new Date(y, calendarMonth.getMonth(), 1);
      renderCalendar();
    });

    calMonthSelect.addEventListener('change', () => {
      const m = Number(calMonthSelect.value);
      calendarMonth = new Date(calendarMonth.getFullYear(), m, 1);
      renderCalendar();
    });

    calGridEl?.addEventListener('click', (e) => {
      const dayEl = e.target.closest?.('.cal-day');
      if (!dayEl || dayEl.classList.contains('is-empty')) return;
      const dayKey = dayEl.dataset.day;
      if (!dayKey) return;
      const date = fromDayKey(dayKey);
      clearSearch();
      setSelectedDay(date);
      renderCalendar();
      renderList();
    });
  }

  function initViewToggles() {
    viewTimelineBtn?.addEventListener('click', () => setView('timeline'));
    viewMasonryBtn?.addEventListener('click', () => setView('masonry'));
  }

  function setView(view) {
    if (currentView === view) return;
    currentView = view;

    // Update buttons
    viewTimelineBtn?.classList.toggle('active', view === 'timeline');
    viewMasonryBtn?.classList.toggle('active', view === 'masonry');

    // Update Layout
    document.body.classList.toggle('masonry-view', view === 'masonry');

    // Update Sidebar
    if (view === 'masonry') {
      sidebarCalendar?.classList.add('hidden');
      sidebarCategories?.classList.remove('hidden');
      renderCategories();
    } else {
      sidebarCalendar?.classList.remove('hidden');
      sidebarCategories?.classList.add('hidden');
    }

    renderList();
  }

  function renderCategories() {
    if (!categoryListEl) return;
    
    const counts = new Map();
    counts.set('All', 0);

    allNotes.forEach(note => {
      counts.set('All', counts.get('All') + 1);
      let domain = 'Unknown';
      try {
        if (note.url) {
          const urlObj = new URL(note.url);
          domain = urlObj.hostname;
        }
      } catch (e) {}
      counts.set(domain, (counts.get(domain) || 0) + 1);
    });

    // Sort: All first, then by count desc, then alpha
    const sortedCats = [...counts.keys()].filter(k => k !== 'All').sort((a, b) => {
      const cA = counts.get(a);
      const cB = counts.get(b);
      if (cA !== cB) return cB - cA;
      return a.localeCompare(b);
    });
    sortedCats.unshift('All');

    categoryListEl.innerHTML = '';
    sortedCats.forEach(cat => {
      const count = counts.get(cat);
      const li = document.createElement('li');
      li.className = 'nav-item';
      if (cat === selectedCategory) li.classList.add('active');
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = cat;
      const countSpan = document.createElement('span');
      countSpan.className = 'nav-count';
      countSpan.textContent = count;
      
      li.appendChild(nameSpan);
      li.appendChild(countSpan);
      
      li.onclick = () => {
        selectedCategory = cat;
        renderCategories(); // update active state
        renderList();
      };
      categoryListEl.appendChild(li);
    });
  }

  function initSidebar() {
    if (!sidebarEl) return;
    const collapsed = localStorage.getItem('homeSidebarCollapsed') === '1';
    if (collapsed) sidebarEl.classList.add('is-collapsed');

    sidebarToggleBtn?.addEventListener('click', () => {
      const next = !sidebarEl.classList.contains('is-collapsed');
      sidebarEl.classList.toggle('is-collapsed', next);
      localStorage.setItem('homeSidebarCollapsed', next ? '1' : '0');
    });

    if (searchInputEl) {
      let t = null;
      searchInputEl.addEventListener('input', () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          const q = (searchInputEl.value || '').trim();
          searchQuery = q;
          if (!q) {
            renderCalendar();
          }
          renderList();
        }, 150);
      });
    }
  }

  function initMenuAndDialogs() {
    menuExportBtn?.addEventListener('click', async () => {
      if (!exportDialog) return;
      const data = await chrome.storage.local.get(null);
      const json = JSON.stringify(data, null, 2);
      if (exportTextEl) exportTextEl.value = json;
      exportDialog.classList.remove('hidden');
    });

    closeExportBtn?.addEventListener('click', () => exportDialog?.classList.add('hidden'));
    exportDialog?.addEventListener('click', (e) => {
      if (e.target === exportDialog) exportDialog.classList.add('hidden');
    });

    downloadExportBtn?.addEventListener('click', async () => {
      const data = await chrome.storage.local.get(null);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dayKey = toDayKey(new Date());
      a.href = url;
      a.download = `footprints-backup-${dayKey}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    menuImportBtn?.addEventListener('click', () => {
      pendingImportData = null;
      if (importFileEl) importFileEl.value = '';
      if (importStatusEl) importStatusEl.textContent = '';
      importDialog?.classList.remove('hidden');
    });

    closeImportBtn?.addEventListener('click', () => importDialog?.classList.add('hidden'));
    importDialog?.addEventListener('click', (e) => {
      if (e.target === importDialog) importDialog.classList.add('hidden');
    });

    importFileEl?.addEventListener('change', async () => {
      pendingImportData = null;
      if (!importFileEl.files || !importFileEl.files[0]) return;
      try {
        const text = await importFileEl.files[0].text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Invalid backup format');
        }
        pendingImportData = data;
        const notesCount = Array.isArray(data.notes) ? data.notes.length : 0;
        if (importStatusEl) importStatusEl.textContent = `已读取备份：notes=${notesCount}`;
      } catch (e) {
        pendingImportData = null;
        if (importStatusEl) importStatusEl.textContent = '备份文件解析失败';
      }
    });

    applyImportBtn?.addEventListener('click', async () => {
      if (!pendingImportData) {
        if (importStatusEl) importStatusEl.textContent = '请先选择有效的备份文件';
        return;
      }
      if (!confirm('将用备份覆盖当前数据，是否继续？')) return;
      await chrome.storage.local.clear();
      await chrome.storage.local.set(pendingImportData);
      importDialog?.classList.add('hidden');
      await loadAllNotes();
    });

    menuAboutBtn?.addEventListener('click', () => aboutDialog?.classList.remove('hidden'));
    closeAboutBtn?.addEventListener('click', () => aboutDialog?.classList.add('hidden'));
    aboutDialog?.addEventListener('click', (e) => {
      if (e.target === aboutDialog) aboutDialog.classList.add('hidden');
    });
  }

  function clearSearch() {
    searchQuery = '';
    if (searchInputEl) searchInputEl.value = '';
  }

  function buildNoteCountsByDay(notes) {
    const map = new Map();
    notes.forEach(n => {
      if (!n.createdAt) return;
      const dt = new Date(n.createdAt);
      if (Number.isNaN(dt.getTime())) return;
      const key = toDayKey(dt);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }

  function toDayKey(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function fromDayKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function setSelectedDay(date) {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    rangeStart = new Date(y, m, d, 0, 0, 0, 0);
    rangeEnd = new Date(y, m, d, 23, 59, 59, 999);
    selectedDayKey = toDayKey(rangeStart);
  }

  function renderCalendar() {
    if (!calGridEl || !calendarMonth) return;
    calGridEl.innerHTML = '';

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const mondayIndex = (first.getDay() + 6) % 7;
    for (let i = 0; i < mondayIndex; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day is-empty';
      calGridEl.appendChild(empty);
    }

    const todayKey = toDayKey(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = toDayKey(date);
      const count = noteCountsByDay.get(key) || 0;

      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.dataset.day = key;

      if (count > 0) cell.classList.add('has-notes');
      if (key === selectedDayKey) cell.classList.add('is-selected');
      if (key === todayKey) cell.classList.add('is-today');

      const num = document.createElement('span');
      num.className = 'cal-day-num';
      num.textContent = String(day);
      cell.appendChild(num);

      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'cal-day-count';
        badge.textContent = String(count);
        cell.appendChild(badge);
      }

      calGridEl.appendChild(cell);
    }
  }

  function renderList() {
    timelineListEl.innerHTML = '';
    
    let filtered;
    if (currentView === 'masonry') {
      if (selectedCategory === 'All') {
        filtered = allNotes;
      } else {
        filtered = allNotes.filter(n => {
          try {
            return new URL(n.url).hostname === selectedCategory;
          } catch {
            return selectedCategory === 'Unknown';
          }
        });
      }
      if (searchQuery) {
        filtered = filterBySearch(filtered, searchQuery);
      }
    } else {
      filtered = searchQuery ? filterBySearch(allNotes, searchQuery) : filterByRange(allNotes, rangeStart, rangeEnd);
    }

    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    if (!sorted.length) {
      emptyStateEl.classList.remove('hidden');
      if (searchQuery) {
        emptyStateEl.textContent = 'No results.';
      } else if (currentView === 'masonry') {
        emptyStateEl.textContent = 'No footprints found.';
      } else {
        const today = new Date();
        const sameDay =
          rangeStart.getFullYear() === today.getFullYear() &&
          rangeStart.getMonth() === today.getMonth() &&
          rangeStart.getDate() === today.getDate() &&
          rangeEnd.getFullYear() === today.getFullYear() &&
          rangeEnd.getMonth() === today.getMonth() &&
          rangeEnd.getDate() === today.getDate();
        emptyStateEl.textContent = sameDay ? '今天还没有留下足迹' : 'No footprints yet.';
      }
      timelineCountEl.textContent = '';
    } else {
      emptyStateEl.classList.add('hidden');
      timelineCountEl.textContent = searchQuery ? `Found ${sorted.length} footprints` : `Added ${sorted.length} footprints`;
    }
    
    if (currentView !== 'masonry') {
      if (searchQuery) {
        timelineDateEl.textContent = `Search: ${searchQuery}`;
      } else {
        updateHeader(rangeStart, rangeEnd);
      }
    }

    sorted.forEach(note => {
      const li = document.createElement('li');

      if (note.quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'note-quote';
        quoteDiv.textContent = `"${note.quote}"`;
        li.appendChild(quoteDiv);
      }

      if (note.content) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'note-content';
        contentDiv.textContent = note.content;
        li.appendChild(contentDiv);
      }

      const footerDiv = document.createElement('div');
      footerDiv.className = 'note-item-footer';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'note-date';
      dateSpan.textContent = new Date(note.createdAt).toLocaleString();
      footerDiv.appendChild(dateSpan);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'note-actions';

      const locateBtn = document.createElement('button');
      locateBtn.className = 'btn-icon btn-locate';
      locateBtn.innerHTML = `<span class="iconfont icon-location" title="${note.url || ''}"></span>`;
      locateBtn.title = 'Locate on Page';
      if (!note.range || !note.url) {
        locateBtn.disabled = true;
        locateBtn.style.opacity = '0.3';
      } else {
        locateBtn.onclick = () => locateNote(note);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon btn-delete';
      deleteBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
      deleteBtn.title = 'Delete Note';
      deleteBtn.onclick = () => deleteNote(note.id);

      actionsDiv.appendChild(locateBtn);
      actionsDiv.appendChild(deleteBtn);
      footerDiv.appendChild(actionsDiv);
      li.appendChild(footerDiv);

      timelineListEl.appendChild(li);
    });
  }

  function filterByRange(notes, start, end) {
    if (!start || !end) return notes;
    const s = start.getTime();
    const e = end.getTime();
    return notes.filter(n => {
      const t = new Date(n.createdAt).getTime();
      return t >= s && t <= e;
    });
  }

  function filterBySearch(notes, query) {
    const q = String(query || '').toLowerCase();
    if (!q) return notes;
    return notes.filter(n => {
      const content = (n.content || '').toLowerCase();
      const quote = (n.quote || '').toLowerCase();
      const url = (n.url || '').toLowerCase();
      return content.includes(q) || quote.includes(q) || url.includes(q);
    });
  }

  function updateHeader(start, end) {
    const sameDay = start && end &&
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    if (sameDay) {
      timelineDateEl.textContent = start.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      const fmt = (dt) => dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      timelineDateEl.textContent = `${fmt(start)} — ${fmt(end)}`;
    }
  }

  async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    const result = await chrome.storage.local.get(['notes']);
    let notes = result.notes || [];
    notes = notes.filter(n => n.id !== noteId);
    await chrome.storage.local.set({ notes: notes });
  }

  function locateNote(note) {
    chrome.tabs.create({ url: note.url }, (tab) => {
      const tabId = tab.id;
      const listener = (updatedId, changeInfo) => {
        if (updatedId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.sendMessage(tabId, {
            type: 'SCROLL_TO_NOTE',
            noteId: note.id
          });
          chrome.tabs.onUpdated.removeListener(listener);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  prevDayBtn.addEventListener('click', () => {
    clearSearch();
    const dayMs = 24 * 60 * 60 * 1000;
    rangeStart = new Date(rangeStart.getTime() - dayMs);
    rangeEnd = new Date(rangeEnd.getTime() - dayMs);
    selectedDayKey = toDayKey(rangeStart);
    calendarMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    if (calYearSelect && calMonthSelect) {
      calYearSelect.value = String(calendarMonth.getFullYear());
      calMonthSelect.value = String(calendarMonth.getMonth());
    }
    renderCalendar();
    renderList();
  });

  nextDayBtn.addEventListener('click', () => {
    clearSearch();
    const dayMs = 24 * 60 * 60 * 1000;
    rangeStart = new Date(rangeStart.getTime() + dayMs);
    rangeEnd = new Date(rangeEnd.getTime() + dayMs);
    selectedDayKey = toDayKey(rangeStart);
    calendarMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    if (calYearSelect && calMonthSelect) {
      calYearSelect.value = String(calendarMonth.getFullYear());
      calMonthSelect.value = String(calendarMonth.getMonth());
    }
    renderCalendar();
    renderList();
  });
});
