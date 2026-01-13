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
  solid: '#F28B82',
  line: '#C62828',
  dash: '#C62828',
  wavy: '#C62828'
};
let currentToolVisibility = {
  solid: true,
  line: false,
  dash: false,
  wavy: false,
  annotation: true
};
let cachedNotes = [];

document.addEventListener('DOMContentLoaded', loadHighlights);
loadHighlights();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.notes || changes.styleConfig || changes.toolVisibility) {
      loadHighlights();
    }
  }
});

// Handle Scroll Request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCROLL_TO_NOTE') {
    const noteId = message.noteId;
    scrollToNote(noteId);
  }
  if (message.type === 'REFRESH_HIGHLIGHTS') {
    loadHighlights();
  }
});

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
    
    // Add mousedown listener instead of click to prevent losing selection
    btn.addEventListener('mousedown', (e) => onStyleClick(e, style.type));
    
    const icon = document.createElement('span');
    icon.className = `iconfont ${style.icon}`;
    btn.appendChild(icon);
    floatingBtn.appendChild(btn);
  });

  // Edit Button
  // Annotation tool is usually fixed, but check just in case
  if (currentToolVisibility['annotation'] !== false) {
    const editBtn = document.createElement('button');
    editBtn.className = 'na-float-btn na-btn-add';
    editBtn.addEventListener('mousedown', onAddNoteClick);
    const editIcon = document.createElement('span');
    editIcon.className = 'iconfont icon-edit';
    editBtn.appendChild(editIcon);
    floatingBtn.appendChild(editBtn);
  }
  
  const rects = range.getClientRects();
  if (rects.length > 0) {
    const lastRect = rects[rects.length - 1];
    const top = window.scrollY + lastRect.bottom + 8;
    const left = window.scrollX + lastRect.right;
    
    floatingBtn.style.top = `${top}px`;
    floatingBtn.style.left = `${left}px`;
  } else {
    const rect = range.getBoundingClientRect();
    floatingBtn.style.top = `${window.scrollY + rect.bottom + 10}px`;
    floatingBtn.style.left = `${window.scrollX + rect.right}px`;
  }

  document.body.appendChild(floatingBtn);
}

function removeFloatingButton() {
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }
}

async function onStyleClick(e, styleType) {
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
      color: currentStyleConfig[styleType]
  };

  const result = await chrome.storage.local.get(['notes']);
  const notes = result.notes || [];
  notes.unshift(newNote);
  await chrome.storage.local.set({ notes: notes });

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
  const result = await chrome.storage.local.get(['notes', 'styleConfig', 'toolVisibility']);
  const notes = result.notes || [];
  cachedNotes = notes;
  const styleConfig = result.styleConfig || currentStyleConfig;
  
  if (result.toolVisibility) {
    currentToolVisibility = result.toolVisibility;
  }
  
  // Update global config and CSS variables
  currentStyleConfig = styleConfig;
  Object.keys(currentStyleConfig).forEach(style => {
    document.documentElement.style.setProperty(`--na-color-${style}`, currentStyleConfig[style]);
  });

  const currentUrl = window.location.href;
  const pageNotes = notes.filter(n => n.url === currentUrl && n.range);

  // Group notes by range
  const groupedNotes = {};
  pageNotes.forEach(note => {
    const rangeKey = JSON.stringify(note.range);
    if (!groupedNotes[rangeKey]) {
      groupedNotes[rangeKey] = [];
    }
    groupedNotes[rangeKey].push(note);
  });

  // Prepare normalized groups with sorted ID sets
  const groups = Object.values(groupedNotes).map(group => {
    const ids = group.map(n => n.id);
    const norm = normalizeIds(ids);
    const contentCount = countNotesWithContent(group);
    return { ids, idsNorm: norm, group, range: group[0].range, contentCount };
  });

  // Merge/update existing highlights to avoid removal on ID changes
  mergeExistingHighlights(groups);

  // Build valid ID sets for cleanup (normalized)
  const validIdJsons = new Set(groups.map(g => g.idsNorm));

  // Remove stale highlights/containers not present in current data
  cleanupStaleHighlights(validIdJsons);

  // Add missing highlights
  groups.forEach(({ group, idsNorm, range }) => {
    try {
      const exists = document.querySelector(`mark.na-highlight[data-note-ids='${idsNorm}']`);
      if (exists) {
        // Update style if changed (for existing highlights)
        // The first note in group determines the style
        const noteStyle = group[0].style || 'solid';
        const styleClass = `na-style-${noteStyle}`;
        // Remove old style classes and add new one
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

      const deserialized = deserializeRange(range);
      if (deserialized) {
        const noteStyle = group[0].style || 'solid';
        highlightRange(deserialized, group, `na-style-${noteStyle}`);
      }
    } catch (e) {
      console.warn('Footprints: Failed to restore highlight', e);
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.styleConfig) {
      currentStyleConfig = changes.styleConfig.newValue;
      Object.keys(currentStyleConfig).forEach(style => {
        document.documentElement.style.setProperty(`--na-color-${style}`, currentStyleConfig[style]);
      });
    }
  }
});

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
    
    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), node);
    }
    
    parent.removeChild(node);
  });

  // Insert Icon Immediately After Last Mark (Always)
  if (lastMark) {
    const contentCount = countNotesWithContent(notes);
    const iconContainer = document.createElement('span');
    iconContainer.className = `na-icon-container note-anywhere-ui`;
    iconContainer.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
    iconContainer.style.whiteSpace = 'nowrap'; // Keep icon and count together
    
    const icon = document.createElement('span');
    icon.className = `iconfont icon-footprints na-icon ${styleClass}`;
    if (noteColor) {
      icon.style.color = noteColor;
    }
    icon.dataset.noteIds = JSON.stringify(notes.map(n => n.id));
    
    // Auto-size icon to match text
    const computedStyle = window.getComputedStyle(lastMark);
    const fontSize = computedStyle.fontSize;
    icon.style.fontSize = fontSize; // Match text size
    
    iconContainer.appendChild(icon);

    if (contentCount > 0) {
      const countSpan = document.createElement('span');
      countSpan.className = 'na-icon-count';
      countSpan.textContent = ` ${contentCount}`;
      countSpan.style.fontSize = `calc(${fontSize} * 0.75)`; // Scale relative to text
      iconContainer.appendChild(countSpan);
    }
    
    iconContainer.addEventListener('mouseenter', (e) => showTooltip(e));
    iconContainer.addEventListener('mouseleave', (e) => hideTooltip(e));
    
    iconContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      openSidePanelForNote(notes[0]); 
    });

    // Insert immediately after the last mark in the DOM
    if (lastMark.nextSibling) {
      lastMark.parentNode.insertBefore(iconContainer, lastMark.nextSibling);
    } else {
      lastMark.parentNode.appendChild(iconContainer);
    }
  }
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
  // Numeric-safe sort; if not numeric, fallback to string compare
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
         // Don't remove tooltip immediately, let storage listener refresh it
         // But UI might look stale. removeTooltip() is safer.
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
       delBtn.title = 'Delete Footprint';
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

  // Footer: Add Note Button
   const footer = document.createElement('div');
   footer.className = 'na-tooltip-footer';
   
   const addBtn = document.createElement('button');
   addBtn.className = 'na-tooltip-add-btn';
   addBtn.title = 'Add Footprint';
   addBtn.innerHTML = '<span class="iconfont icon-edit"></span> Add Footprint';
   addBtn.onclick = (e) => {
     e.stopPropagation();
     // Open sidepanel to add note for THIS range
     // We can use the first note's range as they are grouped
     const refNote = notes[0];
     chrome.runtime.sendMessage({
       type: 'OPEN_SIDE_PANEL',
       payload: {
         text: refNote.quote,
         url: refNote.url,
         range: refNote.range
         // Don't pass noteId, so it creates a NEW note
       }
     });
     removeTooltip();
   };
  
  footer.appendChild(addBtn);
  tooltip.appendChild(footer);

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  // Position Tooltip
  const rect = event.target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = window.scrollY + rect.top - tooltipRect.height - 10;
  let left = window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2);

  // Boundary checks
  if (top < window.scrollY) {
    top = window.scrollY + rect.bottom + 10; // Show below if no space above
  }
  if (left < 0) left = 10;
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function hideTooltip(event) {
  tooltipHideTimeout = setTimeout(() => {
    removeTooltip();
  }, 300); // Small delay
}

function removeTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

async function deleteNote(noteId) {
  if (!confirm('Are you sure you want to delete this footprint?')) return;
  
  const result = await chrome.storage.local.get(['notes']);
  let notes = result.notes || [];
  notes = notes.filter(n => n.id !== noteId);
  
  await chrome.storage.local.set({ notes: notes });
}

function openSidePanelForNote(note) {
   chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    payload: {
      text: note.quote,
      url: note.url,
      range: note.range,
      noteId: note.id // Pass ID to identify existing note
    }
  });
}

function scrollToNote(noteId) {
  // Try to find the icon first, as it marks the end (best for reading)
  // Or find the first highlight mark
  // We use data-note-ids*="noteId" because we store array of IDs
  const target = document.querySelector(`.na-icon[data-note-ids*="${noteId}"]`) || 
                 document.querySelector(`mark.na-highlight[data-note-ids*="${noteId}"]`);
  
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Temporary flash effect
    const originalTransition = target.style.transition;
    const originalTransform = target.style.transform;
    
    target.style.transition = 'transform 0.3s ease-in-out';
    target.style.transform = 'scale(1.5)';
    
    setTimeout(() => {
      target.style.transform = originalTransform;
      setTimeout(() => {
         target.style.transition = originalTransition;
      }, 300);
    }, 500);
  } else {
    console.warn("Target highlight not found for note:", noteId);
  }
}


// --- XPath Serialization (Robust) ---

function serializeRange(range) {
  return {
    startPath: getXPath(range.startContainer),
    startOffset: range.startOffset,
    endPath: getXPath(range.endContainer),
    endOffset: range.endOffset
  };
}

function deserializeRange(serialized) {
  const startNode = getNodeByXPath(serialized.startPath);
  const endNode = getNodeByXPath(serialized.endPath);
  if (!startNode || !endNode) return null;
  if (startNode.nodeType !== Node.TEXT_NODE || endNode.nodeType !== Node.TEXT_NODE) return null;
  const startLen = startNode.nodeValue ? startNode.nodeValue.length : 0;
  const endLen = endNode.nodeValue ? endNode.nodeValue.length : 0;
  let startOffset = Math.min(Math.max(serialized.startOffset || 0, 0), startLen);
  let endOffset = Math.min(Math.max(serialized.endOffset || 0, 0), endLen);
  if (startNode === endNode && startOffset > endOffset) {
    const tmp = startOffset;
    startOffset = endOffset;
    endOffset = tmp;
  }
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function getXPath(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parentPath = getXPath(node.parentNode);
    const index = getChildIndex(node);
    return `${parentPath}/text()[${index}]`;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node === document.body) return '/html/body';
    
    const parentPath = getXPath(node.parentNode);
    const tagName = node.tagName.toLowerCase();
    const index = getChildIndex(node);
    return `${parentPath}/${tagName}[${index}]`;
  }
  
  return '';
}

function getChildIndex(node) {
  let index = 1;
  let sibling = node.previousSibling;
  while (sibling) {
    if (sibling.nodeType === node.nodeType && sibling.nodeName === node.nodeName) {
      index++;
    }
    sibling = sibling.previousSibling;
  }
  return index;
}

function getNodeByXPath(path) {
  try {
    const evaluator = new XPathEvaluator();
    const result = evaluator.evaluate(
      path, 
      document.documentElement, 
      null, 
      XPathResult.FIRST_ORDERED_NODE_TYPE, 
      null
    );
    return result.singleNodeValue;
  } catch (e) {
    return null;
  }
}
