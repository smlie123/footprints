// background.js
importScripts('db.js');

// Allows users to open the side panel by clicking the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-footprints",
    title: "Add to Footprints",
    contexts: ["image"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-to-footprints") {
    handleImageContextMenu(info, tab);
  }
});

async function handleImageContextMenu(info, tab) {
  // Open side panel
  try {
    await chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
    // Notify sidepanel that processing started
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'IMAGE_PROCESSING_STARTED' });
    }, 100);
  } catch (e) {
    console.error("Failed to open side panel:", e);
  }

  // Convert image to base64 if needed
  let imageUrl = info.srcUrl;
  
  if (imageUrl.startsWith('data:')) {
    // Already base64
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'ADD_IMAGE_TO_FOOTPRINTS',
        payload: {
            imageUrl: imageUrl,
            pageUrl: tab.url,
            srcUrl: imageUrl
          }
        });
      }, 500); // Small delay to ensure sidepanel is ready
    } else {
      // Fetch and convert
      try {
        const dataUrl = await fetchImageAsBase64(imageUrl);
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'ADD_IMAGE_TO_FOOTPRINTS',
            payload: {
              imageUrl: dataUrl,
              pageUrl: tab.url,
              srcUrl: imageUrl
            }
          });
        }, 500);
    } catch (e) {
      console.error("Failed to fetch image:", e);
    }
  }
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Listen for messages from content script and other parts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDE_PANEL') {
    handleOpenSidePanel(message, sender);
    return true; 
  }

  if (message.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("Capture failed:", chrome.runtime.lastError.message);
        sendResponse(null);
      } else {
        sendResponse(dataUrl);
      }
    });
    return true;
  }
  
  // DB Proxy for Content Scripts (and others)
  if (message.type && message.type.startsWith('DB_')) {
    handleDBMessage(message, sendResponse);
    return true; // Async response
  }
  
  // Data Changed Notification (from Home/Sidepanel)
  if (message.type === 'DATA_CHANGED') {
    broadcastDataChanged(message.changes);
    updateBadges(); // Also update badges locally
  }
});

async function handleOpenSidePanel(message, sender) {
  if (sender.tab) {
    chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId })
      .then(() => {
        if (message.payload) {
          db.setSetting('tempDraft', message.payload)
            .then(() => {
              broadcastDataChanged({ tempDraft: true });
            })
            .catch((error) => {
              console.error('Failed to store tempDraft:', error);
            });
        }
      })
      .catch((error) => {
        console.error("Failed to open side panel:", error);
      });
  }
}

async function handleDBMessage(message, sendResponse) {
  try {
    let result;
    switch (message.type) {
      case 'DB_GET_NOTES':
        result = await db.getAllNotes();
        break;
      case 'DB_ADD_NOTE':
        result = await db.addNote(message.payload);
        broadcastDataChanged({ notes: true });
        updateBadges();
        break;
      case 'DB_DELETE_NOTE':
        await db.deleteNote(message.payload);
        result = true;
        broadcastDataChanged({ notes: true });
        updateBadges();
        break;
      case 'DB_GET_SETTING':
        result = await db.getSetting(message.payload);
        break;
      case 'DB_SET_SETTING':
        await db.setSetting(message.payload.key, message.payload.value);
        result = true;
        broadcastDataChanged({ [message.payload.key]: true });
        break;
      case 'DB_GET_ALL_DATA':
        const allNotes = await db.getAllNotes();
        const allSettings = await db.getAllSettings();
        result = { notes: allNotes, ...allSettings };
        break;
      case 'DB_CLEAR_ALL':
        await db.clearNotes();
        await db.clearSettings();
        result = true;
        broadcastDataChanged({ notes: true, settings: true });
        updateBadges();
        break;
      case 'DB_IMPORT_DATA':
        const data = message.payload;
        if (data.notes && Array.isArray(data.notes)) {
          await db.importNotes(data.notes);
        }
        // Import other keys as settings, excluding 'notes'
        const settingsToImport = {};
        Object.keys(data).forEach(key => {
          if (key !== 'notes') {
            settingsToImport[key] = data[key];
          }
        });
        if (Object.keys(settingsToImport).length > 0) {
          await db.importSettings(settingsToImport);
        }
        result = true;
        broadcastDataChanged({ notes: true, settings: true });
        updateBadges();
        break;
      default:
        throw new Error('Unknown DB message type');
    }
    sendResponse({ success: true, data: result });
  } catch (e) {
    console.error('DB Operation failed:', e);
    sendResponse({ success: false, error: e.toString() });
  }
}

function broadcastDataChanged(changes) {
  // Notify all tabs (content scripts)
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'DATA_CHANGED',
        changes: changes
      }).catch(() => {}); // Ignore if tab doesn't listen
    });
  });
  
  // Notify runtime (popup, sidepanel, other extension pages)
  chrome.runtime.sendMessage({
    type: 'DATA_CHANGED',
    changes: changes
  }).catch(() => {});
}

// Optional: Log installation
chrome.runtime.onInstalled.addListener(() => {
  // console.log("Footprints extension installed.");
  updateBadges();
});

// Initialize badges on service worker startup
updateBadges();

// 1. On Tab Activated (Switched)
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

// 2. On Tab Updated (URL changed or loaded)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadgeForTab(tabId);
  }
});

async function updateBadges() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => updateBadgeForTab(tab.id));
  });
}

async function updateBadgeForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const count = await db.getNotesCount(tab.url);
    const text = count > 0 ? count.toString() : '';
    await chrome.action.setBadgeText({ text, tabId });
  } catch (e) {
    // Ignore errors
  }
}
