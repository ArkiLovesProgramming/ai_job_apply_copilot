  // AI Apply Copilot - Popup Script

// Field IDs to save/load
const API_FIELDS = ['aiBaseURL', 'aiModel', 'apiKey'];
const USER_FIELDS = ['aiApply_userContext'];
const SETTINGS_FIELDS = ['autoDetect', 'showButtons'];

// Load saved data when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      document.getElementById('currentSite').textContent = url.hostname;
    }
  } catch (e) {
    console.error('Error getting tab:', e);
  }

  // Load all saved data
  const data = await chrome.storage.sync.get([
    ...API_FIELDS,
    ...USER_FIELDS,
    ...SETTINGS_FIELDS,
    'currentJobInfo'
  ]);

  // Fill API fields
  API_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (el && data[field] !== undefined) {
      el.value = data[field];
    }
  });

  // Fill User fields - map storage key to UI element
  const userContextEl = document.getElementById('userContext');
  if (userContextEl && data['aiApply_userContext'] !== undefined) {
    userContextEl.value = data['aiApply_userContext'];
  }

  // Fill Settings fields
  SETTINGS_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (el) {
      el.checked = data[field] !== false;
    }
  });

  // Display job info if available
  if (data.currentJobInfo) {
    displayJobInfo(data.currentJobInfo);
  }

  // Also try to refresh job info from current page
  refreshJobInfoFromPage();

  // Initialize tab switching
  initTabs();

  // Initialize event listeners
  initEventListeners();
});

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

function initEventListeners() {
  // Test API Connection
  document.getElementById('testApiBtn').addEventListener('click', testConnection);

  // Toggle Password Visibility
  document.getElementById('togglePassword').addEventListener('click', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const eyeOpen = document.querySelector('.eye-open');
    const eyeClosed = document.querySelector('.eye-closed');

    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      eyeOpen.style.display = 'none';
      eyeClosed.style.display = 'block';
    } else {
      apiKeyInput.type = 'password';
      eyeOpen.style.display = 'block';
      eyeClosed.style.display = 'none';
    }
  });

  // Save API Settings
  document.getElementById('saveApiBtn').addEventListener('click', saveApiSettings);

  // Save User Info
  document.getElementById('saveUserBtn').addEventListener('click', saveUserInfo);

  // Refresh/Rescan button
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await notifyContentScript('rescan');
    showStatus('userStatus', 'Refreshing page...', 'success');
    setTimeout(() => {
      window.close();
    }, 500);
  });

  // Settings toggles - notify content script
  document.getElementById('autoDetect').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ autoDetect: e.target.checked });
    notifyContentScript('updateSettings', { autoDetect: e.target.checked });
  });

  document.getElementById('showButtons').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ showButtons: e.target.checked });
    notifyContentScript(e.target.checked ? 'showButtons' : 'hideButtons');
  });
}

// Shared API test function
async function testApiConnection(baseURL, model, apiKey) {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: 'Say "ok"' }],
      max_tokens: 10
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function testConnection() {
  const baseURL = document.getElementById('aiBaseURL').value.trim() || 'https://api.openai.com/v1';
  const model = document.getElementById('aiModel').value.trim() || 'gpt-4o-mini';
  const apiKey = document.getElementById('apiKey').value.trim();

  const btn = document.getElementById('testApiBtn');

  if (!apiKey) {
    showStatus('apiStatus', 'Please enter an API key', 'error');
    return;
  }

  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spin">⟳</span> Testing...';

  try {
    await testApiConnection(baseURL, model, apiKey);

    // Auto-save settings after successful test
    await chrome.storage.sync.set({
      aiBaseURL: baseURL,
      aiModel: model,
      apiKey: apiKey
    });

    showStatus('apiStatus', '✓ Connection successful & saved!', 'success');
  } catch (err) {
    showStatus('apiStatus', '✗ Failed: ' + (err.message || 'Unknown error'), 'error');
  }

  btn.innerHTML = originalText;
}

async function saveApiSettings() {
  const baseURL = document.getElementById('aiBaseURL').value.trim();
  const model = document.getElementById('aiModel').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();

  // Save settings directly
  await chrome.storage.sync.set({
    aiBaseURL: baseURL,
    aiModel: model,
    apiKey: apiKey
  });

  if (apiKey) {
    showStatus('apiStatus', 'Settings saved', 'success');
  } else {
    showStatus('apiStatus', 'Settings saved (no API key)', 'success');
  }
}

async function saveUserInfo() {
  const data = {};

  // Map UI field id to storage key
  const userContextEl = document.getElementById('userContext');
  if (userContextEl) {
    data['aiApply_userContext'] = userContextEl.value;
  }

  await chrome.storage.sync.set(data);
  showStatus('userStatus', '✓ User info saved!', 'success');
}

async function refreshJobInfoFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Request job info from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobInfo' });

    if (response && response.jobInfo) {
      // Save to storage
      await chrome.storage.sync.set({ currentJobInfo: response.jobInfo });
      displayJobInfo(response.jobInfo);
    }
  } catch (e) {
    // Content script may not be loaded on this page
    console.log('Could not refresh job info:', e.message);
  }
}

function displayJobInfo(jobInfo) {
  if (!jobInfo || !jobInfo.title) {
    return;
  }

  document.getElementById('jobEmpty').style.display = 'none';
  document.getElementById('jobInfoContent').style.display = 'block';

  document.getElementById('jobTitle').textContent = jobInfo.title || '-';
  document.getElementById('jobCompany').textContent = jobInfo.company || '-';
  document.getElementById('jobDescription').textContent = jobInfo.description ?
    (jobInfo.description.substring(0, 800) + (jobInfo.description.length > 800 ? '...' : '')) : '-';
}

async function notifyContentScript(action, data = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action, ...data }).catch(() => {});
    }
  } catch (e) {
    console.error('Error notifying content script:', e);
  }
}

function showStatus(id, message, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = 'status ' + type;
  setTimeout(() => {
    el.className = 'status';
  }, 3000);
}
