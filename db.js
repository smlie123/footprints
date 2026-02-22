const DB_NAME = 'footprints_db';
const DB_VERSION = 1;

class FootprintsDB {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject('IndexedDB error: ' + event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Notes store: Stores individual note objects
        // Key: id (timestamp)
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('url', 'url', { unique: false });
          notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Settings store: Stores key-value pairs (config, drafts, history, etc.)
        // Key: key (string)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // --- Notes Operations ---

  async getAllNotes() {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();
      request.onsuccess = () => {
        const notes = request.result || [];
        // Sort by createdAt desc (newest first)
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearNotes() {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async importNotes(notes) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      let completed = 0;
      let errors = 0;
      
      transaction.oncomplete = () => resolve({ completed, errors });
      transaction.onerror = () => reject(transaction.error);

      notes.forEach(note => {
        store.put(note);
        completed++;
      });
    });
  }

  async getAllSettings() {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();
      request.onsuccess = () => {
        const result = {};
        (request.result || []).forEach(item => {
          result[item.key] = item.value;
        });
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSettings() {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async importSettings(settings) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      Object.keys(settings).forEach(key => {
        store.put({ key, value: settings[key] });
      });
    });
  }

  async addNote(note) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.put(note);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNotesCount(url) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('url');
      const request = index.count(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // --- Settings Operations ---

  async getSetting(key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key, value) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeSetting(key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Bulk Operations ---

  async exportAll() {
    const notes = await this.getAllNotes();
    const settingsKeys = ['styleConfig', 'toolVisibility', 'tempDraft', 'thoughtTheme', 'exportHistory', 'pdfExportHistory', 'pdfExportConfig'];
    const data = { notes };
    for (const key of settingsKeys) {
      const val = await this.getSetting(key);
      if (val !== null) data[key] = val;
    }
    return data;
  }
  
  async importAll(data) {
     await this.open();
     const tx = this.db.transaction(['notes', 'settings'], 'readwrite');
     await new Promise((resolve, reject) => {
         const clearNotes = tx.objectStore('notes').clear();
         clearNotes.onsuccess = () => {
             const clearSettings = tx.objectStore('settings').clear();
             clearSettings.onsuccess = resolve;
             clearSettings.onerror = (e) => reject(e.target.error);
         };
         clearNotes.onerror = (e) => reject(e.target.error);
     });
     
     // Add new data
     // Re-open transaction for adding (or use same if chainable, but let's be safe)
     // Actually we can reuse tx if we didn't await above, but we did.
     
     const notes = Array.isArray(data.notes) ? data.notes : [];
     for (const note of notes) {
         await this.addNote(note);
     }
     
     for (const key of Object.keys(data)) {
         if (key !== 'notes') {
             await this.setSetting(key, data[key]);
         }
     }
  }

  async clearAll() {
    await this.open();
    const tx = this.db.transaction(['notes', 'settings'], 'readwrite');
    tx.objectStore('notes').clear();
    tx.objectStore('settings').clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }
}

// Global instance
const db = new FootprintsDB();
