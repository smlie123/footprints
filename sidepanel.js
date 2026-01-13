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
  
  let currentStyleConfig = { ...defaultStyles };
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
    activeStyleType = null;
    document.querySelectorAll('.color-block').forEach(b => b.style.borderColor = '#ddd');
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

  // Color Block Click Handlers
  document.querySelectorAll('.color-block').forEach(block => {
    block.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent setting-item click if needed, or handle together
      const item = block.closest('.setting-item');
      selectSettingItem(item);
    });
  });

  // Setting Item Click Handler (for better UX)
  document.querySelectorAll('.setting-item').forEach(item => {
    item.addEventListener('click', () => {
      selectSettingItem(item);
    });
  });

  function selectSettingItem(item) {
    activeStyleType = item.dataset.style;
    
    // Highlight active item
    document.querySelectorAll('.setting-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');

    colorPickerPopup.classList.remove('hidden');
    
    // Initialize custom input with current color
    customColorInput.value = currentStyleConfig[activeStyleType];
    
    // Visual feedback for color block (optional if item is highlighted)
    document.querySelectorAll('.color-block').forEach(b => b.style.borderColor = '#ddd');
    const block = item.querySelector('.color-block');
    if (block) {
      block.style.borderColor = '#555';
      block.style.borderWidth = '2px';
    }
  }

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
    renderSettingsUI();
    if (customColorInput.value !== color) customColorInput.value = color;
    await chrome.storage.local.set({ styleConfig: currentStyleConfig });
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(['styleConfig']);
    currentStyleConfig = result.styleConfig || { ...defaultStyles };
    
    // Ensure all keys exist
    ['solid', 'line', 'dash', 'wavy'].forEach(key => {
      if (!currentStyleConfig[key]) currentStyleConfig[key] = defaultStyles[key];
    });

    renderSettingsUI();
  }

  function renderSettingsUI() {
    ['solid', 'line', 'dash', 'wavy'].forEach(styleType => {
      const colorBlock = document.getElementById(`color-block-${styleType}`);
      const icon = document.querySelector(`.setting-item[data-style="${styleType}"] .style-icon`);
      const color = currentStyleConfig[styleType];
      
      if (colorBlock) colorBlock.style.backgroundColor = color;
      if (icon) icon.style.color = color;
    });
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
      const newNote = {
        id: Date.now(),
        content: text,
        createdAt: new Date().toISOString(),
        quote: currentDraft ? currentDraft.text : null,
        url: currentDraft ? currentDraft.url : (currentTabUrl || 'unknown'),
        range: currentDraft ? currentDraft.range : null
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

    pageNotes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      
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

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon btn-delete';
      deleteBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
      deleteBtn.title = 'Delete Note';
      deleteBtn.onclick = () => deleteNote(note.id);

      const locateBtn = document.createElement('button');
      locateBtn.className = 'btn-icon btn-locate';
      locateBtn.innerHTML = '<span class="iconfont icon-location"></span>';
      locateBtn.title = 'Locate on Page';
      // Only show locate if it has a range/quote
      if (!note.range) {
        locateBtn.disabled = true;
        locateBtn.style.opacity = '0.3';
      } else {
        locateBtn.onclick = () => locateNote(note.id);
      }

      actionsDiv.appendChild(locateBtn);
      actionsDiv.appendChild(deleteBtn);
      footerDiv.appendChild(actionsDiv);

      li.appendChild(footerDiv);
      
      recentList.appendChild(li);
    });
  }

  async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    const result = await chrome.storage.local.get(['notes']);
    let notes = result.notes || [];
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
