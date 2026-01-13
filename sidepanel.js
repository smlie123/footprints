document.addEventListener('DOMContentLoaded', () => {
  const noteInput = document.getElementById('note-input');
  const saveBtn = document.getElementById('save-btn');
  const recentList = document.getElementById('recent-list');
  const emptyState = document.getElementById('empty-state');
  const homeBtn = document.getElementById('home-btn');
  const quoteSection = document.getElementById('quote-section');
  const quoteText = document.getElementById('quote-text');
  const sectionTitle = document.querySelector('.recent-section h3');
  
  // Settings Elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDialog = document.getElementById('settings-dialog');
  const closeSettingsBtn = document.getElementById('close-settings');
  const colorPickerPopup = document.getElementById('color-picker-popup');
  const customColorInput = document.getElementById('custom-color-input');
  const presetColors = document.querySelectorAll('.preset-color');
  const clearQuoteBtn = document.getElementById('clear-quote');

  const defaultStyles = {
    solid: '#F28B82', 
    line: '#FBBC04',  
    dash: '#A7FFEB',  
    wavy: '#D7AEFB'   
  };

  const defaultVisibility = {
    solid: true,
    line: false,
    dash: false,
    wavy: false
  };
  
  let currentStyleConfig = { ...defaultStyles };
  let currentVisibility = { ...defaultVisibility };
  let activeStyleType = null;

  let currentDraft = null;
  let currentTabId = null;
  let currentTabUrl = null;

  // Initialize
  init();

  // Clear quote to allow user to write their own thought
  if (clearQuoteBtn) {
    clearQuoteBtn.addEventListener('click', () => {
      quoteText.textContent = '';
      quoteSection.classList.add('hidden');
      if (currentDraft) {
        currentDraft.text = null;
        currentDraft.range = null;
      }
      noteInput.focus();
    });
  }

  // Settings Logic
  settingsBtn.addEventListener('click', () => {
    settingsDialog.classList.remove('hidden');
    colorPickerPopup.classList.add('hidden');
    loadSettings();
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsDialog.classList.add('hidden');
  });
  
  // Close dialog when clicking outside
  settingsDialog.addEventListener('click', (e) => {
    if (e.target === settingsDialog) {
      settingsDialog.classList.add('hidden');
    }
  });

  // Preset Colors
  presetColors.forEach(preset => {
    preset.addEventListener('click', () => {
      if (!activeStyleType) return;
      const color = preset.dataset.color;
      updateStyleColor(activeStyleType, color);
    });
  });

  // Custom Color Input
  customColorInput.addEventListener('input', (e) => {
    if (!activeStyleType) return;
    updateStyleColor(activeStyleType, e.target.value);
  });

  async function updateStyleColor(styleType, color) {
    currentStyleConfig[styleType] = color;
    
    // Update color circle in UI immediately
    const circle = document.querySelector(`.setting-row[data-style="${styleType}"] .color-circle`);
    if (circle) circle.style.backgroundColor = color;
    
    // Update custom input if needed
    if (customColorInput.value !== color) customColorInput.value = color;
    
    renderToolbarPreview();
    await chrome.storage.local.set({ styleConfig: currentStyleConfig });
  }

  async function updateVisibility(styleType, isVisible) {
    currentVisibility[styleType] = isVisible;
    
    // Update color circle state
    const row = document.querySelector(`.setting-row[data-style="${styleType}"]`);
    if (row) {
        const circle = row.querySelector('.color-circle');
        if (circle) {
            if (isVisible) circle.classList.remove('disabled');
            else circle.classList.add('disabled');
        }
    }
    
    renderToolbarPreview();
    await chrome.storage.local.set({ toolVisibility: currentVisibility });
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(['styleConfig', 'toolVisibility']);
    currentStyleConfig = result.styleConfig || { ...defaultStyles };
    
    // Ensure all keys exist
    ['solid', 'line', 'dash', 'wavy'].forEach(key => {
      if (!currentStyleConfig[key]) currentStyleConfig[key] = defaultStyles[key];
    });

    currentVisibility = result.toolVisibility || { ...defaultVisibility };
     // Ensure all keys exist
    ['solid', 'line', 'dash', 'wavy'].forEach(key => {
      if (currentVisibility[key] === undefined) currentVisibility[key] = defaultVisibility[key];
    });

    renderSettingsUI();
  }

  function renderSettingsUI() {
    const listContainer = document.getElementById('settings-list');
    listContainer.innerHTML = '';

    const tools = [
        { type: 'annotation', label: 'Annotation', icon: 'icon-edit', fixed: true },
        { type: 'solid', label: 'Highlight', icon: 'icon-solid' },
        { type: 'line', label: 'Underline', icon: 'icon-line' },
        { type: 'dash', label: 'Dashed', icon: 'icon-dash' },
        { type: 'wavy', label: 'Wavy', icon: 'icon-iocn_wavyLine' }
    ];

    tools.forEach(tool => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.dataset.style = tool.type;

        // Info: Icon + Label
        const info = document.createElement('div');
        info.className = 'setting-info';
        
        const icon = document.createElement('span');
        icon.className = `iconfont ${tool.icon} setting-icon`;
        info.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'setting-label';
        label.textContent = tool.label;
        info.appendChild(label);

        if (tool.fixed) {
            const badge = document.createElement('span');
            badge.className = 'tag-badge';
            badge.textContent = 'Required';
            info.appendChild(badge);
        }

        row.appendChild(info);

        // Controls: Toggle + Color
        const controls = document.createElement('div');
        controls.className = 'setting-controls';

        // Toggle Switch (or fixed text)
        if (tool.fixed) {
             const switchLabel = document.createElement('label');
             switchLabel.className = 'toggle-switch';
             const input = document.createElement('input');
             input.type = 'checkbox';
             input.checked = true;
             input.disabled = true;
             const slider = document.createElement('span');
             slider.className = 'slider';
             switchLabel.appendChild(input);
             switchLabel.appendChild(slider);
             controls.appendChild(switchLabel);
        } else {
             const switchLabel = document.createElement('label');
             switchLabel.className = 'toggle-switch';
             const input = document.createElement('input');
             input.type = 'checkbox';
             input.checked = currentVisibility[tool.type];
             input.addEventListener('change', (e) => {
                 updateVisibility(tool.type, e.target.checked);
             });
             const slider = document.createElement('span');
             slider.className = 'slider';
             switchLabel.appendChild(input);
             switchLabel.appendChild(slider);
             controls.appendChild(switchLabel);

             // Color Circle
             const colorCircle = document.createElement('div');
             colorCircle.className = 'color-circle';
             if (!currentVisibility[tool.type]) colorCircle.classList.add('disabled');
             colorCircle.style.backgroundColor = currentStyleConfig[tool.type];
             
             colorCircle.addEventListener('click', (e) => {
                 e.stopPropagation();
                 if (colorCircle.classList.contains('disabled')) return;
                 openColorPicker(tool.type, row);
             });
             
             controls.appendChild(colorCircle);
        }

        row.appendChild(controls);
        listContainer.appendChild(row);
    });
    renderToolbarPreview();
  }

  function renderToolbarPreview() {
    const container = document.getElementById('settings-toolbar-preview');
    if (!container) return;
    container.innerHTML = '';

    // Set CSS variables for colors
    container.style.setProperty('--na-color-solid', currentStyleConfig.solid);
    container.style.setProperty('--na-color-line', currentStyleConfig.line);
    container.style.setProperty('--na-color-dash', currentStyleConfig.dash);
    container.style.setProperty('--na-color-wavy', currentStyleConfig.wavy);

    const tools = [
       
        { type: 'solid', icon: 'icon-solid' },
        { type: 'line', icon: 'icon-line' },
        { type: 'dash', icon: 'icon-dash' },
        { type: 'wavy', icon: 'icon-iocn_wavyLine' },
        { type: 'annotation', icon: 'icon-edit', fixed: true }
    ];

    tools.forEach(tool => {
        if (tool.fixed || currentVisibility[tool.type]) {
            const btn = document.createElement('button');
            btn.className = `na-float-btn na-style-${tool.type}`;
            
            const icon = document.createElement('span');
            icon.className = `iconfont ${tool.icon}`;
            btn.appendChild(icon);
            
            container.appendChild(btn);
        }
    });
  }

  function openColorPicker(type, rowElement) {
      activeStyleType = type;
      colorPickerPopup.classList.remove('hidden');
      
      customColorInput.value = currentStyleConfig[type];
      
      // Visual feedback
      document.querySelectorAll('.setting-row').forEach(r => r.style.backgroundColor = '');
      rowElement.style.backgroundColor = '#f1f3f4';
  }

  // Save button click handler
  saveBtn.addEventListener('click', saveNote);

  // Allow saving with Ctrl+Enter
  noteInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      saveNote();
    }
  });

  // Home button navigation
  homeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'home.html' });
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.tempDraft) {
        checkTempDraft();
      }
      if (changes.notes) {
        // Only refresh if we have a URL context
        if (currentTabUrl) {
          renderList(changes.notes.newValue || []);
        }
      }
    }
  });

  // Listen for tab updates to refresh list
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab) {
        updateUIForTab(tab.id, tab.url);
      }
    } catch (e) {
      console.error('Failed to get tab info:', e);
    }
  });

  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tab) {
        updateUIForTab(tab.id, tab.url);
      }
    } catch (e) {
      console.error('Failed to get window tab:', e);
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Refresh when URL changes or page finishes loading
    if (tabId === currentTabId && (changeInfo.status === 'complete' || changeInfo.url)) {
       updateUIForTab(tab.id, tab.url);
    }
  });

  async function init() {
    await loadSettings();
    await updateCurrentTab();
    checkTempDraft();
  }

  async function updateCurrentTab() {
    // Use lastFocusedWindow to reliably get the user's current tab
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      updateUIForTab(tab.id, tab.url);
    }
  }

  function updateUIForTab(tabId, url) {
    // If URL changed, clear any active draft that doesn't belong to this URL
    if (currentDraft && currentDraft.url !== url) {
      currentDraft = null;
      quoteSection.classList.add('hidden');
      quoteText.textContent = '';
    }

    currentTabId = tabId;
    currentTabUrl = url;
    loadRecentNotes();
  }

  async function checkTempDraft() {
    const result = await chrome.storage.local.get(['tempDraft']);
    if (result.tempDraft && result.tempDraft.url === currentTabUrl) {
      currentDraft = result.tempDraft;
      
      quoteText.textContent = currentDraft.text;
      quoteSection.classList.remove('hidden');
      // Scroll to top to ensure input is visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
      noteInput.focus();
    } else {
      currentDraft = null;
      quoteSection.classList.add('hidden');
      quoteText.textContent = '';
    }
  }

  async function saveNote() {
    const text = noteInput.value.trim();
    // Allow saving if there is text OR if we are updating an existing note (even if clearing text, though that's weird)
    // But mainly we want to ensure we have context
    if (!text && !currentDraft) return;
    if (!text && (!currentDraft || !currentDraft.text)) return;

    const result = await chrome.storage.local.get(['notes']);
    let notes = result.notes || [];

    if (currentDraft && currentDraft.noteId) {
      // Update existing note
      const existingIndex = notes.findIndex(n => n.id === currentDraft.noteId);
      if (existingIndex !== -1) {
        notes[existingIndex].content = text;
        notes[existingIndex].updatedAt = new Date().toISOString();
      } else {
        // Fallback: create new if not found
        const newNote = {
          id: currentDraft.noteId,
          content: text,
          createdAt: new Date().toISOString(),
          quote: currentDraft.text,
          url: currentDraft.url,
          range: currentDraft.range
        };
        notes.unshift(newNote);
      }
    } else {
      // Create new note
      const style = currentDraft && currentDraft.style ? currentDraft.style : 'solid';
      const color = currentStyleConfig[style] || defaultStyles[style];

      const newNote = {
        id: Date.now(),
        content: text,
        createdAt: new Date().toISOString(),
        quote: currentDraft ? currentDraft.text : null,
        url: currentDraft ? currentDraft.url : (currentTabUrl || 'unknown'),
        range: currentDraft ? currentDraft.range : null,
        style: style,
        color: color
      };
      notes.unshift(newNote);
    }

    await chrome.storage.local.set({ notes: notes, tempDraft: null });

    noteInput.value = '';
    currentDraft = null;
    quoteSection.classList.add('hidden');
    quoteText.textContent = '';
    
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, {
        type: 'REFRESH_HIGHLIGHTS'
      });
    }
  }

  async function loadRecentNotes() {
    if (!currentTabUrl) return;
    
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || [];
    renderList(notes);
  }

  function renderList(allNotes) {
    recentList.innerHTML = '';
    
    // Filter notes by current URL
    const pageNotes = allNotes.filter(note => note.url === currentTabUrl);

    if (pageNotes.length === 0) {
      emptyState.textContent = "No notes yet for this page.";
      emptyState.classList.remove('hidden');
      if (sectionTitle) sectionTitle.textContent = "Footprints on This Page";
      return;
    } else {
      emptyState.classList.add('hidden');
      if (sectionTitle) sectionTitle.textContent = `Footprints on This Page (${pageNotes.length})`;
    }

    const groups = {};
    pageNotes.forEach(n => {
      let key;
      // If no range and no quote, it's a plain text note that should NOT be merged
      if (!n.range && (!n.quote || n.quote.trim() === '')) {
        key = `unique-note-${n.id}`;
      } else {
        key = n.range ? JSON.stringify(n.range) : `quote:${(n.quote || '').trim()}`;
      }
      
      if (!groups[key]) groups[key] = { quote: n.quote || '', range: n.range || null, items: [] };
      groups[key].items.push(n);
    });
    
    Object.values(groups).forEach(group => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      
      const hasReference = group.quote || group.range;

      // 1. Note Quote (Clickable)
      if (group.quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'note-quote';
        quoteDiv.textContent = `"${group.quote}"`;
        quoteDiv.title = 'Click to locate';
        // Use the first note's ID for location (or range if supported)
        const noteIdToLocate = group.items[0] ? group.items[0].id : null;
        quoteDiv.onclick = () => {
             if (noteIdToLocate) locateNote(noteIdToLocate);
        };
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
        
        // Meta (Time + Delete)
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
      // Assuming group.items is sorted (e.g. newest first), use the first one
      if (group.items.length > 0) {
          createTimeSpan.textContent = new Date(group.items[0].createdAt).toLocaleString();
      }
      actionsDiv.appendChild(createTimeSpan);
      
      // Action Buttons Container
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'note-action-buttons';
      
      // Locate Button
      const locateBtn = document.createElement('button');
      locateBtn.className = 'btn-icon btn-locate';
      locateBtn.innerHTML = '<span class="iconfont icon-location"></span>';
      locateBtn.title = 'Locate Quote';
      
      if (!hasReference) {
        locateBtn.disabled = true;
        locateBtn.title = 'No web reference to locate';
      } else {
        locateBtn.onclick = () => {
           const noteIdToLocate = group.items[0] ? group.items[0].id : null;
           if (noteIdToLocate) locateNote(noteIdToLocate);
        };
      }
      buttonsDiv.appendChild(locateBtn);

      // Add Annotation Button
      if (hasReference) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-icon btn-add';
        addBtn.innerHTML = '<span class="iconfont icon-edit"></span>';
        addBtn.title = 'Add Footprint';
        addBtn.onclick = async () => {
          const payload = { text: group.quote, url: currentTabUrl, range: group.range };
          await chrome.storage.local.set({ tempDraft: payload });
          checkTempDraft();
        };
        buttonsDiv.appendChild(addBtn);
      }

      // Delete Group Button
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
      
      recentList.appendChild(li);
    });
  }

  async function deleteGroup(groupItems) {
    // Confirmation handled by UI tooltip
    
    const result = await chrome.storage.local.get(['notes']);
    let notes = result.notes || [];
    
    const idsToDelete = new Set(groupItems.map(item => item.id));
    notes = notes.filter(n => !idsToDelete.has(n.id));
    
    await chrome.storage.local.set({ notes: notes });
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

  function locateNote(noteId) {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, {
      type: 'SCROLL_TO_NOTE',
      noteId: noteId
    });
  }
});
