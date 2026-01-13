// background.js

// Allows users to open the side panel by clicking the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDE_PANEL') {
    // 1. Store the draft data temporarily so sidepanel can pick it up
    chrome.storage.local.set({ 
      tempDraft: message.payload 
    });

    // 2. Open the side panel
    // Note: chrome.sidePanel.open requires a user gesture.
    // The message from content script originates from a click, so this MIGHT work.
    // If it fails, we need to handle it.
    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId })
        .catch((error) => {
          console.error("Failed to open side panel:", error);
          // Fallback? Unfortunately we can't force it open without gesture context if lost.
        });
    }
  }
});

// Optional: Log installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Footprints extension installed.");
  // Initialize badges on install/update
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => updateBadge(tab.id));
  });
});

// Initialize badges on service worker startup (e.g. browser restart or extension reload)
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => updateBadge(tab.id));
});


// --- Badge Logic ---

async function updateBadge(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || [];
    
    // Count notes for this URL
    // We match by exact URL. 
    // If you need to ignore hash/query params, adjust here. 
    // Current implementation in content.js seems to use exact window.location.href.
    const count = notes.filter(n => n.url === tab.url).length;

    const text = count > 0 ? count.toString() : '';
    await chrome.action.setBadgeText({ text, tabId });
    
    // Optional: Set badge color
    // chrome.action.setBadgeBackgroundColor({ color: '#F28B82', tabId }); 
  } catch (e) {
    // Ignore errors (e.g. tab closed during async)
    // console.debug('Badge update failed', e);
  }
}

// 1. On Tab Activated (Switched)
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadge(activeInfo.tabId);
});

// 2. On Tab Updated (URL changed or loaded)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadge(tabId);
  }
});

// 3. On Storage Changed (Notes added/removed)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.notes) {
    // Update badge for ALL tabs because we don't know which tabs match the modified notes easily
    // and querying all tabs is cheap enough.
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => updateBadge(tab.id));
    });
  }
});
