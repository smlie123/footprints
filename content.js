// content.js

let floatingBtn = null;
let currentSelectionRange = null;

// --- Initialization ---

// Inject Iconfont CSS dynamically to ensure correct paths
const iconfontUrl = chrome.runtime.getURL('iconfont/iconfont.woff2');
const style = document.createElement('style');
style.textContent = `
@font-face {
  font-family: "iconfont";
  src: url('${iconfontUrl}') format('woff2');
}
.iconfont {
  font-family: "iconfont" !important;
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.icon-close-circle:before { content: "\\e77d"; }
.icon-message:before { content: "\\e78a"; }
.icon-setting:before { content: "\\e78e"; }
.icon-location:before { content: "\\e790"; }
.icon-delete:before { content: "\\e7c3"; }
.icon-home:before { content: "\\e7c6"; }
.icon-edit:before { content: "\\e7e1"; }
.icon-footprints:before { content: "\\ebd9"; }
.icon-solid:before { content: "\\e8b3"; }
.icon-line:before { content: "\\e73a"; }
.icon-dash:before { content: "\\e7fc"; }
.icon-iocn_wavyLine:before { content: "\\e611"; }
`;
document.head.appendChild(style);

let currentStyleConfig = {
  solid: '#fa7cef',
  line: '#ff0000',
  dash: '#ff0000',
  wavy: '#ff0000'
};
let currentToolbarConfig = null;
const TOOL_ICONS = {
    solid: 'icon-solid',
    line: 'icon-line',
    dash: 'icon-dash',
    wavy: 'icon-iocn_wavyLine',
    annotation: 'icon-edit'
};
let currentToolVisibility = {
  solid: true,
  line: false,
  dash: false,
  wavy: false,
  annotation: true
};
let cachedNotes = [];
let toolbarEnabled = true;

function scheduleInitialHighlights() {
  loadHighlights();
  setTimeout(loadHighlights, 1000);
  setTimeout(loadHighlights, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    scheduleInitialHighlights();
    loadToolbarEnabled();
  });
} else {
  scheduleInitialHighlights();
  loadToolbarEnabled();
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCROLL_TO_NOTE') {
    const noteId = message.noteId;
    scrollToNote(noteId);
  }
  if (message.type === 'CONFIG_UPDATED') {
    // Refresh configuration
    chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolbarConfig' }).then(toolbarConfigResp => {
        if (toolbarConfigResp && toolbarConfigResp.data) {
            currentToolbarConfig = toolbarConfigResp.data;
        }
    });
  }
  if (message.type === 'TOOLBAR_VISIBILITY_CHANGED') {
    if (typeof message.enabled === 'boolean') {
      toolbarEnabled = message.enabled;
      if (!toolbarEnabled) {
        removeFloatingButton();
      }
    }
  }
  if (message.type === 'TOOLBAR_VISIBILITY_CHANGED') {
    if (typeof message.enabled === 'boolean') {
      toolbarEnabled = message.enabled;
      if (!toolbarEnabled) {
        removeFloatingButton();
      }
    }
  }
  if (message.type === 'REFRESH_HIGHLIGHTS') {
    loadHighlights();
  }
  if (message.type === 'DATA_CHANGED') {
    const changes = message.changes || {};
    if (changes.notes || changes.styleConfig || changes.toolVisibility) {
      loadHighlights();
    }
  }
  if (message.type === 'START_SCREENSHOT_SELECTION') {
    initScreenshotSelection(sendResponse);
    return true;
  }
  if (message.type === 'SHOW_SCREENSHOT_OVERLAY' && message.rect) {
    showScreenshotOverlay(message.rect);
  }
});

async function loadToolbarEnabled() {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'DB_GET_SETTING',
      payload: 'toolbarEnabled'
    });
    if (resp && resp.data !== null && resp.data !== undefined) {
      toolbarEnabled = !!resp.data;
    } else {
      toolbarEnabled = true;
    }
  } catch (e) {
    toolbarEnabled = true;
  }
}

document.addEventListener('mouseup', handleSelection);
document.addEventListener('keyup', handleSelection);
document.addEventListener('mousedown', (e) => {
  if (floatingBtn && !floatingBtn.contains(e.target)) {
    removeFloatingButton();
  }
});


// --- Selection & Button Logic ---

function handleSelection(event) {
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!toolbarEnabled) {
      removeFloatingButton();
      return;
    }

    if (!selectedText) {
      removeFloatingButton();
      return;
    }

    if (selection.anchorNode.parentElement.closest('.note-anywhere-ui')) {
      return;
    }

    if (floatingBtn) removeFloatingButton();

    currentSelectionRange = selection.getRangeAt(0).cloneRange();

    createFloatingButton(currentSelectionRange);
  }, 10);
}

function createFloatingButton(range) {
  floatingBtn = document.createElement('div');
  floatingBtn.id = 'note-anywhere-btn-container';
  floatingBtn.className = 'note-anywhere-ui';
  
  if (currentToolbarConfig) {
      currentToolbarConfig.forEach(item => {
          if (item.type === 'annotation') {
              const editBtn = document.createElement('button');
              editBtn.className = 'na-float-btn na-btn-add';
              editBtn.addEventListener('mousedown', onAddNoteClick);
              const editIcon = document.createElement('span');
              editIcon.className = 'iconfont icon-edit';
              editBtn.appendChild(editIcon);
              floatingBtn.appendChild(editBtn);
          } else {
              const btn = document.createElement('button');
              btn.className = `na-float-btn na-style-${item.type}`;
              // Apply specific color to button icon if needed, or style it. 
              // Existing CSS uses color property for icon color.
              if (item.color) btn.style.color = item.color;
              
              btn.addEventListener('mousedown', (e) => onStyleClick(e, item.type, item.color));
              
              const icon = document.createElement('span');
              const iconClass = TOOL_ICONS[item.type] || 'icon-solid';
              icon.className = `iconfont ${iconClass}`;
              btn.appendChild(icon);
              floatingBtn.appendChild(btn);
          }
      });
  } else {
      // Legacy Logic
      const styles = [
        { type: 'solid', icon: 'icon-solid' },
        { type: 'line', icon: 'icon-line' },
        { type: 'dash', icon: 'icon-dash' },
        { type: 'wavy', icon: 'icon-iocn_wavyLine' }
      ];

      styles.forEach(style => {
        if (currentToolVisibility[style.type] === false) return;

        const btn = document.createElement('button');
        btn.className = `na-float-btn na-style-${style.type}`;
        
        // Legacy: use currentStyleConfig inside onStyleClick
        btn.addEventListener('mousedown', (e) => onStyleClick(e, style.type));
        
        const icon = document.createElement('span');
        icon.className = `iconfont ${style.icon}`;
        btn.appendChild(icon);
        floatingBtn.appendChild(btn);
      });

      // Edit Button
      if (currentToolVisibility['annotation'] !== false) {
        const editBtn = document.createElement('button');
        editBtn.className = 'na-float-btn na-btn-add';
        editBtn.addEventListener('mousedown', onAddNoteClick);
        const editIcon = document.createElement('span');
        editIcon.className = 'iconfont icon-edit';
        editBtn.appendChild(editIcon);
        floatingBtn.appendChild(editBtn);
      }
  }
  
  document.body.appendChild(floatingBtn);

  const rects = range.getClientRects();
  const targetRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();

  const btnRect = floatingBtn.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate position relative to viewport first
  let left = targetRect.right;
  let top = targetRect.bottom + 10;

  // Horizontal Check
  if (left + btnRect.width > viewportWidth) {
    left = viewportWidth - btnRect.width - 10;
  }
  if (left < 0) {
    left = 10;
  }

  // Vertical Check
  if (top + btnRect.height > viewportHeight) {
    top = targetRect.top - btnRect.height - 10;
  }

  // Apply scroll offset for absolute positioning
  floatingBtn.style.top = `${window.scrollY + top}px`;
  floatingBtn.style.left = `${window.scrollX + left}px`;
}

function removeFloatingButton() {
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }
}

function initScreenshotSelection(sendResponse) {
  // Create overlay
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(0,0,0,0.1)'
  });
  
  // Selection Box
  const selectionBox = document.createElement('div');
  Object.assign(selectionBox.style, {
    border: '2px solid #1a73e8',
    background: 'rgba(26, 115, 232, 0.2)',
    position: 'fixed',
    display: 'none'
  });
  overlay.appendChild(selectionBox);

  document.body.appendChild(overlay);

  let startX, startY;
  let isDragging = false;

  const onMouseDown = (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
  };

  const onMouseUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    const rect = selectionBox.getBoundingClientRect();
    
    // Cleanup
    document.body.removeChild(overlay);
    
    if (rect.width > 10 && rect.height > 10) {
       sendResponse({
         left: rect.left,
         top: rect.top,
         width: rect.width,
         height: rect.height,
         devicePixelRatio: window.devicePixelRatio,
         docLeft: rect.left + window.scrollX,
         docTop: rect.top + window.scrollY
       });
    } else {
       sendResponse(null); 
    }
  };
  
  // Esc to cancel
  const onKeyDown = (e) => {
      if (e.key === 'Escape') {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            sendResponse(null);
          }
      }
  };

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown, {once: true});
}

async function onStyleClick(e, styleType, color) {
  e.preventDefault();
  e.stopPropagation();

  const selection = window.getSelection();
  const text = selection.toString().trim();
  const serialized = serializeRange(currentSelectionRange);
  
  const newNote = {
      id: Date.now(),
      content: '', 
      createdAt: new Date().toISOString(),
      quote: text,
      url: window.location.href,
      range: serialized,
      style: styleType,
      color: color || currentStyleConfig[styleType]
  };

  await chrome.runtime.sendMessage({
    type: 'DB_ADD_NOTE',
    payload: newNote
  });

  selection.removeAllRanges();
  removeFloatingButton();
}

function onAddNoteClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const selection = window.getSelection();
  const text = selection.toString().trim();
  const serialized = serializeRange(currentSelectionRange);

  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    payload: {
      text: text,
      url: window.location.href,
      range: serialized
    }
  });

  selection.removeAllRanges();
  removeFloatingButton();
}


// --- Highlight Rendering Logic ---

async function loadHighlights() {
  try {
    const notesResp = await chrome.runtime.sendMessage({ type: 'DB_GET_NOTES' });
    const notes = (notesResp && notesResp.data) || [];
    cachedNotes = notes;

    const toolbarConfigResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolbarConfig' });
    if (toolbarConfigResp && toolbarConfigResp.data) {
        currentToolbarConfig = toolbarConfigResp.data;
    } else {
        // Fallback: Load legacy for constructing a temporary config or just use legacy vars
        const styleConfigResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'styleConfig' });
        const styleConfig = (styleConfigResp && styleConfigResp.data) || currentStyleConfig;
        
        const toolVisibilityResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolVisibility' });
        if (toolVisibilityResp && toolVisibilityResp.data) {
          currentToolVisibility = toolVisibilityResp.data;
        }
        
        // Update global config and CSS variables (Legacy support)
        currentStyleConfig = styleConfig;
        Object.keys(currentStyleConfig).forEach(style => {
          document.documentElement.style.setProperty(`--na-color-${style}`, currentStyleConfig[style]);
        });
    }

    const currentUrl = window.location.href;
    const pageNotes = notes.filter(n => n.url === currentUrl && (n.range || n.imageSrc));

    // Group notes by range or imageSrc
    const groupedNotes = {};
    pageNotes.forEach(note => {
      let key;
      if (note.range) {
        key = JSON.stringify(note.range);
      } else {
        key = `image:${note.imageSrc}`;
      }
      if (!groupedNotes[key]) {
        groupedNotes[key] = [];
      }
      groupedNotes[key].push(note);
    });

    // Prepare normalized groups with sorted ID sets
    const groups = Object.values(groupedNotes).map(group => {
      const ids = group.map(n => n.id);
      const norm = normalizeIds(ids);
      const contentCount = countNotesWithContent(group);
      return { ids, idsNorm: norm, group, range: group[0].range, imageSrc: group[0].imageSrc, contentCount };
    });

    // Merge/update existing highlights to avoid removal on ID changes
    mergeExistingHighlights(groups);

    // Build valid ID sets for cleanup (normalized)
    const validIdJsons = new Set(groups.map(g => g.idsNorm));

    // Remove stale highlights/containers not present in current data
    cleanupStaleHighlights(validIdJsons);

    // Add missing highlights
    groups.forEach(({ group, idsNorm, range, imageSrc }) => {
      try {
        const exists = document.querySelector(`mark.na-highlight[data-note-ids='${idsNorm}']`);
        if (exists) {
          // Update style if changed (for existing highlights)
          const noteStyle = group[0].style || 'solid';
          const styleClass = `na-style-${noteStyle}`;
          exists.classList.forEach(cls => {
            if (cls.startsWith('na-style-') && cls !== styleClass) {
              exists.classList.remove(cls);
            }
          });
          if (!exists.classList.contains(styleClass)) {
            exists.classList.add(styleClass);
          }
          return;
        }

        if (range) {
          let deserialized = deserializeRange(range);
          // Fallback: if DOM has changed and we cannot restore by path,
          // try to locate by quote text
          if (!deserialized && group[0] && group[0].quote) {
            deserialized = findRangeByQuote(group[0].quote);
          }
          if (deserialized) {
            const noteStyle = group[0].style || 'solid';
            highlightRange(deserialized, group, `na-style-${noteStyle}`);
          }
        } else if (imageSrc) {
          const noteStyle = group[0].style || 'solid';
          highlightImage(imageSrc, group, `na-style-${noteStyle}`);
        }
      } catch (e) {
        console.warn('Footprints: Failed to restore highlight', e);
      }
    });
  } catch (e) {
    console.error('Failed to load highlights', e);
  }
}

function clearHighlights() {
  const marks = document.querySelectorAll('mark.na-highlight');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });

  const containers = document.querySelectorAll('.na-icon-container');
  containers.forEach(container => container.remove());
}

function cleanupStaleHighlights(validIdJsons) {
  // Remove only those marks/containers whose ID set is not a subset of any valid group
  const validSets = Array.from(validIdJsons).map(s => parseIds(s));

  document.querySelectorAll('mark.na-highlight').forEach(mark => {
    const existingIds = parseIds(mark.dataset.noteIds);
    const isSubset = validSets.some(v => isSubsetIds(existingIds, v));
    if (!isSubset) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }
  });

  document.querySelectorAll('.na-icon-container').forEach(container => {
    const existingIds = parseIds(container.dataset.noteIds);
    const isSubset = validSets.some(v => isSubsetIds(existingIds, v));
    if (!isSubset) {
      container.remove();
    }
  });
}

function highlightRange(range, notes, styleClass = 'na-style-solid') {
  const root = range.commonAncestorContainer && range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer;
  if (!root) return;
  const nodeIterator = document.createNodeIterator(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToWrap = [];
  let currentNode;
  while (currentNode = nodeIterator.nextNode()) {
    nodesToWrap.push(currentNode);
  }

  let lastMark = null;
  const createdMarks = [];
  // Use the ID of the most recent note (or first) for data attribute
  const primaryNoteId = notes[0].id; 
  const noteColor = notes[0].color;
  const noteStyle = notes[0].style || 'solid';

  nodesToWrap.forEach(node => {
    const mark = document.createElement('mark');
    mark.className = `na-highlight ${styleClass}`;
    mark.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
    
    if (noteColor) {
      if (noteStyle === 'solid') {
        mark.style.backgroundColor = noteColor;
      } else if (noteStyle === 'line' || noteStyle === 'dash') {
        mark.style.borderBottomColor = noteColor;
      } else if (noteStyle === 'wavy') {
        mark.style.textDecorationColor = noteColor;
      }
    }
    
    let start = 0;
    let end = node.nodeValue.length;

    if (node === range.startContainer) {
      start = range.startOffset;
    }
    if (node === range.endContainer) {
      end = range.endOffset;
    }

    const rangeText = node.nodeValue.substring(start, end);
    const beforeText = node.nodeValue.substring(0, start);
    const afterText = node.nodeValue.substring(end);

    const parent = node.parentNode;
    
    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), node);
    }
    
    mark.textContent = rangeText;
    parent.insertBefore(mark, node);
    lastMark = mark; 
    createdMarks.push(mark);
    
    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), node);
    }
    
    parent.removeChild(node);
  });

  // Attach icon container to the top-right of the overall highlight rectangle
  if (lastMark && createdMarks.length) {
    const contentCount = countNotesWithContent(notes);
    const iconContainer = document.createElement('span');
    iconContainer.className = `na-icon-container note-anywhere-ui`;
    iconContainer.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
    
    const icon = document.createElement('span');
    icon.className = `iconfont icon-footprints na-icon ${styleClass}`;
    if (noteColor) {
      icon.style.color = noteColor;
    }
    icon.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
    
    icon.style.fontSize = '20px';
    
    iconContainer.appendChild(icon);

    if (contentCount > 0) {
      const countSpan = document.createElement('span');
      countSpan.className = 'na-icon-count';
      countSpan.textContent = ` ${contentCount}`;
      iconContainer.appendChild(countSpan);
    }
    
    iconContainer.addEventListener('mouseenter', (e) => showTooltip(e));
    iconContainer.addEventListener('mouseleave', (e) => hideTooltip(e));
    
    iconContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      openSidePanelForNote(notes[0]); 
    });

    let minTop = Infinity;
    let maxRight = -Infinity;
    createdMarks.forEach(m => {
      const rect = m.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;
      if (rect.top < minTop) minTop = rect.top;
      if (rect.right > maxRight) maxRight = rect.right;
    });

    if (!isFinite(minTop) || !isFinite(maxRight)) return;

    const offsetTop = minTop + window.scrollY - 10;
    const offsetLeft = maxRight + window.scrollX - 10;
    iconContainer.style.top = `${offsetTop}px`;
    iconContainer.style.left = `${offsetLeft}px`;

    document.body.appendChild(iconContainer);
  }
}

function highlightImage(imageSrc, notes, styleClass = 'na-style-solid') {
  const allImages = Array.from(document.querySelectorAll('img'));
  const targetImg = allImages.find(img => img.src === imageSrc);
  
  if (!targetImg) return;
  
  if (targetImg.parentElement.tagName === 'MARK' && targetImg.parentElement.classList.contains('na-highlight')) {
    return;
  }
  
  const mark = document.createElement('mark');
  mark.className = `na-highlight ${styleClass}`;
  mark.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
  
  const noteColor = notes[0].color;
  const noteStyle = notes[0].style || 'solid';
  
  if (noteColor) {
      if (noteStyle === 'solid') {
        mark.style.backgroundColor = 'transparent'; 
        mark.style.outline = `3px solid ${noteColor}`;
        mark.style.outlineOffset = '-3px';
      } else if (noteStyle === 'line' || noteStyle === 'dash') {
        mark.style.backgroundColor = 'transparent';
        mark.style.borderBottom = `3px ${noteStyle === 'line' ? 'solid' : 'dashed'} ${noteColor}`;
      } else if (noteStyle === 'wavy') {
        mark.style.backgroundColor = 'transparent';
        mark.style.borderBottom = `3px solid ${noteColor}`; 
      }
  }

  targetImg.parentNode.insertBefore(mark, targetImg);
  mark.appendChild(targetImg);
  
  const contentCount = countNotesWithContent(notes);
  const iconContainer = document.createElement('span');
  iconContainer.className = `na-icon-container note-anywhere-ui`;
  iconContainer.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
  
  const icon = document.createElement('span');
  icon.className = `iconfont icon-footprints na-icon ${styleClass}`;
  if (noteColor) {
    icon.style.color = noteColor;
  }
  icon.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
  
  icon.style.fontSize = '20px'; 
  
  iconContainer.appendChild(icon);

  if (contentCount > 0) {
    const countSpan = document.createElement('span');
    countSpan.className = 'na-icon-count';
    countSpan.textContent = ` ${contentCount}`;
    countSpan.style.fontSize = '12px';
    iconContainer.appendChild(countSpan);
  }
  
  iconContainer.addEventListener('mouseenter', (e) => showTooltip(e));
  iconContainer.addEventListener('mouseleave', (e) => hideTooltip(e));
  
  iconContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    openSidePanelForNote(notes[0]); 
  });

  const rect = mark.getBoundingClientRect();
  const offsetTop = rect.top + window.scrollY - 10;
  const offsetLeft = rect.right + window.scrollX - 10;
  iconContainer.style.top = `${offsetTop}px`;
  iconContainer.style.left = `${offsetLeft}px`;

  document.body.appendChild(iconContainer);
}

// Normalize and merge helpers
function parseIds(json) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

function normalizeIds(ids) {
  const copy = [...ids];
  // Numeric-safe sort
  copy.sort((a, b) => {
    const an = Number(a), bn = Number(b);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    return String(a).localeCompare(String(b));
  });
  return JSON.stringify(copy);
}

function countNotesWithContent(notes) {
  return notes.filter(n => typeof n.content === 'string' && n.content.trim().length > 0).length;
}

function showScreenshotOverlay(rect) {
  if (!rect) return;
  const overlay = document.createElement('div');
  overlay.className = 'na-screenshot-overlay note-anywhere-ui';
  overlay.style.position = 'absolute';
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
  overlay.style.pointerEvents = 'none';
  document.body.appendChild(overlay);
  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 1500);
}

function isSubsetIds(a, b) {
  return a.every(id => b.includes(id));
}

function mergeExistingHighlights(groups) {
  groups.forEach(({ ids, idsNorm, contentCount }) => {
    // Find any existing marks whose ID set is a subset of the current group
    const marks = Array.from(document.querySelectorAll('mark.na-highlight'));
    const targetMark = marks.find(m => {
      const existing = parseIds(m.dataset.noteIds);
      return existing.length && isSubsetIds(existing, ids);
    });
    if (!targetMark) return;

    const oldJson = targetMark.dataset.noteIds;

    // Update all marks in this group to new normalized ID set
    document.querySelectorAll(`mark.na-highlight[data-note-ids='${oldJson}']`).forEach(m => {
      m.dataset.noteIds = idsNorm;
    });

    // Update icon container dataset and count
    document.querySelectorAll(`.na-icon-container[data-note-ids='${oldJson}']`).forEach(container => {
      container.dataset.noteIds = idsNorm;
      const countEl = container.querySelector('.na-icon-count');
      if (contentCount > 0) {
        if (countEl) {
          countEl.textContent = ` ${contentCount}`;
        } else {
          const newCount = document.createElement('span');
          newCount.className = 'na-icon-count';
          // derive font-size from icon if available
          const icon = container.querySelector('.na-icon');
          const fs = icon ? window.getComputedStyle(icon).fontSize : '12px';
          newCount.style.fontSize = `calc(${fs} * 0.75)`;
          newCount.textContent = ` ${contentCount}`;
          container.appendChild(newCount);
        }
      } else if (countEl) {
        countEl.remove();
      }
    });
  });
}

function findRangeByQuote(quote) {
  if (!quote || typeof quote !== 'string' || !quote.trim()) return null;
  try {
    const iterator = document.createNodeIterator(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    let node;
    while ((node = iterator.nextNode())) {
      const text = node.nodeValue;
      if (!text) continue;
      const idx = text.indexOf(quote);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + quote.length);
        return range;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}
// --- Tooltip Logic ---

let activeTooltip = null;
let tooltipHideTimeout = null;

function showTooltip(event) {
  if (tooltipHideTimeout) {
    clearTimeout(tooltipHideTimeout);
    tooltipHideTimeout = null;
  }
  
  const container = event.target.closest('.na-icon-container');
  if (!container) return;

  const noteIds = parseIds(container.dataset.noteIds);
  // Filter notes from global cache to ensure real-time data
  const notes = cachedNotes.filter(n => noteIds.includes(n.id));
  const notesWithContent = notes.filter(n => typeof n.content === 'string' && n.content.trim().length > 0);
  
  // Check if already showing for this group
  if (activeTooltip && activeTooltip.dataset.noteIds === container.dataset.noteIds) {
    return;
  }
  
  removeTooltip(); // Remove any existing tooltip

  const tooltip = document.createElement('div');
  tooltip.className = 'na-tooltip';
  tooltip.dataset.noteIds = container.dataset.noteIds;
  
  // Prevent tooltip from disappearing when hovering over it
  tooltip.addEventListener('mouseenter', () => {
    if (tooltipHideTimeout) {
      clearTimeout(tooltipHideTimeout);
      tooltipHideTimeout = null;
    }
  });
  tooltip.addEventListener('mouseleave', () => removeTooltip());

  // Render List
  const list = document.createElement('ul');
  list.className = 'na-tooltip-list';
  
  if (notesWithContent.length === 0) {
     if (notes.length === 0) {
       const li = document.createElement('li');
       li.className = 'na-tooltip-item na-tooltip-empty-state';
       
       const icon = document.createElement('span');
       icon.className = 'iconfont icon-footprints';
       li.appendChild(icon);
       
       const text = document.createElement('span');
       text.textContent = 'No footprint yet.';
       text.style.flex = '1';
       li.appendChild(text);
       
       list.appendChild(li);
     } else {
       notes.forEach(note => {
       const li = document.createElement('li');
       li.className = 'na-tooltip-item na-tooltip-empty-state';
       
       const icon = document.createElement('span');
       icon.className = 'iconfont icon-footprints';
       li.appendChild(icon);
       
       const text = document.createElement('span');
       text.textContent = 'No footprint yet.';
       text.style.flex = '1';
       li.appendChild(text);
       
       const delBtn = document.createElement('span');
       delBtn.className = 'iconfont icon-delete na-tooltip-delete';
       delBtn.title = 'Delete Footprint';
       delBtn.onclick = (e) => {
         e.stopPropagation();
         deleteNote(note.id);
         removeTooltip();
       };
       li.appendChild(delBtn);
       
       list.appendChild(li);
       });
     }

  } else {
    // Has content
    notesWithContent.forEach(note => {
       const li = document.createElement('li');
       li.className = 'na-tooltip-item';
       
       // Header: Icon + Content
       const header = document.createElement('div');
       header.className = 'na-tooltip-header';
       
       const icon = document.createElement('span');
       icon.className = 'iconfont icon-footprints na-tooltip-icon';
       header.appendChild(icon);
       
       const content = document.createElement('div');
       content.className = 'na-tooltip-content';
       content.textContent = note.content;
       header.appendChild(content);
       
       li.appendChild(header);
       
       // Meta: Time + Delete
       const meta = document.createElement('div');
       meta.className = 'na-tooltip-meta';
       
       const time = document.createElement('span');
       time.className = 'na-tooltip-time';
       time.textContent = new Date(note.createdAt).toLocaleString();
       meta.appendChild(time);
       
       const delBtn = document.createElement('span');
       delBtn.className = 'iconfont icon-delete na-tooltip-delete';
       delBtn.title = 'Delete Thought';
       delBtn.onclick = (e) => {
         e.stopPropagation();
         deleteNote(note.id);
         removeTooltip();
       };
       meta.appendChild(delBtn);
       
       li.appendChild(meta);
       list.appendChild(li);
    });
  }
  
  tooltip.appendChild(list);
  
  const footer = document.createElement('div');
  footer.className = 'na-tooltip-footer';
  const addBtn = document.createElement('button');
  addBtn.className = 'na-tooltip-add-btn';
  const addIcon = document.createElement('span');
  addIcon.className = 'iconfont icon-footprints';
  addBtn.appendChild(addIcon);
  const addText = document.createElement('span');
  addText.textContent = 'add footprints';
  addBtn.appendChild(addText);
  addBtn.onclick = (e) => {
    e.stopPropagation();
    const firstNote = notes[0];
    if (!firstNote || !firstNote.range) return;
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      payload: {
        text: firstNote.quote || '',
        url: window.location.href,
        range: firstNote.range,
        style: firstNote.style,
        color: firstNote.color
      }
    });
    removeTooltip();
  };
  footer.appendChild(addBtn);
  tooltip.appendChild(footer);
  
  document.body.appendChild(tooltip);

  // Position Logic
  const rect = container.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.left;
  let top = rect.bottom + 8;

  // Horizontal Check
  if (left + tooltipRect.width > viewportWidth) {
    left = viewportWidth - tooltipRect.width - 20; // 20px padding from right edge
  }
  if (left < 0) {
    left = 10;
  }

  // Vertical Check
  if (top + tooltipRect.height > viewportHeight) {
    // Flip to top if no space below
    top = rect.top - tooltipRect.height - 8;
  }
  
  tooltip.style.top = `${window.scrollY + top}px`;
  tooltip.style.left = `${window.scrollX + left}px`;
  activeTooltip = tooltip;
}

function hideTooltip(event) {
  tooltipHideTimeout = setTimeout(() => {
    removeTooltip();
  }, 300);
}

function removeTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

async function deleteNote(noteId) {
  if (confirm('Delete this footprint?')) {
    await chrome.runtime.sendMessage({
      type: 'DB_DELETE_NOTE',
      payload: noteId
    });
  }
}

function scrollToNote(noteId) {
  // Find mark or container with this noteId
  const marks = document.querySelectorAll('mark.na-highlight');
  for (const mark of marks) {
    const ids = parseIds(mark.dataset.noteIds);
    if (ids.includes(noteId)) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a flash effect?
      mark.style.transition = 'background-color 0.5s';
      const orig = mark.style.backgroundColor;
      mark.style.backgroundColor = 'yellow';
      setTimeout(() => mark.style.backgroundColor = orig, 1000);
      return;
    }
  }

  const note = cachedNotes.find(n => n.id === noteId);
  if (note && note.screenshotRect) {
    const rect = note.screenshotRect;
    const top = rect.top || 0;
    const height = rect.height || 0;
    const targetY = top + height / 2 - window.innerHeight / 2;
    const finalTop = targetY < 0 ? 0 : targetY;
    window.scrollTo({ top: finalTop, behavior: 'smooth' });
    showScreenshotOverlay(rect);
  }
}

function openSidePanelForNote(note) {
  // We can't easily open sidepanel for a specific note if it's not a draft
  // But we can open sidepanel and maybe it will load the context?
  // Currently sidepanel only loads draft.
  // We can send OPEN_SIDE_PANEL with payload.
  // But payload is usually a NEW selection.
  // If we just want to VIEW existing note in sidepanel, 
  // we might need to change sidepanel logic to support "View Mode".
  // For now, let's just trigger open without payload (or minimal).
  
  // Actually, existing logic for OPEN_SIDE_PANEL expects { text, url, range } for a NEW note.
  // If we want to edit, we need a different flow.
  // Let's just open the panel.
  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    payload: null // No new draft
  });
}

// Range serialization helpers (needed for new notes)
function serializeRange(range) {
  const startPath = getDomPath(range.startContainer);
  const endPath = getDomPath(range.endContainer);
  return {
    startPath: startPath,
    startOffset: range.startOffset,
    endPath: endPath,
    endOffset: range.endOffset
  };
}

function deserializeRange(serialized) {
  try {
    const startNode = getNodeByDomPath(serialized.startPath);
    const endNode = getNodeByDomPath(serialized.endPath);
    if (!startNode || !endNode) return null;
    
    const range = document.createRange();
    range.setStart(startNode, serialized.startOffset);
    range.setEnd(endNode, serialized.endOffset);
    return range;
  } catch (e) {
    return null;
  }
}

function getDomPath(node) {
  const path = [];
  while (node !== document.body && node.parentNode) {
    const parent = node.parentNode;
    const index = Array.prototype.indexOf.call(parent.childNodes, node);
    path.push(index);
    node = parent;
  }
  return path.reverse();
}

function getNodeByDomPath(path) {
  let node = document.body;
  for (const index of path) {
    if (!node || !node.childNodes || index >= node.childNodes.length) return null;
    node = node.childNodes[index];
  }
  return node;
}
