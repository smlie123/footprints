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
  const menuExportPdfBtn = document.getElementById('menu-export-pdf');
  const pdfDialog = document.getElementById('pdf-dialog');
  const closePdfBtn = document.getElementById('close-pdf');
  const pdfStartDateEl = document.getElementById('pdf-start-date');
  const pdfEndDateEl = document.getElementById('pdf-end-date');
  const pdfWebsiteSelect = document.getElementById('pdf-website');
  const pdfPreviewBtn = document.getElementById('pdf-preview');
  const pdfHistoryLinkBtn = document.getElementById('pdf-history-link');
  const pdfHistoryDialog = document.getElementById('pdf-history-dialog');
  const closePdfHistoryBtn = document.getElementById('close-pdf-history');
  const pdfHistoryList = document.getElementById('pdf-history-list');

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
  const searchHeaderEl = document.getElementById('search-header');
  const searchTitleEl = document.getElementById('search-title');
  const searchCountEl = document.getElementById('search-count');
  const timelineHeaderEl = document.querySelector('.timeline-header');
  const masonryControlsEl = document.getElementById('masonry-controls');
  const masonryCategoryInfoEl = document.getElementById('masonry-category-info');
  const sortLabelEl = document.querySelector('.sort-label');
  const timelineContainerEl = document.querySelector('.timeline-container');
  const sortTimeBtn = document.getElementById('sort-time');
  const sortRandomBtn = document.getElementById('sort-random');

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
  let sortMode = 'time';
  let masonryPageSize = 16;
  let masonryGroups = [];
  let masonryRendered = 0;
  let masonryScrollHandler = null;

  setDefaultTodayRange();
  initCalendarControls();
  initDataTip();
  initViewToggles();
  initThoughtModal();
  initImagePreview();
  initSidebar();
  initMenuAndDialogs();
  loadAllNotes();

  // Global ESC to close dialogs
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dialog').forEach(d => {
        if (!d.classList.contains('hidden')) {
          d.classList.add('hidden');
        }
      });
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'DATA_CHANGED') {
      if (message.changes.notes) {
        loadAllNotes();
      }
    }
  });

  function initDataTip() {
    const tip = document.getElementById('data-tip');
    const close = document.getElementById('close-data-tip');
    if (!tip || !close) return;

    const closed = localStorage.getItem('dataTipClosed');
    if (closed === '1') {
      tip.classList.add('hidden');
    } else {
      tip.classList.remove('hidden');
    }

    close.addEventListener('click', () => {
      tip.classList.add('hidden');
      localStorage.setItem('dataTipClosed', '1');
    });
  }

  async function loadAllNotes() {
    const response = await chrome.runtime.sendMessage({ type: 'DB_GET_NOTES' });
    allNotes = (response && response.data) ? response.data : [];
    noteCountsByDay = buildNoteCountsByDay(allNotes);
    renderCalendar();
    if (currentView === 'masonry') renderCategories();
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

  sortTimeBtn?.addEventListener('click', () => {
    sortMode = 'time';
    sortTimeBtn.classList.add('active');
    sortRandomBtn?.classList.remove('active');
     sortLabelEl?.classList.add('active');
    renderList();
  });
  sortRandomBtn?.addEventListener('click', () => {
    sortMode = 'random';
    sortRandomBtn.classList.add('active');
    sortTimeBtn?.classList.remove('active');
     sortLabelEl?.classList.add('active');
    renderList();
  });

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
    chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'thoughtTheme' }).then(response => {
        if (response && response.data === 'dark') {
            toggleTheme(true);
        }
    });

    thoughtThemeToggle?.addEventListener('click', () => {
        const isDark = thoughtDialog.classList.contains('dark-mode');
        toggleTheme(!isDark);
        chrome.runtime.sendMessage({ 
            type: 'DB_SET_SETTING', 
            payload: { key: 'thoughtTheme', value: !isDark ? 'dark' : 'light' }
        });
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
        await chrome.runtime.sendMessage({
            type: 'DB_DELETE_NOTE',
            payload: commentId
        });

        // Update local state (Optimistic or wait for reload? 
        // Since we have loadAllNotes on message, we might get a refresh.
        // But for UI responsiveness in modal, we update local list.)
        allNotes = allNotes.filter(n => n.id !== commentId);
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

        const baseItem = (currentThoughtGroup.items && currentThoughtGroup.items[0]) || {};

        const newNote = {
          id: Date.now(),
          content: text,
          createdAt: new Date().toISOString(),
          quote: currentThoughtGroup.quote || thoughtTextEl.textContent.replace(/^"|"$/g, ''),
          url: currentThoughtGroup.url || '',
          range: currentThoughtGroup.range || null,
          style: baseItem.style,
          color: baseItem.color
        };
        
        await chrome.runtime.sendMessage({
            type: 'DB_ADD_NOTE',
            payload: newNote
        });
        
        allNotes.unshift(newNote);
        currentThoughtGroup.items.push(newNote);
        
        thoughtCommentInput.value = '';
        
        renderCommentsList();
        
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
            <span class="iconfont icon-thought_fill"></span>
            <span class="thought-info-label">Roaming</span>
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
        changeBtn.title = 'You can also press Space to change';
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

    const handleSpaceForChange = (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        if (!thoughtDialog.classList.contains('active')) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        renderRandomThought();
      }
    };

    const openModal = () => {
      renderRandomThought();
      thoughtDialog.classList.remove('hidden');
      // Force reflow
      void thoughtDialog.offsetWidth;
      thoughtDialog.classList.add('active');
      document.addEventListener('keydown', handleSpaceForChange, true);
    };

    const closeModal = () => {
      thoughtDialog.classList.remove('active');
      setTimeout(() => {
        thoughtDialog.classList.add('hidden');
      }, 300); // Match transition duration
      document.removeEventListener('keydown', handleSpaceForChange, true);
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

    document.body.classList.toggle('masonry-view', view === 'masonry');

    if (view === 'masonry') {
      sidebarCalendar?.classList.add('hidden');
      sidebarCategories?.classList.remove('hidden');
      renderCategories();
      masonryControlsEl?.classList.remove('hidden');
    } else {
      sidebarCalendar?.classList.remove('hidden');
      sidebarCategories?.classList.add('hidden');
      masonryControlsEl?.classList.add('hidden');
    }

    renderList();
  }

  function groupNotes(notes) {
    const groups = {};
    notes.forEach(n => {
      let key;
      if (!n.range && (!n.quote || n.quote.trim() === '') && !n.image) {
        key = `unique-note-${n.id}`;
      } else {
        if (n.image) {
          key = `image-note-${n.id}`;
        } else {
          key = n.range ? `${JSON.stringify(n.range)}:${n.url || ''}` : `quote:${(n.quote || '').trim()}:${n.url || ''}`;
        }
      }
      if (!groups[key]) {
        groups[key] = { quote: n.quote || '', range: n.range || null, url: n.url || '', image: n.image || null, items: [] };
      }
      groups[key].items.push(n);
    });
    return Object.values(groups);
  }

  function renderCategories() {
    if (!categoryListEl) return;
    
    const counts = new Map();
    counts.set('All', 0);

    const groups = groupNotes(allNotes);
    groups.forEach(group => {
      counts.set('All', counts.get('All') + 1);
      let domain = 'Unknown';
      try {
        if (group.url) {
          const urlObj = new URL(group.url);
          domain = urlObj.hostname;
        }
      } catch (e) {}
      if (!domain) domain = 'Unknown';
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

    if (masonryCategoryInfoEl) {
      const displayCat = selectedCategory === 'Unknown' ? '--' : selectedCategory;
      const count = counts.get(selectedCategory) || 0;
      masonryCategoryInfoEl.textContent = `${displayCat} (${count})`;
    }

    categoryListEl.innerHTML = '';
    sortedCats.forEach(cat => {
      const count = counts.get(cat);
      const li = document.createElement('li');
      li.className = 'nav-item';
      if (cat === selectedCategory) li.classList.add('active');
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = cat === 'Unknown' ? '--' : cat;
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

    const sidebarMenu = document.getElementById('sidebar-menu');
    const sidebarMenuBtn = document.getElementById('sidebar-menu-btn');
    sidebarMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebarMenu?.classList.toggle('is-open');
    });
    document.addEventListener('mousedown', (e) => {
      if (sidebarMenu?.classList.contains('is-open') && !sidebarMenu.contains(e.target)) {
        sidebarMenu.classList.remove('is-open');
      }
    });
  }

  function initMenuAndDialogs() {
    const sidebarMenu = document.getElementById('sidebar-menu');
    const exportHistoryList = document.getElementById('export-history-list');

    const formatBytes = (n) => {
      const k = 1024;
      if (n < k) return `${n} B`;
      const sizes = ['KB', 'MB', 'GB'];
      let i = -1;
      let v = n;
      do {
        v /= k;
        i++;
      } while (v >= k && i < sizes.length - 1);
      return `${v.toFixed(2)} ${sizes[i]}`;
    };

    const renderExportHistory = async () => {
      if (!exportHistoryList) return;
      exportHistoryList.innerHTML = '';
      const response = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'exportHistory' });
      const list = (response && response.data && Array.isArray(response.data)) ? response.data : [];
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'export-history-empty';
        empty.textContent = 'No export records yet.';
        exportHistoryList.appendChild(empty);
        return;
      }
      list.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'export-history-item';
        const main = document.createElement('div');
        main.className = 'export-history-main';
        const dt = document.createElement('span');
        const d = new Date(item.createdAt);
        dt.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
        const size = document.createElement('span');
        size.textContent = formatBytes(item.bytes || 0);
        main.appendChild(dt);
        main.appendChild(size);
        const sub = document.createElement('div');
        sub.className = 'export-history-sub';
        sub.textContent = `Notes: ${item.count || 0}`;
        row.appendChild(main);
        row.appendChild(sub);
        exportHistoryList.appendChild(row);
      });
    };

    menuExportBtn?.addEventListener('click', async () => {
      sidebarMenu?.classList.remove('is-open');
      if (!exportDialog) return;
      // History is now in a separate dialog
      exportDialog.classList.remove('hidden');
    });

    const openExportHistoryBtn = document.getElementById('open-export-history');
    const exportHistoryDialog = document.getElementById('export-history-dialog');
    const closeExportHistoryBtn = document.getElementById('close-export-history');

    openExportHistoryBtn?.addEventListener('click', async () => {
        await renderExportHistory();
        exportHistoryDialog?.classList.remove('hidden');
    });

    closeExportHistoryBtn?.addEventListener('click', () => exportHistoryDialog?.classList.add('hidden'));
    exportHistoryDialog?.addEventListener('click', (e) => {
        if (e.target === exportHistoryDialog) exportHistoryDialog.classList.add('hidden');
    });

    const menuSettingsBtn = document.getElementById('menu-settings');
    menuSettingsBtn?.addEventListener('click', () => {
      sidebarMenu?.classList.remove('is-open');
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });

    const menuHowToUseBtn = document.getElementById('menu-howtouse');
    menuHowToUseBtn?.addEventListener('click', () => {
      sidebarMenu?.classList.remove('is-open');
      chrome.tabs.create({ url: 'howtouse.html' });
    });

    closeExportBtn?.addEventListener('click', () => exportDialog?.classList.add('hidden'));
    exportDialog?.addEventListener('click', (e) => {
      if (e.target === exportDialog) exportDialog.classList.add('hidden');
    });

    const getHostname = (urlStr) => {
      try {
        const host = new URL(urlStr).hostname;
        return host || '--';
      } catch {
        return '--';
      }
    };
    const uniqueWebsites = () => {
      const set = new Set();
      allNotes.forEach(n => {
        const host = getHostname(n.url || '');
        if (host) set.add(host);
      });
      return Array.from(set).sort();
    };
    const renderPdfWebsites = () => {
      if (!pdfWebsiteSelect) return;
      const sites = uniqueWebsites();
      pdfWebsiteSelect.innerHTML = '<option value=\"\">All</option>' + sites.map(s => `<option value="${s}">${s}</option>`).join('');
    };
    const renderPdfHistory = async () => {
      if (!pdfHistoryList) return;
      pdfHistoryList.innerHTML = '';
      const response = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'pdfExportHistory' });
      const list = (response && response.data && Array.isArray(response.data)) ? response.data : [];
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'export-history-empty';
        empty.textContent = 'No export records yet.';
        pdfHistoryList.appendChild(empty);
        return;
      }
      list.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'export-history-item';
        const main = document.createElement('div');
        main.className = 'export-history-main';
        const dt = document.createElement('span');
        const d = new Date(item.createdAt);
        dt.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
        const size = document.createElement('span');
        size.textContent = `${item.count || 0} items`;
        main.appendChild(dt);
        main.appendChild(size);
        const sub = document.createElement('div');
        sub.className = 'export-history-sub';
        sub.textContent = `Time: ${item.start || '—'} ~ ${item.end || '—'}  •  Site: ${item.site || 'All'}`;
        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.style.cssText = 'background:none;border:1px solid #eee;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;margin-left:8px;';
        del.addEventListener('click', async () => {
          const sResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'pdfExportHistory' });
          const arr = (sResp && sResp.data && Array.isArray(sResp.data)) ? sResp.data : [];
          arr.splice(idx, 1);
          await chrome.runtime.sendMessage({ type: 'DB_SET_SETTING', payload: { key: 'pdfExportHistory', value: arr } });
          renderPdfHistory();
        });
        sub.appendChild(del);
        row.appendChild(main);
        row.appendChild(sub);
        pdfHistoryList.appendChild(row);
      });
    };
    const computePdfFilter = () => {
      const startStr = pdfStartDateEl?.value || '';
      const endStr = pdfEndDateEl?.value || '';
      const site = pdfWebsiteSelect?.value || '';
      const start = startStr ? new Date(startStr + 'T00:00:00') : null;
      const end = endStr ? new Date(endStr + 'T23:59:59') : null;
      let filtered = allNotes;
      if (start || end) {
        filtered = filtered.filter(n => {
          const t = new Date(n.createdAt).getTime();
          const okStart = start ? t >= start.getTime() : true;
          const okEnd = end ? t <= end.getTime() : true;
          return okStart && okEnd;
        });
      }
      if (site) {
        filtered = filtered.filter(n => getHostname(n.url) === site);
      }
      return { filtered, startStr, endStr, site };
    };

    menuExportPdfBtn?.addEventListener('click', async () => {
      sidebarMenu?.classList.remove('is-open');
      renderPdfWebsites();
      pdfDialog?.classList.remove('hidden');
    });
    closePdfBtn?.addEventListener('click', () => pdfDialog?.classList.add('hidden'));
    
    // Click to show picker
    const triggerPicker = (el) => {
      try {
        if (el && typeof el.showPicker === 'function') el.showPicker();
      } catch (e) {}
    };
    pdfStartDateEl?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerPicker(pdfStartDateEl);
    });
    pdfEndDateEl?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerPicker(pdfEndDateEl);
    });

    pdfDialog?.addEventListener('click', (e) => { if (e.target === pdfDialog) pdfDialog.classList.add('hidden'); });
    pdfHistoryLinkBtn?.addEventListener('click', async () => {
      await renderPdfHistory();
      pdfHistoryDialog?.classList.remove('hidden');
    });
    closePdfHistoryBtn?.addEventListener('click', () => pdfHistoryDialog?.classList.add('hidden'));
    pdfHistoryDialog?.addEventListener('click', (e) => {
      if (e.target === pdfHistoryDialog) pdfHistoryDialog.classList.add('hidden');
    });
    pdfPreviewBtn?.addEventListener('click', async () => {
      const data = computePdfFilter();
      // Save config for the preview page
      await chrome.runtime.sendMessage({ 
        type: 'DB_SET_SETTING',
        payload: {
            key: 'pdfExportConfig',
            value: {
                startStr: data.startStr,
                endStr: data.endStr,
                site: data.site
            }
        } 
      });
      // Open new tab
      const url = chrome.runtime.getURL('pdf-preview.html');
      chrome.tabs.create({ url });
    });
    // Removed old preview dialog logic
    // closePdfPreviewBtn?.addEventListener('click', ...);
    // pdfExportBtn?.addEventListener('click', ...);
    downloadExportBtn?.addEventListener('click', async () => {
      const response = await chrome.runtime.sendMessage({ type: 'DB_GET_ALL_DATA' });
      const data = (response && response.data) ? response.data : {};
      
      const notes = Array.isArray(data.notes) ? data.notes : [];
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const stamp = `${y}${m}${d}-${hh}${mm}${ss}`;
      a.href = url;
      a.download = `footprints-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      try {
        const bytes = new TextEncoder().encode(json).length;
        const histResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'exportHistory' });
        const list = (histResp && histResp.data && Array.isArray(histResp.data)) ? histResp.data : [];
        list.unshift({
          createdAt: now.toISOString(),
          count: notes.length,
          bytes
        });
        if (list.length > 10) list.length = 10;
        await chrome.runtime.sendMessage({ type: 'DB_SET_SETTING', payload: { key: 'exportHistory', value: list } });
        await renderExportHistory();
      } catch {}
    });

    menuImportBtn?.addEventListener('click', () => {
      sidebarMenu?.classList.remove('is-open');
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
      
      await chrome.runtime.sendMessage({ type: 'DB_CLEAR_ALL' });
      await chrome.runtime.sendMessage({ type: 'DB_IMPORT_DATA', payload: pendingImportData });
      
      importDialog?.classList.add('hidden');
      await loadAllNotes();
    });

    menuAboutBtn?.addEventListener('click', async () => {
      sidebarMenu?.classList.remove('is-open');
      const verEl = document.getElementById('about-version');
      const countEl = document.getElementById('about-count');
      const sizeEl = document.getElementById('about-size');
      try {
        const manifest = chrome.runtime.getManifest();
        if (verEl) verEl.textContent = `v${manifest.version || ''}`;
      } catch {}
      try {
        const response = await chrome.runtime.sendMessage({ type: 'DB_GET_ALL_DATA' });
        const data = (response && response.data) ? response.data : {};
        const notes = Array.isArray(data.notes) ? data.notes : [];
        if (countEl) countEl.textContent = String(notes.length);
        const text = JSON.stringify(data);
        const bytes = new TextEncoder().encode(text).length;
        const fmt = (n) => {
          const k = 1024;
          if (n < k) return `${n} B`;
          const sizes = ['KB','MB','GB'];
          let i = -1, v = n;
          do { v /= k; i++; } while (v >= k && i < sizes.length - 1);
          return `${v.toFixed(2)} ${sizes[i]}`;
        };
        if (sizeEl) sizeEl.textContent = fmt(bytes);
      } catch {
        if (countEl) countEl.textContent = '–';
        if (sizeEl) sizeEl.textContent = '–';
      }
      aboutDialog?.classList.remove('hidden');
    });
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
      const newNote = {
        id: Date.now(),
        content: text,
        createdAt: new Date().toISOString(),
        quote: pendingAddContext.quote || null,
        url: pendingAddContext.url || '',
        range: pendingAddContext.range || null,
        style: pendingAddContext.style,
        color: pendingAddContext.color
      };
      await chrome.runtime.sendMessage({
        type: 'DB_ADD_NOTE',
        payload: newNote
      });
      addNoteDialog?.classList.add('hidden');
      pendingAddContext = null;
      if (addNoteTextEl) addNoteTextEl.value = '';
    });

    // Helper to open Add Note Dialog with preview
    window.openAddNoteWithPreview = (context) => {
        pendingAddContext = context;
        if (addNoteDialog && addNoteTextEl) {
            const preview = document.getElementById('add-note-preview');
            const previewQuote = document.getElementById('add-note-preview-quote');
            const previewImg = document.getElementById('add-note-preview-img');
            
            // Determine what to show
            // The `context` comes from `group` in renderList. 
            // `group.quote` is text, `group.image` is image URL if available.
            
            const hasQuote = context.quote && context.quote.trim();
            const hasImage = context.image;
            
            if (hasImage) {
                preview.classList.remove('hidden');
                previewImg.src = context.image;
                previewImg.classList.remove('hidden');
                previewQuote.classList.add('hidden');
            } else if (hasQuote) {
                preview.classList.remove('hidden');
                previewQuote.textContent = context.quote;
                previewQuote.classList.remove('hidden');
                previewImg.classList.add('hidden');
            } else {
                preview.classList.add('hidden');
            }
            
            addNoteTextEl.value = '';
            addNoteDialog.classList.remove('hidden');
            addNoteTextEl.focus();
        }
    };
  }

  function initImagePreview() {
    const dialog = document.getElementById('image-preview-dialog');
    const closeBtn = document.getElementById('close-image-preview');
    const previewImg = document.getElementById('preview-image');
    
    if (!dialog || !closeBtn || !previewImg) return;

    // Use event delegation for dynamically added images
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('quote-image')) {
        previewImg.src = e.target.src;
        dialog.classList.remove('hidden');
      }
    });

    closeBtn.addEventListener('click', () => {
      dialog.classList.add('hidden');
    });
    
    // Clicking outside image (on the container) closes the dialog
    dialog.addEventListener('click', (e) => {
      if (e.target.classList.contains('image-preview-container')) {
        dialog.classList.add('hidden');
      }
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

    let sorted = [...filtered];
    if (currentView === 'masonry' && sortMode === 'random') {
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = tmp;
      }
    } else {
      sorted.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return tb - ta;
      });
    }

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
    
    if (searchHeaderEl && searchTitleEl && searchCountEl && timelineHeaderEl) {
      const searching = !!searchQuery;
      searchHeaderEl.classList.toggle('hidden', !searching);
      timelineHeaderEl.classList.toggle('hidden', searching);
      if (searching) {
        searchTitleEl.textContent = `Search: ${searchQuery}`;
        searchCountEl.textContent = `Found ${sorted.length} results`;
      } else if (currentView !== 'masonry') {
        updateHeader(rangeStart, rangeEnd);
      }
    }

    const groupsArr = groupNotes(sorted);
    if (currentView === 'masonry') {
      masonryGroups = groupsArr;
      masonryRendered = 0;
      timelineListEl.innerHTML = '';
      const appendChunk = () => {
        if (!masonryGroups.length) return;
        const end = Math.min(masonryRendered + masonryPageSize, masonryGroups.length);
        const frag = document.createDocumentFragment();
        for (let idx = masonryRendered; idx < end; idx++) {
          const group = masonryGroups[idx];
          const li = document.createElement('li');
          li.className = 'timeline-item';
          const hasReference = group.quote || group.range || group.image;
          
          // 1. Note Quote (always show full content) or Image
          if (group.image) {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'note-img';
            const img = document.createElement('img');
            img.src = group.image;
            img.className = 'quote-image';
            img.style.maxWidth = '100%';
            img.style.borderRadius = '4px';
            imgDiv.appendChild(img);
            li.appendChild(imgDiv);
          } else if (group.quote) {
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
              const context = { 
                quote: group.quote, 
                url: group.url, 
                range: group.range, 
                image: group.image,
                style: group.items[0] && group.items[0].style, 
                color: group.items[0] && group.items[0].color 
              };
              if (window.openAddNoteWithPreview) {
                window.openAddNoteWithPreview(context);
              } else {
                // Fallback if not initialized (should not happen)
                pendingAddContext = context;
                if (addNoteDialog && addNoteTextEl) {
                  addNoteTextEl.value = '';
                  addNoteDialog.classList.remove('hidden');
                }
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
          frag.appendChild(li);
        }
        timelineListEl.appendChild(frag);
        masonryRendered = end;
      };
      appendChunk();
      if (timelineContainerEl) {
        if (masonryScrollHandler) {
          timelineContainerEl.removeEventListener('scroll', masonryScrollHandler);
        }
        masonryScrollHandler = () => {
          if (currentView !== 'masonry') return;
          const nearBottom = timelineContainerEl.scrollTop + timelineContainerEl.clientHeight >= timelineContainerEl.scrollHeight - 80;
          if (nearBottom && masonryRendered < masonryGroups.length) {
            appendChunk();
          }
        };
        timelineContainerEl.addEventListener('scroll', masonryScrollHandler);
      }
      return;
    }
    groupsArr.forEach(group => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const hasReference = group.quote || group.range || group.image;
      
      // 1. Note Quote (always show full content) or Image
      if (group.image) {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'note-img';
        const img = document.createElement('img');
        img.src = group.image;
        img.className = 'quote-image';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '4px';
        imgDiv.appendChild(img);
        li.appendChild(imgDiv);
      } else if (group.quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'note-quote';
        quoteDiv.textContent = group.quote;
        
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
          const context = { 
            quote: group.quote, 
            url: group.url, 
            range: group.range, 
            image: group.image,
            style: group.items[0] && group.items[0].style, 
            color: group.items[0] && group.items[0].color 
          };
          if (window.openAddNoteWithPreview) {
            window.openAddNoteWithPreview(context);
          } else {
             pendingAddContext = context;
             if (addNoteDialog && addNoteTextEl) {
               addNoteTextEl.value = '';
               addNoteDialog.classList.remove('hidden');
             }
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

  async function deleteGroup(groupItems) {
    for (const item of groupItems) {
      await chrome.runtime.sendMessage({
        type: 'DB_DELETE_NOTE',
        payload: item.id
      });
    }
  }

  async function deleteNote(noteId) {
    const target = allNotes.find(n => n.id === noteId);
    let preview = '';
    if (target) {
      const base = (target.content || target.quote || '').replace(/\s+/g, ' ').trim();
      preview = base ? (base.length > 16 ? base.slice(0, 16) + '...' : base) : '';
    }
    const ok = confirm(preview ? `Delete annotation ‘${preview}’ ?` : 'Delete this note?');
    if (!ok) return;
    await chrome.runtime.sendMessage({ type: 'DB_DELETE_NOTE', payload: noteId });
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
