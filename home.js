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
  const addNoteDialog = document.getElementById('add-note-dialog');
  const closeAddNoteBtn = document.getElementById('close-add-note');
  const addNoteTextEl = document.getElementById('add-note-text');
  const confirmAddNoteBtn = document.getElementById('confirm-add-note');
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
  let pendingAddContext = null;

  setDefaultTodayRange();
  initCalendarControls();
  initViewToggles();
  initThoughtModal();
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

  function initThoughtModal() {
    const viewThoughtBtn = document.getElementById('view-thought');
    const thoughtDialog = document.getElementById('thought-dialog');
    const closeThoughtBtn = document.getElementById('close-thought');
    const thoughtTextEl = document.getElementById('thought-text');
    const thoughtMetaEl = document.getElementById('thought-meta');
    const thoughtCommentsEl = document.getElementById('thought-comments');
    const thoughtCommentsListEl = document.getElementById('thought-comments-list');
    const thoughtCommentInput = document.getElementById('thought-comment-input');
    const thoughtCommentSubmit = document.getElementById('thought-comment-submit');
    const thoughtThemeToggle = document.getElementById('thought-theme-toggle');

    if (!viewThoughtBtn || !thoughtDialog || !closeThoughtBtn || !thoughtTextEl || !thoughtMetaEl) return;

    // Theme Logic
    const toggleTheme = (isDark) => {
        if (isDark) {
            thoughtDialog.classList.add('dark-mode');
            if (thoughtThemeToggle) thoughtThemeToggle.textContent = 'Light';
        } else {
            thoughtDialog.classList.remove('dark-mode');
            if (thoughtThemeToggle) thoughtThemeToggle.textContent = 'Dark';
        }
    };

    // Load preference
    chrome.storage.local.get(['thoughtTheme'], (result) => {
        if (result.thoughtTheme === 'dark') {
            toggleTheme(true);
        }
    });

    thoughtThemeToggle?.addEventListener('click', () => {
        const isDark = thoughtDialog.classList.contains('dark-mode');
        toggleTheme(!isDark);
        chrome.storage.local.set({ thoughtTheme: !isDark ? 'dark' : 'light' });
    });

    let currentThoughtGroup = null;

    const renderCommentsList = () => {
      if (!currentThoughtGroup || !thoughtCommentsListEl) return;
      thoughtCommentsListEl.innerHTML = '';
      
      // Filter items that have content (these are comments/notes)
      // If the group was formed by a highlight (quote), then all items with content are comments.
      // If the group was formed by a standalone note, the note itself is content.
      // But we are displaying the "main" text. 
      // Let's assume:
      // - If we displayed a quote, then any item with content is a comment.
      // - If we displayed content (standalone), then any OTHER item with content is a comment?
      //   Actually, standalone notes usually don't have other items unless we added them.
      //   The current data model doesn't explicitly link "replies". 
      //   It links by "quote" or "range".
      //   So if we add a new note with the same quote/range, it becomes part of the group.
      
      const comments = currentThoughtGroup.items.filter(item => item.content && item.content.trim());
      
      // If we are displaying a standalone note, the "main" text IS one of these contents.
      // We should probably NOT display the main text as a comment again.
      // But `currentThoughtGroup.items` contains ALL items.
      // The `renderRandomThought` logic decides what text to show.
      // If `currentThoughtGroup.quote` exists, we showed the quote. So ALL contents are comments.
      // If `currentThoughtGroup.quote` does NOT exist, we showed `items[0].content`.
      // So we should exclude `items[0]` from comments list? Or just show everything else?
      
      let commentsToShow = comments;
      if (!currentThoughtGroup.quote) {
        // Standalone note case: The first item's content is the "Thought".
        // So comments are the REST of the items.
        // But `items` might not be sorted by creation time in the group object we build on the fly?
        // Let's assume we sort them by time.
        commentsToShow = comments.filter(c => c.content !== thoughtTextEl.textContent.replace(/^"|"$/g, ''));
      }

      if (commentsToShow.length === 0) {
        // Optional: show "No comments yet" or just empty
      }

      commentsToShow.forEach(comment => {
        const div = document.createElement('div');
        div.className = 'thought-comment-item';
        
        const textDiv = document.createElement('div');
        textDiv.textContent = comment.content;
        div.appendChild(textDiv);
        
        const footerDiv = document.createElement('div');
        footerDiv.className = 'thought-comment-footer';

        const dateDiv = document.createElement('div');
        dateDiv.className = 'thought-comment-date';
        dateDiv.textContent = new Date(comment.createdAt).toLocaleString();
        footerDiv.appendChild(dateDiv);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'thought-comment-delete';
        deleteBtn.title = 'Delete thought';
        deleteBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
        deleteBtn.onclick = () => handleDeleteComment(comment.id);
        footerDiv.appendChild(deleteBtn);

        div.appendChild(footerDiv);
        
        thoughtCommentsListEl.appendChild(div);
      });
    };

    const handleDeleteComment = async (commentId) => {
        if (!confirm('Are you sure you want to delete this thought?')) return;

        // Remove from storage
        const result = await chrome.storage.local.get(['notes']);
        let notes = result.notes || [];
        notes = notes.filter(n => n.id !== commentId);
        await chrome.storage.local.set({ notes });

        // Update local state
        allNotes = notes;
        if (currentThoughtGroup) {
            currentThoughtGroup.items = currentThoughtGroup.items.filter(item => item.id !== commentId);
        }

        // Re-render
        renderCommentsList();
        renderMeta();
    };

    const handleSubmitComment = async () => {
        const text = (thoughtCommentInput?.value || '').trim();
        if (!text || !currentThoughtGroup) return;

        const newNote = {
          id: Date.now(),
          content: text,
          createdAt: new Date().toISOString(),
          quote: currentThoughtGroup.quote || thoughtTextEl.textContent.replace(/^"|"$/g, ''), // Use displayed text as quote reference if needed
          url: currentThoughtGroup.url || '',
          range: currentThoughtGroup.range || null
        };
        
        // Save
        const result = await chrome.storage.local.get(['notes']);
        const notes = result.notes || [];
        notes.unshift(newNote);
        await chrome.storage.local.set({ notes });
        
        // Update local state
        allNotes = notes; // Ideally we wait for listener, but for immediate UI feedback:
        currentThoughtGroup.items.push(newNote);
        
        // Clear input
        thoughtCommentInput.value = '';
        
        // Re-render list
        renderCommentsList();
        
        // Update comment count button
        const count = currentThoughtGroup.items.filter(i => i.content && i.content.trim()).length;
        // Note: if standalone, we might need to adjust count logic to match display
        // But simpler is just to re-render the whole thought or update the button text.
        // Let's update the specific button if possible, or just re-render meta.
        // Since we don't have ref to button easily, let's just re-render meta (it's fast).
        renderMeta();
    };
    
    thoughtCommentSubmit?.addEventListener('click', handleSubmitComment);
    thoughtCommentInput?.addEventListener('keydown', (e) => {
        // Ctrl+Enter or Cmd+Enter to submit
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmitComment();
        }
    });

    const renderMeta = () => {
        if (!currentThoughtGroup) return;
        thoughtMetaEl.innerHTML = '';
        
        const item = currentThoughtGroup.items[0]; // Representative item for date/url
        
        // Info Icon
        const infoIcon = document.createElement('div');
        infoIcon.className = 'thought-info-icon';
        infoIcon.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div class="thought-tooltip">Some thoughts are worth meeting again, even after time has moved on.</div>
        `;
        thoughtMetaEl.appendChild(infoIcon);

        // Date
        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(item.createdAt).toLocaleDateString();
        thoughtMetaEl.appendChild(dateSpan);
        
        // Locate Button
        const locateBtn = document.createElement('button');
        locateBtn.className = 'thought-btn';
        locateBtn.innerHTML = '<span class="iconfont icon-location"></span> Locate';
        if (!currentThoughtGroup.url) {
            locateBtn.disabled = true;
            locateBtn.style.opacity = '0.5';
            locateBtn.style.cursor = 'default';
        } else {
            locateBtn.onclick = () => {
            locateNote(item);
            };
        }
        thoughtMetaEl.appendChild(locateBtn);
        
        // Comment Button
        // Count comments
        let commentCount = 0;
        if (currentThoughtGroup.quote) {
             commentCount = currentThoughtGroup.items.filter(i => i.content && i.content.trim()).length;
        } else {
             // Standalone: count items excluding the main one? 
             // Or just count all items? User said "if there are annotations, show count".
             // For standalone, the "main" one IS the content. So maybe count - 1?
             // Let's stick to "count of items with content".
             // If it's a standalone note (1 item), count is 1. Does that make sense?
             // Maybe "1 comment" looks weird if it IS the note.
             // Let's say: if highlight, count = items with content.
             // If standalone, count = items with content - 1 (replies).
             const allContentItems = currentThoughtGroup.items.filter(i => i.content && i.content.trim());
             commentCount = allContentItems.length;
             if (!currentThoughtGroup.quote && commentCount > 0) commentCount--; 
        }

        const commentBtn = document.createElement('button');
        commentBtn.className = 'thought-btn';
        const countSuffix = commentCount > 0 ? ` ${commentCount}` : '';
        commentBtn.innerHTML = `<span class="iconfont icon-comment"></span> Thoughts${countSuffix}`;
        commentBtn.onclick = () => {
            thoughtCommentsEl.classList.toggle('hidden');
            if (!thoughtCommentsEl.classList.contains('hidden')) {
                renderCommentsList();
                setTimeout(() => thoughtCommentInput.focus(), 100);
            }
        };
        thoughtMetaEl.appendChild(commentBtn);
        
        // Change Button
        const changeBtn = document.createElement('button');
        changeBtn.className = 'thought-btn';
        changeBtn.innerHTML = '<span class="iconfont icon-sync"></span> Change';
        changeBtn.onclick = () => {
            renderRandomThought();
        };
        thoughtMetaEl.appendChild(changeBtn);
    };

    const renderRandomThought = () => {
      // Group all notes to find "Thought Groups"
      const groups = {};
      allNotes.forEach(n => {
          let key;
          if (!n.range && (!n.quote || n.quote.trim() === '')) {
            key = `unique-note-${n.id}`; // Standalone note
          } else {
            // Group by range (if exists) or quote+url
            key = n.range ? JSON.stringify(n.range) : `quote:${(n.quote || '').trim()}:${n.url || ''}`;
          }
          if (!groups[key]) groups[key] = { 
              quote: n.quote || '', 
              range: n.range || null, 
              url: n.url || '', 
              items: [] 
          };
          groups[key].items.push(n);
      });
      
      const groupKeys = Object.keys(groups);
      if (groupKeys.length === 0) {
        thoughtTextEl.textContent = "No footprints yet. Go leave some!";
        thoughtTextEl.style.fontSize = "24px";
        thoughtMetaEl.innerHTML = '';
        return;
      }

      const randomKey = groupKeys[Math.floor(Math.random() * groupKeys.length)];
      currentThoughtGroup = groups[randomKey];
      
      // Hide comments initially
      thoughtCommentsEl.classList.add('hidden');
      
      // Text logic
      let text = '';
      if (currentThoughtGroup.quote) {
          text = currentThoughtGroup.quote;
      } else {
          // Standalone note: use content of first item
          if (currentThoughtGroup.items.length > 0) {
              text = currentThoughtGroup.items[0].content;
          }
      }
      
      // Dynamic font size
      const len = text.length;
      let fontSize = 24;
      if (len > 50) {
        fontSize = Math.max(14, 24 - Math.floor((len - 50) / 30));
      }
      
      thoughtTextEl.textContent = `"${text}"`;
      thoughtTextEl.style.fontSize = `${fontSize}px`;
      
      renderMeta();
    };

    const openModal = () => {
      renderRandomThought();
      thoughtDialog.classList.remove('hidden');
      // Force reflow
      void thoughtDialog.offsetWidth;
      thoughtDialog.classList.add('active');
    };

    const closeModal = () => {
      thoughtDialog.classList.remove('active');
      setTimeout(() => {
        thoughtDialog.classList.add('hidden');
      }, 300); // Match transition duration
    };

    viewThoughtBtn.addEventListener('click', openModal);
    closeThoughtBtn.addEventListener('click', closeModal);

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && thoughtDialog.classList.contains('active')) {
        closeModal();
      }
    });
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
    if (collapsed) {
      sidebarEl.classList.add('is-collapsed');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) icon.className = 'iconfont icon-indent';
    } else {
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) icon.className = 'iconfont icon-outdent';
    }

    sidebarToggleBtn?.addEventListener('click', () => {
      const next = !sidebarEl.classList.contains('is-collapsed');
      sidebarEl.classList.toggle('is-collapsed', next);
      localStorage.setItem('homeSidebarCollapsed', next ? '1' : '0');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (icon) {
        icon.className = next ? 'iconfont icon-indent' : 'iconfont icon-outdent';
      }
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
        if (importStatusEl) importStatusEl.textContent = `Backup loaded: notes=${notesCount}`;
      } catch (e) {
        pendingImportData = null;
        if (importStatusEl) importStatusEl.textContent = 'Failed to parse backup file';
      }
    });

    applyImportBtn?.addEventListener('click', async () => {
      if (!pendingImportData) {
        if (importStatusEl) importStatusEl.textContent = 'Please select a valid backup file first';
        return;
      }
      if (!confirm('This will overwrite current data with the backup. Continue?')) return;
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

    // Add Annotation Dialog
    closeAddNoteBtn?.addEventListener('click', () => addNoteDialog?.classList.add('hidden'));
    addNoteDialog?.addEventListener('click', (e) => {
      if (e.target === addNoteDialog) addNoteDialog.classList.add('hidden');
    });
    confirmAddNoteBtn?.addEventListener('click', async () => {
      if (!pendingAddContext) { addNoteDialog?.classList.add('hidden'); return; }
      const text = (addNoteTextEl?.value || '').trim();
      if (!text) { addNoteDialog?.classList.add('hidden'); return; }
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      const newNote = {
        id: Date.now(),
        content: text,
        createdAt: new Date().toISOString(),
        quote: pendingAddContext.quote || null,
        url: pendingAddContext.url || '',
        range: pendingAddContext.range || null
      };
      notes.unshift(newNote);
      await chrome.storage.local.set({ notes });
      addNoteDialog?.classList.add('hidden');
      pendingAddContext = null;
      if (addNoteTextEl) addNoteTextEl.value = '';
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
        emptyStateEl.textContent = sameDay ? 'No footprints today yet.' : 'No footprints yet.';
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

    const groups = {};
    sorted.forEach(n => {
      let key;
      if (!n.range && (!n.quote || n.quote.trim() === '')) {
        key = `unique-note-${n.id}`;
      } else {
        key = n.range ? JSON.stringify(n.range) : `quote:${(n.quote || '').trim()}:${n.url || ''}`;
      }
      if (!groups[key]) groups[key] = { quote: n.quote || '', range: n.range || null, url: n.url || '', items: [] };
      groups[key].items.push(n);
    });
    Object.values(groups).forEach(group => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const hasReference = group.quote || group.range;
      
      // 1. Note Quote (always show full content)
      if (group.quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'note-quote';
        quoteDiv.textContent = `"${group.quote}"`;
        quoteDiv.title = 'Click to locate';
        
        if (group.url && group.items.length > 0) {
            quoteDiv.onclick = () => locateNote({ id: group.items[0].id, url: group.url, range: group.range });
        }
        li.appendChild(quoteDiv);
      }

      // 2. Note Items List
      const listEl = document.createElement('ul');
      listEl.className = 'note-items';
      
      group.items.forEach(item => {
        if (!item.content || !item.content.trim()) return;
        
        const itemLi = document.createElement('li');
        itemLi.className = 'note-item';
        
        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'note-content';
        contentDiv.textContent = item.content;
        itemLi.appendChild(contentDiv);
        
        if (hasReference) {
          const metaDiv = document.createElement('div');
          metaDiv.className = 'note-meta';
          
          const dateSpan = document.createElement('span');
          dateSpan.className = 'note-date';
          dateSpan.textContent = new Date(item.createdAt).toLocaleString();
          metaDiv.appendChild(dateSpan);
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn-icon btn-delete';
          deleteBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
          deleteBtn.title = 'Delete Note';
          deleteBtn.onclick = () => deleteNote(item.id);
          metaDiv.appendChild(deleteBtn);
          
          itemLi.appendChild(metaDiv);
        }
        listEl.appendChild(itemLi);
      });
      li.appendChild(listEl);

      // 3. Footer (Create Time + Actions)
      const footerDiv = document.createElement('div');
      footerDiv.className = 'note-item-footer';
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'note-actions';
      
      // Create Time (Using the latest note's time for now, or the first one in the list)
      const createTimeSpan = document.createElement('span');
      createTimeSpan.className = 'group-create-time';
      if (group.items.length > 0) {
          createTimeSpan.textContent = new Date(group.items[0].createdAt).toLocaleString();
      }
      actionsDiv.appendChild(createTimeSpan);
      
      // Action Buttons Container
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'note-action-buttons';

      const locateBtn = document.createElement('button');
      locateBtn.className = 'btn-icon btn-locate';
      locateBtn.innerHTML = `<span class="iconfont icon-location" title="${group.url}"></span>`;
      locateBtn.title = 'Locate on Page';
      if (!group.url) {
        locateBtn.disabled = true;
        locateBtn.title = 'No web reference to locate';
      } else {
        locateBtn.onclick = () => locateNote({ id: group.items[0].id, url: group.url, range: group.range });
      }
      buttonsDiv.appendChild(locateBtn);

      if (hasReference) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-icon btn-add';
        addBtn.innerHTML = '<span class="iconfont icon-edit"></span>';
        addBtn.title = 'Add Annotation';
        addBtn.onclick = () => {
          pendingAddContext = { quote: group.quote, url: group.url, range: group.range };
          if (addNoteDialog && addNoteTextEl) {
            addNoteTextEl.value = '';
            addNoteDialog.classList.remove('hidden');
          }
        };
        buttonsDiv.appendChild(addBtn);
      }
      
      const deleteGroupBtn = document.createElement('button');
      deleteGroupBtn.className = 'btn-icon btn-delete';
      deleteGroupBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
      deleteGroupBtn.title = 'Delete Entire Footprint';
      deleteGroupBtn.onclick = async (e) => {
        e.stopPropagation();
        const annotationCount = group.items.filter(it => it.content && it.content.trim()).length;
        let q = (group.quote || '').replace(/\s+/g, ' ').trim();
        if (q && q.length > 16) q = q.slice(0, 16) + '...';
        let message;
        if (annotationCount === 0) {
          message = q ? `Delete this footprint ‘${q}’ ?` : 'Delete this footprint ?';
        } else {
          message = q ? `Delete this footprint ‘${q}’ and its ${annotationCount} annotation?` : `Delete this footprint and its ${annotationCount} annotation?`;
        }
        const ok = confirm(message);
        if (ok) {
          await deleteGroup(group.items);
        }
      };
      buttonsDiv.appendChild(deleteGroupBtn);
      
      actionsDiv.appendChild(buttonsDiv);
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
    const result = await chrome.storage.local.get(['notes']);
    let notes = result.notes || [];
    const target = notes.find(n => n.id === noteId);
    let preview = '';
    if (target) {
      const base = (target.content || target.quote || '').replace(/\s+/g, ' ').trim();
      preview = base ? (base.length > 16 ? base.slice(0, 16) + '...' : base) : '';
    }
    const ok = confirm(preview ? `Delete annotation ‘${preview}’ ?` : 'Delete this note?');
    if (!ok) return;
    notes = notes.filter(n => n.id !== noteId);
    await chrome.storage.local.set({ notes: notes });
  }

  function locateNote(note) {
    chrome.tabs.create({ url: note.url }, (tab) => {
      if (!note.range) return;
      
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
