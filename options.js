document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Logic
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all
      navItems.forEach(nav => nav.classList.remove('active'));
      tabContents.forEach(tab => tab.classList.remove('active'));

      // Add active class to current
      item.classList.add('active');
      const tabId = item.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Toolbar Settings Logic
  const settingsList = document.getElementById('settings-list');
  const previewContainer = document.getElementById('settings-toolbar-preview');
  const applyBtn = document.getElementById('apply-settings-btn');
  const colorPickerPopup = document.getElementById('color-picker-popup');
  const customColorInput = document.getElementById('custom-color-input');
  const cancelColorBtn = document.getElementById('cancel-color-btn');
  const applyColorBtn = document.getElementById('apply-color-btn');
  
  // Re-select preset colors since they are now dynamic in HTML (though currently static in HTML file, good practice)
  const presetColors = document.querySelectorAll('.preset-color');

  let toolbarConfig = [];
  let tempToolbarConfig = [];
  let defaultStyleType = 'solid';
  let tempDefaultStyle = 'solid';
  let activeItemId = null;
  let pendingColor = null; // Store color selection within popup before applying

  const AVAILABLE_TOOLS = [
    { type: 'solid', label: 'Highlight', icon: 'icon-solid' },
    { type: 'line', label: 'Underline', icon: 'icon-line' },
    { type: 'dash', label: 'Dashed', icon: 'icon-dash' },
    { type: 'wavy', label: 'Wavy', icon: 'icon-iocn_wavyLine' }
  ];

  // Initialize
  await loadSettings();
  renderSettingsUI();

  // Apply Button
  applyBtn.addEventListener('click', async () => {
    toolbarConfig = JSON.parse(JSON.stringify(tempToolbarConfig));
    defaultStyleType = tempDefaultStyle;
    
    await chrome.runtime.sendMessage({
      type: 'DB_SET_SETTING',
      payload: { key: 'toolbarConfig', value: toolbarConfig }
    });
    
    await chrome.runtime.sendMessage({
      type: 'DB_SET_SETTING',
      payload: { key: 'defaultStyle', value: defaultStyleType }
    });

    // Notify all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {});
    });

    // Feedback
    const originalText = applyBtn.textContent;
    applyBtn.textContent = 'Saved!';
    setTimeout(() => {
        applyBtn.textContent = originalText;
    }, 2000);
  });

  // Color Picker Logic
  presetColors.forEach(preset => {
    preset.addEventListener('click', () => {
      if (!activeItemId) return;
      pendingColor = preset.dataset.color;
      
      // Visual feedback in popup only
      customColorInput.value = pendingColor;
      
      // Optional: Highlight selected preset
      presetColors.forEach(p => p.style.borderColor = 'rgba(0,0,0,0.1)');
      preset.style.borderColor = '#1a73e8';
    });
  });

  customColorInput.addEventListener('input', (e) => {
    if (!activeItemId) return;
    pendingColor = e.target.value;
    // Clear preset selection highlight
    presetColors.forEach(p => p.style.borderColor = 'rgba(0,0,0,0.1)');
  });

  // Close color picker when clicking outside
  document.addEventListener('click', (e) => {
    // If popup is hidden, do nothing
    if (colorPickerPopup.classList.contains('hidden')) return;

    // Check if click is outside popup AND not on a color circle that opens it
    if (!colorPickerPopup.contains(e.target) && !e.target.closest('.color-circle')) {
      colorPickerPopup.classList.add('hidden');
    }
  });
  
  // Cancel button handler
  if (cancelColorBtn) {
    cancelColorBtn.addEventListener('click', () => {
        colorPickerPopup.classList.add('hidden');
    });
  }

  // Apply button handler (popup)
  if (applyColorBtn) {
    applyColorBtn.addEventListener('click', () => {
        if (activeItemId && pendingColor) {
            commitItemColor(activeItemId, pendingColor);
        }
        colorPickerPopup.classList.add('hidden');
    });
  }

  function commitItemColor(itemId, color) {
    const item = tempToolbarConfig.find(i => i.id === itemId);
    if (!item) return;
    
    item.color = color;
    
    const circle = document.querySelector(`.setting-row[data-id="${itemId}"] .color-circle`);
    if (circle) circle.style.backgroundColor = color;
    
    renderToolbarPreview();
  }

  async function loadSettings() {
    const configResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'toolbarConfig' });
    const defaultStyleResp = await chrome.runtime.sendMessage({ type: 'DB_GET_SETTING', payload: 'defaultStyle' });

    defaultStyleType = defaultStyleResp && defaultStyleResp.data ? defaultStyleResp.data : 'solid';

    if (configResp && configResp.data) {
      toolbarConfig = configResp.data;
    } else {
      // Default
      toolbarConfig = [
          { id: crypto.randomUUID(), type: 'solid', color: '#fa7cef' },
          { id: 'annotation', type: 'annotation', fixed: true, color: '#ff0000' }
      ];
    }
    
    tempToolbarConfig = JSON.parse(JSON.stringify(toolbarConfig));
    tempDefaultStyle = defaultStyleType;
  }

  function renderSettingsUI() {
    settingsList.innerHTML = '';
    
    tempToolbarConfig.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.dataset.id = item.id;

      if (item.type === 'annotation') {
        const info = document.createElement('div');
        info.className = 'setting-info';
        const icon = document.createElement('span');
        icon.className = 'iconfont icon-edit setting-icon';
        info.appendChild(icon);
        const label = document.createElement('span');
        label.className = 'setting-label';
        label.textContent = 'Annotation';
        info.appendChild(label);

        const right = document.createElement('div');
        right.className = 'setting-right';

        const currentTool = AVAILABLE_TOOLS.find(t => t.type === tempDefaultStyle) || AVAILABLE_TOOLS[0];
        const annotationSelect = document.createElement('div');
        annotationSelect.className = 'custom-select annotation-select';

        const trigger = document.createElement('div');
        trigger.className = 'select-trigger';
        trigger.innerHTML = `<span class="iconfont ${currentTool.icon}"></span><span>${currentTool.label}</span><svg class="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        const optionsList = document.createElement('div');
        optionsList.className = 'select-options';

        AVAILABLE_TOOLS.forEach(tool => {
          const opt = document.createElement('div');
          opt.className = 'select-option';
          opt.innerHTML = `<span class="iconfont ${tool.icon}"></span><span>${tool.label}</span>`;
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            tempDefaultStyle = tool.type;
            trigger.innerHTML = `<span class="iconfont ${tool.icon}"></span><span>${tool.label}</span><svg class="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            optionsList.classList.remove('show');
          });
          optionsList.appendChild(opt);
        });

        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.select-options.show').forEach(el => {
            if (el !== optionsList) el.classList.remove('show');
          });
          optionsList.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
          if (!annotationSelect.contains(e.target)) {
            optionsList.classList.remove('show');
          }
        });

        annotationSelect.appendChild(trigger);
        annotationSelect.appendChild(optionsList);

        const controls = document.createElement('div');
        controls.className = 'setting-controls';

        if (!item.color) item.color = '#ff0000';

        const colorCircle = document.createElement('div');
        colorCircle.className = 'color-circle';
        colorCircle.style.backgroundColor = item.color;
        colorCircle.addEventListener('click', (e) => {
          e.stopPropagation();
          openColorPicker(item.id, row);
        });
        controls.appendChild(colorCircle);

        right.appendChild(annotationSelect);
        right.appendChild(controls);

        row.appendChild(info);
        row.appendChild(right);
      } else {
        const dropdown = createCustomSelect(item, (newType) => {
            item.type = newType;
            renderSettingsUI(); 
        });
        row.appendChild(dropdown);

        const controls = document.createElement('div');
        controls.className = 'setting-controls';

        const colorCircle = document.createElement('div');
        colorCircle.className = 'color-circle';
        colorCircle.style.backgroundColor = item.color;
        colorCircle.addEventListener('click', (e) => {
          e.stopPropagation();
          openColorPicker(item.id, row);
        });
        controls.appendChild(colorCircle);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-row';
        deleteBtn.innerHTML = '<span class="iconfont icon-delete"></span>';
        deleteBtn.title = 'Remove';
        deleteBtn.addEventListener('click', () => {
            tempToolbarConfig.splice(index, 1);
            renderSettingsUI();
        });
        controls.appendChild(deleteBtn);

        row.appendChild(controls);
      }
      
      settingsList.appendChild(row);
    });

    const addContainer = document.createElement('div');
    addContainer.className = 'add-setting-container';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-row';
    addBtn.innerHTML = '<span>+</span> Add Tool';
    addBtn.addEventListener('click', () => {
        const lastItem = tempToolbarConfig[tempToolbarConfig.length - 1];
        
        // Gather colors from preset-color elements
        const presetEls = document.querySelectorAll('.preset-color');
        let randomColor = '#fa7cef';
        if (presetEls.length > 0) {
            const randomIndex = Math.floor(Math.random() * presetEls.length);
            randomColor = presetEls[randomIndex].getAttribute('data-color') || '#fa7cef';
        }

        const newItem = {
            id: crypto.randomUUID(),
            type: 'solid',
            color: randomColor
        };
        
        if (lastItem && lastItem.type === 'annotation') {
            tempToolbarConfig.splice(tempToolbarConfig.length - 1, 0, newItem);
        } else {
            tempToolbarConfig.push(newItem);
        }
        
        renderSettingsUI();
    });
    addContainer.appendChild(addBtn);
    settingsList.appendChild(addContainer);

    renderToolbarPreview();
  }

  function createCustomSelect(item, onChange) {
      const container = document.createElement('div');
      container.className = 'custom-select';
      
      const currentTool = AVAILABLE_TOOLS.find(t => t.type === item.type) || AVAILABLE_TOOLS[0];

      const trigger = document.createElement('div');
      trigger.className = 'select-trigger';
      trigger.innerHTML = `<span class="iconfont ${currentTool.icon}"></span><span>${currentTool.label}</span><svg class="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      
      const optionsList = document.createElement('div');
      optionsList.className = 'select-options';
      
      AVAILABLE_TOOLS.forEach(tool => {
          const opt = document.createElement('div');
          opt.className = 'select-option';
          opt.innerHTML = `<span class="iconfont ${tool.icon}"></span><span>${tool.label}</span>`;
          opt.addEventListener('click', (e) => {
              e.stopPropagation();
              onChange(tool.type);
              optionsList.classList.remove('show');
          });
          optionsList.appendChild(opt);
      });

      trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.select-options.show').forEach(el => {
              if (el !== optionsList) el.classList.remove('show');
          });
          optionsList.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
          if (!container.contains(e.target)) {
              optionsList.classList.remove('show');
          }
      });

      container.appendChild(trigger);
      container.appendChild(optionsList);
      return container;
  }

  function renderToolbarPreview() {
    previewContainer.innerHTML = '';
    tempToolbarConfig.forEach(item => {
        if (item.type === 'annotation') {
            const btn = document.createElement('button');
            btn.className = 'na-float-btn na-btn-add';
            btn.innerHTML = '<span class="iconfont icon-edit"></span>';
            previewContainer.appendChild(btn);
        } else {
            const tool = AVAILABLE_TOOLS.find(t => t.type === item.type);
            if (tool) {
                const btn = document.createElement('button');
                btn.className = `na-float-btn na-style-${item.type}`;
                btn.style.color = item.color;
                btn.innerHTML = `<span class="iconfont ${tool.icon}"></span>`;
                previewContainer.appendChild(btn);
            }
        }
    });
  }

  function openColorPicker(itemId, rowElement) {
      activeItemId = itemId;
      const item = tempToolbarConfig.find(i => i.id === itemId);
      if (!item) return;

      colorPickerPopup.classList.remove('hidden');
      customColorInput.value = item.color;
      
      document.querySelectorAll('.setting-row').forEach(r => r.style.backgroundColor = '');
      rowElement.style.backgroundColor = '#f1f3f4';
  }
});
