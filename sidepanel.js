document.addEventListener('DOMContentLoaded', () => {
  const noteInput = document.getElementById('note-input');
  const saveBtn = document.getElementById('save-btn');
  const recentList = document.getElementById('recent-list');
  const emptyState = document.getElementById('empty-state');
  const homeBtn = document.getElementById('home-btn');
  const quoteSection = document.getElementById('quote-section');
  const quoteText = document.getElementById('quote-text');
  const sectionTitle = document.querySelector('.recent-section h3');
  const body = document.body;
  
  // Settings Elements
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDialog = document.getElementById('settings-dialog');
  const closeSettingsBtn = document.getElementById('close-settings');
  const darkModeToggle = document.querySelector('.quick-settings-section [data-setting="dark-mode"] input[type="checkbox"]');
  const toolbarToggle = document.querySelector('.quick-settings-section [data-setting="enable-toolbar"] input[type="checkbox"]');
  const clearQuoteBtn = document.getElementById('clear-quote');
  const cameraBtn = document.getElementById('camera-btn');

  const defaultStyles = {
    solid: '#fa7cef',
    line: '#ff0000',
    dash: '#ff0000',
    wavy: '#ff0000'
  };

  const defaultVisibility = {
    solid: true,
    line: false,
    dash: false,
    wavy: false
  };
  
  let currentStyleConfig = { ...defaultStyles };
  let currentVisibility = { ...defaultVisibility };
  let toolbarConfig = [];

  const AVAILABLE_TOOLS = [
    { type: 'solid', label: 'Highlight', icon: 'icon-solid' },
    { type: 'line', label: 'Underline', icon: 'icon-line' },
    { type: 'dash', label: 'Dashed', icon: 'icon-dash' },
    { type: 'wavy', label: 'Wavy', icon: 'icon-iocn_wavyLine' }
  ];
  let defaultStyleType = 'solid';
  let isDarkMode = false;
  let isToolbarEnabled = true;

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
      quoteText.classList.remove('has-image');
      if (currentDraft) {
        currentDraft.text = null;
        currentDraft.range = null;
      }
      noteInput.focus();
    });
  }

  // Settings Logic
  if (settingsBtn && settingsDialog) {
    settingsBtn.addEventListener('click', () => {
      settingsDialog.classList.remove('hidden');
    });
  }

  // Shortcut for Save
  noteInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveNote();
    }
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

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', async (e) => {
      isDarkMode = e.target.checked;
      applyDarkMode();
      try {
        await chrome.runtime.sendMessage({
          type: 'DB_SET_SETTING',
          payload: { key: 'sidepanelDarkMode', value: isDarkMode }
        });
      } catch (err) {
        console.error('Failed to save dark mode setting', err);
      }
    });
  }

  if (toolbarToggle) {
    toolbarToggle.addEventListener('change', async (e) => {
      isToolbarEnabled = e.target.checked;
      try {
        await chrome.runtime.sendMessage({
          type: 'DB_SET_SETTING',
          payload: { key: 'toolbarEnabled', value: isToolbarEnabled }
        });
        if (currentTabId) {
          chrome.tabs.sendMessage(currentTabId, {
            type: 'TOOLBAR_VISIBILITY_CHANGED',
            enabled: isToolbarEnabled
          });
        }
      } catch (err) {
        console.error('Failed to save toolbar enabled setting', err);
      }
    });
  }

  function applyDarkMode() {
    if (isDarkMode) {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
  }

  async function loadSettings() {
    // Load Toolbar Config
    const configResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolbarConfig' });
    
    // Load Legacy Settings (for migration or fallback)
    const styleResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'styleConfig' });
    const visibilityResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolVisibility' });
    const defaultStyleResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'defaultStyle' });
    const darkModeResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'sidepanelDarkMode' });
    const toolbarEnabledResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolbarEnabled' });

    currentStyleConfig = (styleResp && styleResp.data) || { ...defaultStyles };
    
    // Ensure all keys exist
    ['solid', 'line', 'dash', 'wavy'].forEach(key => {
      if (!currentStyleConfig[key]) currentStyleConfig[key] = defaultStyles[key];
    });

    currentVisibility = (visibilityResp && visibilityResp.data) || { ...defaultVisibility };
    // Ensure all keys exist
    ['solid', 'line', 'dash', 'wavy'].forEach(key => {
      if (currentVisibility[key] === undefined) currentVisibility[key] = defaultVisibility[key];
    });

    defaultStyleType = defaultStyleResp && defaultStyleResp.data ? defaultStyleResp.data : 'solid';
    if (toolbarEnabledResp && toolbarEnabledResp.data !== null && toolbarEnabledResp.data !== undefined) {
      isToolbarEnabled = !!toolbarEnabledResp.data;
    } else {
      isToolbarEnabled = true;
    }
    isDarkMode = !!(darkModeResp && darkModeResp.data);
    applyDarkMode();
    if (darkModeToggle) {
      darkModeToggle.checked = isDarkMode;
    }
    if (toolbarToggle) {
      toolbarToggle.checked = isToolbarEnabled;
    }

    if (configResp && configResp.data) {
      toolbarConfig = configResp.data;
      
      // Ensure Annotation is last (Fix for existing configs)
      const annotationIndex = toolbarConfig.findIndex(i => i.type === 'annotation');
      if (annotationIndex !== -1 && annotationIndex !== toolbarConfig.length - 1) {
          const annotationItem = toolbarConfig.splice(annotationIndex, 1)[0];
          toolbarConfig.push(annotationItem);
          saveToolbarConfig(); // Save the fix
      }
    } else {
      // Migration: Build initial toolbarConfig from legacy settings
      toolbarConfig = [];
      
      AVAILABLE_TOOLS.forEach(tool => {
        if (currentVisibility[tool.type] !== false) {
          toolbarConfig.push({
            id: crypto.randomUUID(),
            type: tool.type,
            color: currentStyleConfig[tool.type]
          });
        }
      });

      // Add Annotation at the end
      toolbarConfig.push({ id: 'annotation', type: 'annotation', fixed: true });
      
      // Save the migrated config
      saveToolbarConfig();
    }

    // Initial load doesn't render settings UI anymore, it's done on open
  }

  async function saveToolbarConfig() {
    await chrome.runtime.sendMessage({
      type: 'DB_SET_SETTING',
      payload: { key: 'toolbarConfig', value: toolbarConfig }
    });
    
    // Notify content script to update
    if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { type: 'CONFIG_UPDATED' });
    }
  }


  // Save button click handler
  saveBtn.addEventListener('click', saveNote);
  
  // Camera button click handler
  if (cameraBtn) {
    cameraBtn.addEventListener('click', onCameraClick);
  }

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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'IMAGE_PROCESSING_STARTED') {
      quoteSection.classList.remove('hidden');
      quoteText.innerHTML = '<div class="loading-spinner"></div><span>Processing image...</span>';
      quoteText.classList.remove('has-image');
      quoteText.classList.add('loading-state');
    }

    if (message.type === 'ADD_IMAGE_TO_FOOTPRINTS') {
      const { imageUrl, pageUrl, srcUrl } = message.payload;
      
      // Update UI
      quoteSection.classList.remove('hidden');
      quoteText.textContent = ''; 
      quoteText.classList.remove('loading-state'); // Remove loading state 
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'quote-image';
      quoteText.appendChild(img);
      quoteText.classList.add('has-image');
      
      currentDraft = {
        image: imageUrl,
        srcUrl: srcUrl,
        url: pageUrl,
        style: defaultStyleType 
      };
      
      noteInput.focus();
    }

    if (message.type === 'DATA_CHANGED') {
      const changes = message.changes || {};
      if (changes.tempDraft) {
        checkTempDraft();
      }
      if (changes.notes) {
        // Only refresh if we have a URL context
        if (currentTabUrl) {
          loadRecentNotes(); // Reload notes from DB
        }
      }
      if (changes.toolbarConfig || changes.defaultStyle) {
        loadSettings();
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
    const result = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'tempDraft' });
    const tempDraft = result && result.data;
    
    if (tempDraft && tempDraft.url === currentTabUrl) {
      currentDraft = tempDraft;
      
      quoteText.textContent = currentDraft.text || '';
      if (currentDraft.image) {
        const img = document.createElement('img');
        img.src = currentDraft.image;
        img.className = 'quote-image';
        quoteText.appendChild(img);
        quoteText.classList.add('has-image');
      } else {
        quoteText.classList.remove('has-image');
      }
      
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
    // Allow saving if there is text OR if we have a valid draft (text or image)
    if (!text && (!currentDraft || (!currentDraft.text && !currentDraft.image))) return;

    const notesResp = await chrome.runtime.sendMessage({ type: 'DB_GET_NOTES' });
    let notes = (notesResp && notesResp.data) || [];

    if (currentDraft && currentDraft.noteId) {
      // Update existing note
      const existingIndex = notes.findIndex(n => n.id === currentDraft.noteId);
      if (existingIndex !== -1) {
        const noteToUpdate = notes[existingIndex];
        noteToUpdate.content = text;
        noteToUpdate.updatedAt = new Date().toISOString();
        
        await chrome.runtime.sendMessage({
          type: 'DB_ADD_NOTE',
          payload: noteToUpdate
        });
      } else {
        // Fallback: create new if not found
        // Get annotation color and style from current settings
        const annotationConfig = toolbarConfig.find(item => item.type === 'annotation');
        const noteColor = annotationConfig ? annotationConfig.color : '#ff0000';
        const noteStyle = defaultStyleType || 'solid';

        const newNote = {
          id: currentDraft.noteId,
          content: text,
          createdAt: new Date().toISOString(),
          quote: currentDraft.text,
          url: currentDraft.url,
          range: currentDraft.range,
          style: noteStyle,
          color: noteColor
        };
        await chrome.runtime.sendMessage({
          type: 'DB_ADD_NOTE',
          payload: newNote
        });
      }
    } else {
      // Create new note
      const annotationConfig = toolbarConfig.find(item => item.type === 'annotation');
      const style = currentDraft && currentDraft.style ? currentDraft.style : (defaultStyleType || 'solid');
      const color = annotationConfig ? annotationConfig.color : '#ff0000';

      const newNote = {
        id: Date.now(),
        content: text,
        createdAt: new Date().toISOString(),
        quote: currentDraft ? currentDraft.text : null,
        image: currentDraft ? currentDraft.image : null,
        imageSrc: currentDraft ? currentDraft.srcUrl : null,
        url: currentDraft ? currentDraft.url : (currentTabUrl || 'unknown'),
        range: currentDraft ? currentDraft.range : null,
        style: style,
        color: color,
        screenshotRect: currentDraft && currentDraft.screenshotRect ? currentDraft.screenshotRect : null
      };
      await chrome.runtime.sendMessage({
        type: 'DB_ADD_NOTE',
        payload: newNote
      });
    }

    await chrome.runtime.sendMessage({
      type: 'DB_SET_SETTING',
      payload: { key: 'tempDraft', value: null }
    });

    noteInput.value = '';
    currentDraft = null;
    quoteSection.classList.add('hidden');
    quoteText.textContent = '';
    quoteText.classList.remove('has-image');
    
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, {
        type: 'REFRESH_HIGHLIGHTS'
      });
    }
  }

  async function onCameraClick() {
    if (!currentTabId) return;

    try {
      const rect = await chrome.tabs.sendMessage(currentTabId, {
        type: 'START_SCREENSHOT_SELECTION'
      });

      if (rect) {
        handleScreenshot(rect);
      }
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  }

  async function handleScreenshot(rect) {
    const dataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
    if (!dataUrl) {
      console.error("Failed to capture tab. Check permissions.");
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const dpr = rect.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 
        rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
        0, 0, rect.width * dpr, rect.height * dpr
      );
      
      const croppedUrl = canvas.toDataURL('image/png');
      
      // Update UI
      quoteSection.classList.remove('hidden');
      quoteText.textContent = ''; 
      const img = document.createElement('img');
      img.src = croppedUrl;
      img.className = 'quote-image';
      quoteText.appendChild(img);
      quoteText.classList.add('has-image');
      
      const screenshotRect = rect ? {
        top: rect.docTop != null ? rect.docTop : rect.top,
        left: rect.docLeft != null ? rect.docLeft : rect.left,
        width: rect.width,
        height: rect.height
      } : null;

      currentDraft = {
        image: croppedUrl,
        url: currentTabUrl,
        style: defaultStyleType,
        screenshotRect: screenshotRect
      };

      if (currentTabId && screenshotRect) {
        chrome.tabs.sendMessage(currentTabId, {
          type: 'SHOW_SCREENSHOT_OVERLAY',
          rect: screenshotRect
        });
      }
      
      noteInput.focus();
    };
    image.src = dataUrl;
  }

  async function loadRecentNotes() {
    if (!currentTabUrl) return;
    
    const result = await chrome.runtime.sendMessage({ type: 'DB_GET_NOTES' });
    const notes = (result && result.data) || [];
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
      if (!n.range && (!n.quote || n.quote.trim() === '') && !n.image) {
        key = `unique-note-${n.id}`;
      } else {
        if (n.image) {
          key = n.imageSrc ? `image-src:${n.imageSrc}` : `image-note-${n.id}`;
        } else {
          key = n.range ? JSON.stringify(n.range) : `quote:${(n.quote || '').trim()}`;
        }
      }
      
      if (!groups[key]) groups[key] = { quote: n.quote || '', image: n.image || null, range: n.range || null, items: [] };
      groups[key].items.push(n);
    });
    
    Object.values(groups).forEach(group => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      
      const hasReference = group.quote || group.range || group.image;

      // 1. Note Quote (Clickable) or Image
      if (group.image) {
        const img = document.createElement('img');
        img.src = group.image;
        img.className = 'quote-image';
        img.style.marginBottom = '8px';
        li.appendChild(img);
      } else if (group.quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'note-quote';
        quoteDiv.textContent = group.quote;
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
          deleteBtn.onclick = async () => {
             await chrome.runtime.sendMessage({
               type: 'DB_DELETE_NOTE',
               payload: item.id
             });
          };
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
          const payload = { 
            text: group.quote, 
            url: currentTabUrl, 
            range: group.range,
            image: group.image,
            srcUrl: group.items[0] ? group.items[0].imageSrc : null
          };
          await chrome.runtime.sendMessage({
            type: 'DB_SET_SETTING',
            payload: { key: 'tempDraft', value: payload }
          });
          checkTempDraft();
        };
        buttonsDiv.appendChild(addBtn);
      }

      // Delete Group Button
      const deleteGroupBtn = document.createElement('button');
      deleteGroupBtn.className = 'btn-icon btn-delete';
      deleteGroupBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
      deleteGroupBtn.title = 'Delete All';
      deleteGroupBtn.onclick = async () => {
        if (confirm('Delete all footprints for this quote?')) {
          for (const item of group.items) {
             await chrome.runtime.sendMessage({
               type: 'DB_DELETE_NOTE',
               payload: item.id
             });
          }
        }
      };
      actionsDiv.appendChild(deleteGroupBtn);
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
    for (const item of groupItems) {
      await chrome.runtime.sendMessage({
        type: 'DB_DELETE_NOTE',
        payload: item.id
      });
    }
  }

  async function deleteNote(noteId) {
    const result = await chrome.runtime.sendMessage({ type: 'DB_GET_NOTES' });
    let notes = (result && result.data) || [];
    const target = notes.find(n => n.id === noteId);
    let preview = '';
    if (target) {
      const base = (target.content || target.quote || '').replace(/\s+/g, ' ').trim();
      preview = base ? (base.length > 16 ? base.slice(0, 16) + '...' : base) : '';
    }
    const ok = confirm(preview ? `Delete annotation ‘${preview}’ ?` : 'Delete this note?');
    if (!ok) return;
    
    await chrome.runtime.sendMessage({
      type: 'DB_DELETE_NOTE',
      payload: noteId
    });
  }

  function locateNote(noteId) {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, {
      type: 'SCROLL_TO_NOTE',
      noteId: noteId
    });
  }
});
