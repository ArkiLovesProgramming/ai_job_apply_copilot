// AI Apply Copilot - Content Script

// Debug mode - set to false in production
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log('[AI Copilot]', ...args);
}

(function() {
  'use strict';

  debugLog('Script initialized');

  // Configuration
  const ATS_DOMAINS = [
    'greenhouse.io',
    'lever.co',
    'workday.com',
    'smartrecruiters.com',
    'jobvite.com',
    'taleo.net',
    'icims.com',
    'ashbyhq.com',
    'recruitee.com',
    'jazz.co',
    'hirevue.com',
    'breezyhr.com',
    'comeet.com',
    'hackerrank.com',
    'applytojob.com',
    'joblogic.com',
    'app.bamboohr.com',
    'hire.trabajando.com',
    'jobrx.io'
  ];

  // Open-ended question patterns that need AI (from reference)
  const AI_QUESTION_PATTERNS = [
    // Why company / motivation
    { pattern: /why\s*(do\s*)?you\s*want\s*(to\s*)?(work|join)/i },
    { pattern: /why\s*(are\s*)?you\s*(interested|applying)/i },
    { pattern: /what\s*attracts\s*you/i },
    { pattern: /why\s*this\s*(company|role|position|job)/i },
    { pattern: /what\s*excites\s*you\s*about/i },
    { pattern: /why\s*do\s*you\s*want\s*to\s*join/i },
    { pattern: /motivation/i },

    // About yourself
    { pattern: /tell\s*us\s*(about\s*)?(yourself|why)/i },
    { pattern: /describe\s*(yourself|your\s*background)/i },
    { pattern: /introduce\s*yourself/i },
    { pattern: /walk\s*(us|me)\s*through\s*your/i },
    { pattern: /tell\s*us\s*about\s*yourself/i },
    { pattern: /share\s*(something|a bit)\s*about/i },

    // Why hire you
    { pattern: /what\s*makes\s*you\s*(a\s*good|the\s*right|qualified)/i },
    { pattern: /why\s*should\s*we\s*(hire|choose)/i },
    { pattern: /what\s*(can|will)\s*you\s*bring/i },
    { pattern: /how\s*will\s*you\s*contribute/i },
    { pattern: /why\s*are\s*you\s*a\s*good\s*fit/i },

    // Strengths/weaknesses
    { pattern: /what\s*are\s*your\s*strengths/i },
    { pattern: /greatest\s*strength/i },
    { pattern: /what\s*are\s*your\s*weaknesses/i },
    { pattern: /area.*(improvement|develop)/i },

    // Career goals
    { pattern: /career\s*goals?/i },
    { pattern: /where\s*do\s*you\s*see\s*yourself/i },
    { pattern: /professional\s*goals?/i },
    { pattern: /long[-\s]term\s*aspirations/i },

    // Challenges/achievements
    { pattern: /(challenge|difficult|obstacle).*(overcome|faced|handled)/i },
    { pattern: /tell\s*(us|me)\s*about\s*a\s*time/i },
    { pattern: /describe\s*a\s*(situation|project|achievement)/i },
    { pattern: /proud(est)?\s*(accomplishment|achievement)/i },
    { pattern: /tell\s*us\s*about\s*a\s*success/i },

    // Additional info
    { pattern: /additional\s*(information|comments|notes)/i },
    { pattern: /anything\s*else/i },
    { pattern: /is\s*there\s*anything/i },

    // Cover letter
    { pattern: /cover\s*letter/i },
    { pattern: /letter\s*of\s*(motivation|interest)/i },

    // Generic
    { pattern: /experience/i },
    { pattern: /background/i },
    { pattern: /qualifications/i },
    { pattern: /essay/i },
    { pattern: /question/i },

    // Common job application questions
    { pattern: /referred/i },
    { pattern: /software\s*(programs|tools|technologies)/i },
    { pattern: /list\s*(any|all|the)/i },
    { pattern: /describe\s*your/i },
    { pattern: /please\s*(list|describe)/i },
    { pattern: /tell\s*us\s*more/i },
    { pattern: /elaborate/i },
    { pattern: /explain\s*(your|how)/i },
  ];

  // State
  let settings = {
    autoDetect: true,
    showButtons: true
  };
  let jobInfo = null;
  let processedInputs = new WeakSet();
  let mutationObserver = null;

  // Initialize
  async function init() {
    try {
      debugLog('Initializing on', window.location.href);
      // Load settings
      const data = await chrome.storage.sync.get(['autoDetect', 'showButtons', 'currentJobInfo']);
      settings.autoDetect = data.autoDetect !== false;
      settings.showButtons = data.showButtons !== false;
      jobInfo = data.currentJobInfo || null;

      debugLog('Settings loaded:', settings);

      // Check if current site is an ATS
      const isATS = isATSPage();
      debugLog('Is ATS:', isATS);

      if (settings.autoDetect) {
        // Always scan for open questions on any page
        scanAndProcessInputs();

        // Set up observer for dynamic content
        setupObserver();

        // Try to extract job info on ALL pages (not just ATS)
        // This allows extraction on company career pages too
        extractJobInfo();

        // Set up a delayed re-extraction for pages that load dynamically
        setTimeout(() => {
          extractJobInfo();
        }, 2000);
      }

      // Listen for messages from popup/background
      setupMessageListener();
      debugLog('Initialization complete');
    } catch(e) {
      console.error('[AI Copilot] Error in init:', e);
    }
  }

  function isATSPage() {
    const hostname = window.location.hostname.toLowerCase();
    return ATS_DOMAINS.some(domain => hostname.includes(domain));
  }

  function extractJobInfo() {
    // Try to extract job info from the page
    const info = {
      title: '',
      company: '',
      description: ''
    };

    // ===== HELPER: Check if text looks like a job title =====
    function looksLikeJobTitle(text) {
      if (!text || text.length < 3 || text.length > 150) return false;

      const lower = text.toLowerCase();

      // Exclude non-job headings (cookie banners, login screens, etc.)
      const excludedPatterns = [
        'cookie', 'consent', 'accept', 'reject', 'manage',
        'sign in', 'signin', 'login', 'log in', 'password',
        'verify', 'confirm', 'email', 'subscribe', 'newsletter',
        'notification', 'permission', 'settings', 'preferences',
        'error', '404', 'not found', 'access denied'
      ];

      for (const pattern of excludedPatterns) {
        if (lower.includes(pattern)) return false;
      }

      // Job title typically contains these keywords
      const jobKeywords = [
        'developer', 'engineer', 'manager', 'analyst', 'designer',
        'specialist', 'coordinator', 'administrator', 'consultant',
        'director', 'lead', 'senior', 'junior', 'associate',
        'intern', 'architect', 'technician', 'operator', 'assistant',
        'executive', 'officer', 'representative', 'agent', 'advisor',
        'strategist', 'producer', 'writer', 'editor', 'accountant',
        'attorney', 'lawyer', 'recruiter', 'hr ', 'human resources',
        'sales', 'marketing', 'support', 'service', 'project',
        'program', 'product', 'data', 'security', 'devops', 'sre',
        'frontend', 'backend', 'fullstack', 'full stack', 'software',
        'web', 'mobile', 'app', 'qa', 'test', 'ux', 'ui'
      ];

      // Check if contains job keywords OR looks like a typical job title pattern
      const hasJobKeyword = jobKeywords.some(kw => lower.includes(kw));

      // Also accept if it looks like a title (Capitalized Words pattern)
      const capitalizedPattern = /^([A-Z][a-z]+[\s\-]?)+$/;
      const looksLikeTitle = capitalizedPattern.test(text.trim());

      return hasJobKeyword || looksLikeTitle;
    }

    // ===== ENHANCED TITLE SELECTORS =====
    // Note: Put more specific selectors BEFORE generic 'h1'
    const titleSelectors = [
      // Platform-specific (most reliable)
      '[data-qa="job-title"]',
      '.job-header h1', '.job-header h2',
      '.job-details-header h1', '.job-title-header',
      '.job-details-module h1',
      // Greenhouse
      '.posting-headline h2', '.app-title', '#job-header h1',
      // Lever
      '.posting-title', '.job-header .title',
      // Workday
      '[data-automation-id="jobPostingHeader"] h1',
      // LinkedIn
      '.job-card-container h3',
      // Indeed
      '.jobsearch-JobInfoHeader-title', '.jobsearch-HeaderRow',
      // iCIMS
      '.job-title',
      // Taleo
      '.jobtitle', '.position-title',
      // Generic class selectors
      '.job-title', '.position-title', '.job-name',
      // Meta tags
      'meta[property="og:title"]',
      // Generic h1 (last resort, will be filtered)
      'h1',
      // Page title fallback
      'title'
    ];

    for (const sel of titleSelectors) {
      let el;
      if (sel.startsWith('meta')) {
        el = document.querySelector(sel);
        if (el) {
          const content = el.getAttribute('content') || el.getAttribute('name');
          if (content && content.length < 150 && !content.toLowerCase().includes('apply')) {
            info.title = content.trim();
            break;
          }
        }
      } else {
        el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          // For generic h1, require it to look like a job title
          if (sel === 'h1') {
            if (looksLikeJobTitle(text)) {
              info.title = text;
              break;
            }
          } else if (text && text.length < 150 && text.length > 3) {
            info.title = text;
            break;
          }
        }
      }
    }

    // Also try to extract from page title using regex patterns
    if (!info.title) {
      const pageTitle = document.title;
      // Pattern: "Software Engineer at Google - Greenhouse" or "Job Title | Company Name"
      const titleMatch = pageTitle.match(/^(.+?)(?:\s+[-@|]\s*|\s+at\s+)([A-Z][A-Za-z0-9\s&]+?)(?:\s*[-|]|$)/i);
      if (titleMatch && titleMatch[1]) {
        info.title = titleMatch[1].trim();
      }
    }

    // ===== ENHANCED COMPANY SELECTORS =====
    const companySelectors = [
      // Generic
      '.company-name', '.employer-name', '.company', '.employer',
      // Platform-specific
      '[data-qa="company-name"]', '.posting-categories .company',
      '.job-company', '[data-company]', '[itemprop="hiringOrganization"]',
      '.job-header .company', '.posting-headline .company',
      // Greenhouse
      '.company-card', '.company-name',
      // Lever
      '.company-name', '.employer-logo + div',
      // Workday
      '[data-automation-id="businessTitle"]',
      // SmartRecruiters
      '.company-name-header', '.employer-name',
      // LinkedIn
      '.job-details-company-name',
      // Meta tags
      'meta[property="og:site_name"]',
    ];

    for (const sel of companySelectors) {
      let el;
      if (sel.startsWith('meta')) {
        el = document.querySelector(sel);
        if (el) {
          const content = el.getAttribute('content');
          if (content && content.length < 60 && !content.toLowerCase().includes('linkedin') &&
              !content.toLowerCase().includes('indeed') && !content.toLowerCase().includes('greenhouse')) {
            info.company = content.trim();
            break;
          }
        }
      } else if (sel.startsWith('[itemprop')) {
        el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.length < 60) {
            info.company = text;
            break;
          }
        }
      } else {
        el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.length < 60 && !text.toLowerCase().includes('company')) {
            info.company = text;
            break;
          }
        }
      }
    }

    // Extract company from page title
    if (!info.company) {
      const pageTitle = document.title;
      const companyMatch = pageTitle.match(/(?:at|@|\|)\s*([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|]|$)/i);
      if (companyMatch && companyMatch[1] && companyMatch[1].length < 40) {
        const jobBoards = ['linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'monster', 'jobboard', 'greenhouse', 'lever', 'workday'];
        if (!jobBoards.some(jb => companyMatch[1].toLowerCase().includes(jb))) {
          info.company = companyMatch[1].trim();
        }
      }
    }

    // ===== ENHANCED DESCRIPTION SELECTORS =====
    const descSelectors = [
      // Generic
      '.job-description', '.description', '.job-details', '.posting-body',
      '#job-description', '.content-wrapper', '.job-detail',
      // Platform-specific
      '[data-qa="job-description"]', '.job-description-content',
      // Greenhouse
      '.posting-body', '.job-post', '#job-content',
      // Lever
      '.job-description', '.posting-content',
      // Workday
      '[data-automation-id="jobDescription"]', '.job-description-container',
      // SmartRecruiters
      '.job-description-text', '.jd-container',
      // LinkedIn
      '.job-details-module', '.job-view-controls',
      // Indeed
      '.jobsearch-jobDescriptionText', '#jobDescriptionText',
      // iCIMS
      '.job-description', '.ijijs',
      // Taleo
      '.job-description-content', '.tbd-body',
      // BambooHR
      '.bamboohr-job-description', '.bamboo-job-description',
      // Generic fallback - look for large text sections
      'section', 'main', 'article',
      // Fallback: look for elements with substantial text content
      '[class*="content"]', '[class*="body"]',
    ];

    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        let text = el.innerText.trim();

        // Filter out navigation/footer content
        const skipPatterns = [
          'cookie', 'privacy', 'terms', 'login', 'sign in',
          'navigation', 'menu', 'footer', 'header', 'copyright',
          'social media', 'follow us', 'linkedin', 'twitter', 'facebook'
        ];
        const lowerText = text.toLowerCase();
        const hasSkipPattern = skipPatterns.some(p => lowerText.includes(p) && lowerText.indexOf(p) < 100);

        // Skip if too short or contains skip patterns at the beginning
        if (text && text.length > 100 && !hasSkipPattern) {
          // For section/main/article, be more permissive with job description content
          // Many ATS systems use section elements for job posts
          if (sel === 'section' || sel === 'main' || sel === 'article') {
            // Check if it looks like a job posting (contains reasonable text length and not just nav)
            // Don't require specific keywords, just check it's substantial content
            if (text.length < 200) continue;
          }
          info.description = text;
          break;
        }
      }
    }

    // Try to find description in meta tag
    if (!info.description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content');
        if (content && content.length > 50) {
          info.description = content.trim();
        }
      }
    }

    // Only save if we have some info
    if (info.title || info.company || info.description) {
      debugLog('Extracted job info:', info);
      jobInfo = info;
      // Save to storage
      chrome.runtime.sendMessage({
        type: 'SAVE_JOB_INFO',
        jobInfo: info
      }).catch(() => {});
    }
  }

  // Check if we're on a job application page by looking for form-related elements
  function checkIfJobApplicationPage() {
    // Already checked ATS domains
    if (isATSPage()) return true;

    // Check for job application related URL patterns
    const urlPatterns = [
      /apply/i,
      /job/i,
      /career/i,
      /position/i,
      /requisition/i,
      /hiring/i
    ];
    const urlMatches = urlPatterns.some(p => p.test(window.location.href));
    if (!urlMatches) return false;

    // Check for common job application form indicators
    const formIndicators = [
      'form[action*="apply"]',
      'form[action*="submit"]',
      '[class*="application"]',
      '[class*="apply"]',
      '[class*="job-form"]',
      '[id*="application"]',
      '[id*="apply"]',
      '[data-qa*="apply"]',
      '[data-qa*="application"]'
    ];

    for (const selector of formIndicators) {
      if (document.querySelector(selector)) return true;
    }

    // Check for multiple textareas (job apps usually have several)
    const textareas = document.querySelectorAll('textarea');
    if (textareas.length >= 2) return true;

    return false;
  }

  // Check if input is likely in a job application context
  function isLikelyJobApplicationInput(input) {
    // Check if input is inside a form
    const form = input.closest('form');
    if (!form) return false;

    // Check form action for application keywords
    const formAction = form.getAttribute('action') || '';
    if (/apply|submit|job|career|application/i.test(formAction)) return true;

    // Check form class/id
    const formClass = form.className || '';
    const formId = form.id || '';
    if (/apply|job|career|application|application-form/i.test(formClass + ' ' + formId)) {
      return true;
    }

    return false;
  }

  function scanAndProcessInputs() {
    if (!settings.showButtons) return;

    // Check if we're on a job application page
    const isJobAppPage = checkIfJobApplicationPage();
    debugLog('Is job application page:', isJobAppPage);

    // Only process if on job application page or ATS page or we have job info
    if (!isJobAppPage && !isATSPage() && !jobInfo) {
      debugLog('Skipping - not a job application context');
      return;
    }

    // Find textareas - but be more selective about which ones to process
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      // Additional filter: check if textarea is likely in a job application context
      if (isJobAppPage || isATSPage() || isLikelyJobApplicationInput(textarea)) {
        processInput(textarea);
      }
    });

    // Find all visible text inputs with stricter filtering
    const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="date"]):not([type="email"]):not([type="password"]):not([type="tel"]):not([type="url"]):not([type="number"])');

    allInputs.forEach(input => {
      // For inputs without explicit type (text), check if it matches patterns
      if (isLikelyOpenQuestion(input)) {
        processInput(input);
      }
    });

    // Also check for contenteditable elements (some forms use these)
    const editableElements = document.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(el => {
      if (el.getAttribute('data-ai-copilot-processed')) return;
      el.setAttribute('data-ai-copilot-processed', 'true');

      // Check if it looks like an open question
      const label = getLabelForInput(el);
      const attrs = (el.getAttribute('aria-label') || '' + ' ' + label).toLowerCase();
      if (AI_QUESTION_PATTERNS.some(({ pattern }) => pattern.test(attrs))) {
        // Create a fake input wrapper for contenteditable
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-copilot-btn-wrapper';
        const btn = createAIFillButton(el, label);
        wrapper.appendChild(btn);
        el.parentNode.insertBefore(wrapper, el.nextSibling);
      }
    });

    // Log for debugging
    debugLog('Scanned:', textareas.length, 'textareas,', allInputs.length, 'text inputs');
  }

  function isLikelyOpenQuestion(input) {
    // Get label text first - this is the most reliable source
    const labelText = getLabelForInput(input).toLowerCase();

    // First, check direct attributes and label (most reliable)
    const directAttrs = [
      input.name || '',
      input.id || '',
      input.placeholder || '',
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-label') || '',
      input.getAttribute('data-question') || '',
      input.getAttribute('data-testid') || '',
      labelText
    ].join(' ').toLowerCase();

    // Check direct attributes first
    if (AI_QUESTION_PATTERNS.some(({ pattern }) => pattern.test(directAttrs))) {
      return true;
    }

    // Only check immediate parent (1 level up) for additional context
    // This avoids false positives from unrelated page content
    const parent = input.parentElement;
    if (parent) {
      // Get only the immediate parent's text content (not 4 levels up)
      // This is more targeted for questions like "Who referred you"
      const parentText = parent.textContent || '';

      // Also check the label element's text content specifically
      const labelEl = parent.querySelector('label');
      const labelElText = labelEl ? labelEl.textContent.trim().toLowerCase() : '';

      // Check parent text - but limit length to avoid false matches
      const parentAttrs = parentText.toLowerCase().slice(0, 200);
      if (AI_QUESTION_PATTERNS.some(({ pattern }) => pattern.test(parentAttrs))) {
        return true;
      }

      // Check label element specifically
      if (labelElText && AI_QUESTION_PATTERNS.some(({ pattern }) => pattern.test(labelElText))) {
        return true;
      }
    }

    // Debug log for non-matching inputs that might be interesting
    if (input.tagName === 'INPUT') {
      debugLog('Input not matching:', directAttrs.slice(0, 150));
    }

    return false;
  }

  function processInput(input) {
    // Skip if already processed
    if (processedInputs.has(input)) return;

    // Get question/label text first to decide if we should process
    const labelText = getLabelForInput(input);

    debugLog('Processing input:', input.tagName, 'label:', labelText.slice(0, 50), 'maxLength:', input.maxLength);

    // For text inputs, check if it's likely an open question
    if (input.tagName === 'INPUT') {
      // Skip very short inputs (< 50 chars)
      if (input.maxLength > 0 && input.maxLength < 50) {
        debugLog('Skipping - maxLength too short:', input.maxLength);
        return;
      }

      const isCustomField = input.name && input.name.includes('customQuestionAnswers');
      const matchesPattern = isLikelyOpenQuestion(input);
      const isShortInput = input.maxLength > 0 && input.maxLength < 100;

      // Short inputs (50-99): must match patterns
      // Long/unlimited inputs: match patterns OR be custom field
      if ((isShortInput && !matchesPattern) || (!isShortInput && !matchesPattern && !isCustomField)) {
        debugLog('Skipping - not matching patterns');
        return;
      }
    }

    processedInputs.add(input);

    // Create AI Fill button
    const wrapper = createButtonWrapper(input);
    const btn = createAIFillButton(input, labelText);

    wrapper.appendChild(btn);
    insertButtonWrapper(input, wrapper);
  }

  function getLabelForInput(input) {
    // Try label element
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Try parent label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const labelText = parentLabel.textContent.replace(input.textContent, '').trim();
      if (labelText) return labelText;
    }

    // Try MUI/Fabric UI label patterns - look for elements with label-related classes
    const parent = input.parentElement;
    if (parent) {
      // Check parent and grandparents for MUI/Fabric label elements
      const labelSelectors = [
        '.MuiFormLabel-root',
        '.MuiInputLabel-root',
        '.fabric-label',
        '[class*="labelLabel"]',
        '[class*="Label-root"]',
        'label'
      ];

      for (const selector of labelSelectors) {
        const labelEl = parent.querySelector(selector) || parent.parentElement?.querySelector(selector);
        if (labelEl) {
          const text = labelEl.textContent.trim();
          if (text && text.length < 200) return text;
        }
      }

      // Also try finding text in the form control container
      const formControl = parent.closest('[class*="FormControl"]');
      if (formControl) {
        const labelInControl = formControl.querySelector('[class*="label"], label, span');
        if (labelInControl) {
          const text = labelInControl.textContent.trim();
          if (text && text.length < 200) return text;
        }
      }
    }

    // Try parent element for any label-like text
    if (parent) {
      // Look for label, span, p, div with text content before input
      const prevElements = parent.querySelectorAll('label, span, p, div, strong, b');
      for (const el of prevElements) {
        const text = el.textContent.trim();
        if (text && text.length < 200 && !el.querySelector('input, textarea')) {
          return text;
        }
      }
    }

    // Try preceding sibling elements
    let sibling = input.previousElementSibling;
    while (sibling) {
      const text = sibling.textContent.trim();
      if (text && text.length < 200) {
        return text;
      }
      sibling = sibling.previousElementSibling;
    }

    // Try aria-label
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label');
    }

    // Try data-label
    if (input.getAttribute('data-label')) {
      return input.getAttribute('data-label');
    }

    // Try data-testid
    if (input.getAttribute('data-testid')) {
      return input.getAttribute('data-testid').replace(/([A-Z])/g, ' $1').trim();
    }

    // Try name attribute
    if (input.name) {
      return input.name.replace(/[_]/g, ' ');
    }

    return '';
  }

  function createButtonWrapper(input) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-copilot-btn-wrapper';
    return wrapper;
  }

  function insertButtonWrapper(input, wrapper) {
    // Apply styling directly to wrapper
    wrapper.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      margin-left: 8px !important;
      margin-right: 8px !important;
      vertical-align: middle !important;
      position: relative !important;
      z-index: 10000 !important;
    `;

    const parent = input.parentNode;
    if (!parent) return;

    // Check parent's display style to handle flex/grid properly
    const parentStyle = window.getComputedStyle(parent);
    const isFlexOrGrid = parentStyle.display.includes('flex') || parentStyle.display.includes('grid');

    if (isFlexOrGrid) {
      // For flex/grid parents, try to insert after the input
      if (input.nextSibling) {
        parent.insertBefore(wrapper, input.nextSibling);
      } else {
        parent.appendChild(wrapper);
      }
      // Add flex-shrink: 0 to prevent button from being compressed
      wrapper.style.flexShrink = '0';
    } else {
      // For block/inline parents, insert as sibling
      if (input.nextSibling) {
        parent.insertBefore(wrapper, input.nextSibling);
      } else {
        parent.appendChild(wrapper);
      }
    }

    debugLog('Button inserted, parent display:', parentStyle.display);
  }

  function createAIFillButton(input, labelText) {
    const btn = document.createElement('button');
    btn.className = 'ai-copilot-fill-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    `;
    btn.title = 'Fill with AI';

    // Check if input has content and disable button if so
    const hasContent = input.value && input.value.trim().length > 0;
    if (hasContent) {
      btn.disabled = true;
      btn.title = 'Already filled';
    }

    // Listen for input changes to enable/disable button
    const updateButtonState = () => {
      const value = input.value || '';
      if (value.trim().length > 0) {
        btn.disabled = true;
        btn.title = 'Already filled';
      } else {
        btn.disabled = false;
        btn.title = 'Fill with AI';
      }
    };

    input.addEventListener('input', updateButtonState);
    input.addEventListener('change', updateButtonState);

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.disabled) return;

      const question = labelText || input.placeholder || 'Open-ended question';
      await fillWithAI(input, question);
    });

    return btn;
  }

  async function fillWithAI(input, question) {
    // Get user settings
    const data = await chrome.storage.sync.get([
      'aiBaseURL',
      'aiModel',
      'apiKey',
      'aiApply_userContext'
    ]);

    const baseURL = data.aiBaseURL || 'https://api.openai.com/v1';
    const model = data.aiModel || 'gpt-4o-mini';
    const userContext = data.aiApply_userContext || '';

    if (!data.apiKey) {
      showToast('Please configure your API key in the extension popup.');
      return;
    }

    // Get the button to show loading state
    const btn = input.closest('.ai-copilot-input-container, .ai-copilot-btn-wrapper')
      ?.querySelector('.ai-copilot-fill-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="ai-copilot-spinner"></span> Loading...';
    }

    try {
      // Build prompt - 全部放在 user message 中
      let prompt = `你是专业的职业顾问，帮助求职者回答求职申请中的开放性问题。
- 使用第一人称，专业但亲切的语气
- 回答简洁（2-4句话）
- 结合个人背景中的具体例子
- 突出可量化的成就和成果
- 根据问题复杂度调整回答长度

`;

      // 岗位相关信息
      if (jobInfo && jobInfo.title) {
        prompt += `岗位相关信息：\n`;
        prompt += `职位：${jobInfo.title}`;
        if (jobInfo.company) {
          prompt += ` at ${jobInfo.company}`;
        }
        prompt += '\n';

        // Job description (truncated)
        const MAX_DESC_LENGTH = 5000;
        if (jobInfo.description) {
          const truncatedDesc = jobInfo.description.substring(0, MAX_DESC_LENGTH);
          prompt += `职位描述：${truncatedDesc}\n`;
        }
        prompt += '\n';
      }

      // 申请人个人信息
      const MAX_USER_CONTEXT_LENGTH = 5000;
      if (userContext) {
        let truncatedUserContext = userContext;
        if (userContext.length > MAX_USER_CONTEXT_LENGTH) {
          truncatedUserContext = userContext.substring(0, MAX_USER_CONTEXT_LENGTH) + '...';
        }
        prompt += `申请人个人信息：\n${truncatedUserContext}\n\n`;
      }

      // 问题
      prompt += `请回答以下问题（2-4句话，直接回答，无需前言）：\n${question}`;

      // 只需要 user message，不需要 system message
      const messages = [
        { role: 'user', content: prompt }
      ];

      // Call API via background script
      const response = await chrome.runtime.sendMessage({
        type: 'AI_COMPLETION',
        payload: {
          baseURL,
          model,
          messages
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // Clean AI response -通用后备方案，适用于所有 LLM
      let cleanAnswer = response.data;

      // 移除思考部分并打印调试信息
      const reasoningMatch = cleanAnswer.match(/<\|start_header_id\|>reasoning<\|end_header_id\|>([\s\S]*?)<\|end_of_turn\|>/i);
      if (reasoningMatch) {
        debugLog('Thinking:', reasoningMatch[1].trim());
        cleanAnswer = cleanAnswer.replace(/<\|start_header_id\|>reasoning<\|end_header_id\|>[\s\S]*?<\|end_of_turn\|>/i, '');
      }

      // 移除所有剩余标签
      cleanAnswer = cleanAnswer.replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/gi, '')
                              .replace(/<\|end_of_turn\|>/gi, '').trim();

      debugLog('Answer:', cleanAnswer);

      // Fill the input with clean content only
      setInputValue(input, cleanAnswer);

      // Show success
      if (btn) {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        `;
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          `;
        }, 2000);
      }
    } catch (error) {
      console.error('AI Fill error:', error);
      showToast('Error: ' + error.message);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        `;
      }
    }
  }

  function setInputValue(input, value) {
    // Use native setter for React compatibility
    const proto = input.tagName === 'TEXTAREA' ?
      HTMLTextAreaElement.prototype :
      HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch events for React and other frameworks
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    // React 16+ compatibility
    if (input._valueTracker) {
      input._valueTracker.setValue('');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function setupObserver() {
    // Scan multiple times with increasing delays for React apps
    const delayedScans = [100, 500, 1000, 2000, 3000];
    delayedScans.forEach(delay => {
      setTimeout(() => {
        scanAndProcessInputs();
      }, delay);
    });

    // Set up mutation observer for dynamic content
    mutationObserver = new MutationObserver((mutations) => {
      let shouldScan = false;

      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
        }
      });

      if (shouldScan) {
        // Debounce scanning
        clearTimeout(window._aiCopilotScanTimeout);
        window._aiCopilotScanTimeout = setTimeout(() => {
          scanAndProcessInputs();
        }, 500);
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup on page unload
    window.addEventListener('unload', () => {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
    });
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'showButtons') {
        settings.showButtons = true;
        scanAndProcessInputs();
      } else if (message.action === 'hideButtons') {
        settings.showButtons = false;
        document.querySelectorAll('.ai-copilot-fill-btn').forEach(btn => {
          btn.style.display = 'none';
        });
      } else if (message.action === 'refresh' || message.action === 'rescan') {
        // Manual rescan trigger
        scanAndProcessInputs();
        // Also re-extract job info
        extractJobInfo();
      } else if (message.action === 'updateSettings') {
        if (message.settings.autoDetect !== undefined) {
          settings.autoDetect = message.settings.autoDetect;
        }
      } else if (message.action === 'getJobInfo') {
        // Extract fresh job info and return
        extractJobInfo();
        sendResponse({ jobInfo: jobInfo });
        return true;
      }
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'ai-copilot-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also try on load in case DOM was already complete
  window.addEventListener('load', () => {
    setTimeout(() => {
      debugLog('Load event fired');
      init();
    }, 1000);
  });
})();
