// AI Apply Copilot - Background Service Worker

// Set default values on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    autoDetect: true,
    showButtons: true
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle AI completion request
  if (request.type === 'AI_COMPLETION') {
    handleAICompletion(request.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  // Handle job info storage request
  if (request.type === 'SAVE_JOB_INFO') {
    chrome.storage.sync.set({ currentJobInfo: request.jobInfo });
    sendResponse({ success: true });
    return true;
  }

  return true;
});

async function handleAICompletion(payload) {
  const { baseURL, model, messages } = payload;

  // Get API key from storage
  const data = await chrome.storage.sync.get(['apiKey']);
  const apiKey = data.apiKey;

  if (!apiKey) {
    throw new Error('API key not configured. Please set it in the extension popup.');
  }

  // Avoid duplicate /v1 in URL - remove trailing /v1 if present
  const cleanBaseURL = baseURL.replace(/\/v1$/, '');
  const response = await fetch(`${cleanBaseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
      reasoning_split: true
    })
  });

  if (!response.ok) {
    let errorMessage = 'API Error';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || JSON.stringify(error);
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();

  // Extract the content from the response
  if (result.choices && result.choices[0]) {
    const message = result.choices[0].message;

    // If reasoning_split is true, content is separate from reasoning
    if (message.content) {
      return message.content;
    }

    // Fallback: if content is empty but reasoning exists, return reasoning
    if (message.reasoning_details && message.reasoning_details[0]) {
      return message.reasoning_details[0].text || '';
    }

    return '';
  }

  throw new Error('Invalid API response format');
}
