// AgentTrail - Client-side JavaScript

const state = {
  sessions: [],
  directories: [],
  projects: [],
  tags: {},
  currentSession: null,
  filters: {
    time: 'all',
    tag: null,
    directory: null,
    project: null,
    search: ''
  },
  searchMode: 'quick',
  eventSource: null
};

// Initialize
async function init() {
  await Promise.all([
    loadSessions(),
    loadDirectories(),
    loadProjects(),
    loadTags(),
    loadConfig()
  ]);
  setupEventListeners();
  handleRoute();
}

// API calls
async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    state.sessions = data.sessions;
    renderSessionList();
    updateFilterCounts();
  } catch (error) {
    console.error('Failed to load sessions:', error);
    document.getElementById('session-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#x26A0;</div>
        <div class="empty-state-title">Failed to load sessions</div>
      </div>
    `;
  }
}

async function loadDirectories() {
  try {
    const res = await fetch('/api/directories');
    const data = await res.json();
    state.directories = data.directories;
    renderDirectoryList();
  } catch (error) {
    console.error('Failed to load directories:', error);
  }
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    state.projects = data.projects;
    renderProjectList();
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}

async function loadTags() {
  try {
    const res = await fetch('/api/tags');
    const data = await res.json();
    state.tags = data.tags;
    renderTagList();
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    document.getElementById('config-path').textContent = data.configPath;
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// Rendering
function renderSessionList() {
  const container = document.getElementById('session-list');
  const filtered = getFilteredSessions();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#x1F4AC;</div>
        <div class="empty-state-title">No sessions found</div>
        <div class="empty-state-text">Try adjusting your filters</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(session => renderSessionCard(session)).join('');
}

function renderSessionCard(session) {
  const pinnedClass = session.isPinned ? 'pinned' : '';
  const awaitingClass = session.status === 'awaiting' ? 'awaiting' : '';
  const pinBadge = session.isPinned ? '<span class="pin-badge">&#x1F4CC;</span>' : '';

  return `
    <div class="session-card ${pinnedClass} ${awaitingClass}" data-id="${session.id}" onclick="showSession('${session.id}')">
      <div class="session-title">${escapeHtml(session.title)}${pinBadge}</div>
      <div class="session-meta">
        <span class="session-directory" style="background: ${session.directoryColor}20; color: ${session.directoryColor}">
          <span class="directory-color" style="background: ${session.directoryColor}"></span>
          ${escapeHtml(session.directoryLabel)}
        </span>
        <span class="session-dot"></span>
        <span>${escapeHtml(session.projectName)}</span>
        <span class="session-dot"></span>
        <span>${formatRelativeTime(session.lastModified)}</span>
        ${renderStatusIndicator(session.status)}
      </div>
      <div class="session-tags">
        ${session.tags.map(tag => `<span class="tag tag-${tag}">${tag}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderStatusIndicator(status) {
  if (status === 'idle') return '';
  const labels = { awaiting: 'Needs input', working: 'Working...' };
  return `
    <span class="session-dot"></span>
    <span class="live-indicator ${status}">
      <span class="live-dot"></span>
      ${labels[status]}
    </span>
  `;
}

function renderDirectoryList() {
  const container = document.getElementById('directory-list');
  container.innerHTML = state.directories.map(dir => `
    <div class="directory-item ${state.filters.directory === dir.path ? 'active' : ''}"
         data-path="${escapeHtml(dir.path)}" onclick="filterByDirectory('${escapeHtml(dir.path)}')">
      <span class="directory-color" style="background: ${dir.color}"></span>
      <span class="directory-label">${escapeHtml(dir.label)}</span>
      <span class="filter-count">${dir.count}</span>
    </div>
  `).join('');
}

function renderProjectList() {
  const container = document.getElementById('project-list');
  container.innerHTML = state.projects.map(project => `
    <div class="project-item ${state.filters.project === project.path ? 'active' : ''}"
         onclick="filterByProject('${escapeHtml(project.path)}')">
      <span class="project-icon">&#x1F4C1;</span>
      <span class="project-name">${escapeHtml(project.name)}</span>
      <span class="filter-count">${project.count}</span>
    </div>
  `).join('');
}

function renderTagList() {
  const container = document.getElementById('tag-list');
  container.innerHTML = Object.entries(state.tags)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `
      <span class="tag tag-${tag} ${state.filters.tag === tag ? 'active' : ''}"
            onclick="filterByTag('${tag}')">${tag} (${count})</span>
    `).join('');
}

// Filtering
function getFilteredSessions() {
  return state.sessions.filter(session => {
    if (state.filters.time !== 'all') {
      const sessionDate = new Date(session.lastModified);
      const now = new Date();
      if (state.filters.time === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (sessionDate < today) return false;
      } else if (state.filters.time === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (sessionDate < weekAgo) return false;
      }
    }
    if (state.filters.tag && !session.tags.includes(state.filters.tag)) return false;
    if (state.filters.directory && session.directory !== state.filters.directory) return false;
    if (state.filters.project && session.project !== state.filters.project) return false;
    if (state.filters.search) {
      const search = state.filters.search.toLowerCase();
      const matchesTitle = session.title.toLowerCase().includes(search);
      const matchesProject = session.projectName.toLowerCase().includes(search);
      const matchesTags = session.tags.some(t => t.toLowerCase().includes(search));
      if (!matchesTitle && !matchesProject && !matchesTags) return false;
    }
    return true;
  });
}

function updateFilterCounts() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  document.getElementById('count-all').textContent = state.sessions.length;
  document.getElementById('count-today').textContent = state.sessions.filter(s =>
    new Date(s.lastModified) >= today
  ).length;
  document.getElementById('count-week').textContent = state.sessions.filter(s =>
    new Date(s.lastModified) >= weekAgo
  ).length;
}

function filterByTime(filter) {
  state.filters.time = filter;
  document.querySelectorAll('#time-filters .filter-item').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === filter);
  });
  if (state.currentSession) returnToList();
  renderSessionList();
}

function filterByTag(tag) {
  state.filters.tag = state.filters.tag === tag ? null : tag;
  renderTagList();
  if (state.currentSession) returnToList();
  renderSessionList();
}

function filterByDirectory(path) {
  state.filters.directory = state.filters.directory === path ? null : path;
  renderDirectoryList();
  if (state.currentSession) returnToList();
  renderSessionList();
}

function filterByProject(path) {
  state.filters.project = state.filters.project === path ? null : path;
  renderProjectList();
  if (state.currentSession) returnToList();
  renderSessionList();
}

// Session detail
async function showSession(sessionId) {
  history.pushState(null, '', `/session/${sessionId}`);
  await navigateToSession(sessionId);
}

async function navigateToSession(sessionId) {
  if (state.currentSession && state.currentSession.id === sessionId) return;

  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading...</div>';

  document.getElementById('list-view').classList.add('hidden');
  document.getElementById('detail-view').classList.add('active');

  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      showSessionNotFound(sessionId);
      return;
    }
    const data = await res.json();
    state.currentSession = data.session;
    renderSessionDetail(data.session);
    startEventStream(sessionId);
  } catch (error) {
    console.error('Failed to load session:', error);
    showSessionNotFound(sessionId);
  }
}

function renderSessionDetail(session) {
  document.getElementById('detail-title').textContent = session.title;

  const pinBtn = document.getElementById('pin-button');
  pinBtn.classList.toggle('pinned', session.isPinned);

  const metaHtml = `
    <span style="color: ${session.directoryColor}">${escapeHtml(session.directoryLabel)}</span>
    <span>&#x2022;</span>
    <span>${escapeHtml(session.projectName)}</span>
    <span>&#x2022;</span>
    <span>${formatDate(session.timestamp)}</span>
    <span>&#x2022;</span>
    <span>${session.messages.length} messages</span>
  `;
  document.getElementById('detail-meta').innerHTML = metaHtml;

  // Render tags section in the banner area
  document.getElementById('detail-banner').innerHTML = renderTagsSection(session);

  renderMessages(session.messages);
}

function renderMessages(messages) {
  const container = document.getElementById('messages');

  const html = messages
    .filter(msg => hasDisplayableContent(msg.content))
    .map(msg => {
      const isUser = msg.type === 'user';
      const label = isUser ? 'You' : 'Claude';
      const contentHtml = renderMessageContent(msg.content);
      if (!contentHtml.trim()) return '';

      return `
        <div class="message message-${msg.type}">
          <div class="message-label">${label}</div>
          <div class="message-content">${contentHtml}</div>
        </div>
      `;
    })
    .filter(h => h.trim())
    .join('');

  container.innerHTML = html;
  setupToolCardListeners();
  applyHighlighting(container);
  container.scrollTop = container.scrollHeight;
}

function hasDisplayableContent(content) {
  if (!Array.isArray(content)) return content && String(content).trim().length > 0;
  return content.some(block => {
    if (block.type === 'text') return block.text && block.text.trim().length > 0;
    if (block.type === 'tool_use') return true;
    if (block.type === 'thinking') return block.thinking && block.thinking.trim().length > 0;
    return false;
  });
}

function renderMessageContent(content) {
  if (!Array.isArray(content)) {
    return `<div class="message-text">${escapeHtml(String(content))}</div>`;
  }

  return content.map(block => {
    switch (block.type) {
      case 'text':
        if (!block.text || !block.text.trim()) return '';
        return `<div class="message-text">${formatText(block.text)}</div>`;
      case 'tool_use':
        return renderToolUse(block);
      case 'thinking':
        if (!block.thinking || !block.thinking.trim()) return '';
        return `
          <div class="thinking-block" onclick="this.classList.toggle('expanded')">
            <div class="thinking-header">&#x1F4AD; View thinking</div>
            <div class="thinking-content">${escapeHtml(block.thinking)}</div>
          </div>
        `;
      default:
        return '';
    }
  }).join('');
}

function renderToolUse(block) {
  const toolName = block.name || 'Unknown';
  const toolClass = `tool-${toolName.toLowerCase()}`;
  const icon = getToolIcon(toolName);

  let path = '';
  let content = '';

  if (block.input) {
    if (block.input.file_path) path = block.input.file_path;
    else if (block.input.command) path = block.input.command;
    else if (block.input.pattern) path = block.input.pattern;

    if (toolName === 'Edit' && block.input.old_string && block.input.new_string) {
      content = renderDiff(block.input.old_string, block.input.new_string);
    } else if (toolName === 'Write' && block.input.content) {
      content = renderCodeBlock(block.input.content);
    } else if (toolName === 'Bash' && block.input.command) {
      content = `<div class="bash-content"><code>${escapeHtml(block.input.command)}</code></div>`;
    }
  }

  return `
    <div class="tool-card ${toolClass} ${content ? '' : 'collapsed'}">
      <div class="tool-header">
        <div class="tool-icon">${icon}</div>
        <span class="tool-name">${toolName}</span>
        <span class="tool-path">${escapeHtml(path)}</span>
        ${content ? '<span class="tool-toggle">&#x25BC;</span>' : ''}
      </div>
      ${content ? `<div class="tool-body">${content}</div>` : ''}
    </div>
  `;
}

function renderDiff(oldStr, newStr) {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  let html = '<div class="code-block">';
  oldLines.forEach((line, i) => {
    html += `<div class="code-line diff-remove"><span class="line-number">${i + 1}</span><span class="line-content">${escapeHtml(line)}</span></div>`;
  });
  newLines.forEach((line, i) => {
    html += `<div class="code-line diff-add"><span class="line-number">${i + 1}</span><span class="line-content">${escapeHtml(line)}</span></div>`;
  });
  html += '</div>';
  return html;
}

function renderCodeBlock(code, language = '') {
  const lines = code.split('\n');
  let html = '<div class="code-block">';
  lines.forEach((line, i) => {
    html += `<div class="code-line"><span class="line-number">${i + 1}</span><span class="line-content">${escapeHtml(line) || ' '}</span></div>`;
  });
  html += '</div>';
  return html;
}

function getToolIcon(toolName) {
  const icons = {
    'Read': '&#x1F4C4;',
    'Edit': '&#x270F;',
    'Write': '&#x1F4DD;',
    'Bash': '$',
    'Glob': '&#x1F50D;',
    'Grep': '&#x1F50E;',
    'Task': '&#x1F916;'
  };
  return icons[toolName] || '&#x1F527;';
}

function formatText(text) {
  if (typeof marked !== 'undefined') {
    try {
      return `<div class="markdown-content">${marked.parse(text)}</div>`;
    } catch (e) {
      console.error('Markdown parse error:', e);
    }
  }
  return `<p>${escapeHtml(text)}</p>`;
}

function applyHighlighting(container) {
  if (typeof hljs === 'undefined') return;
  container.querySelectorAll('pre code:not(.hljs)').forEach(block => {
    hljs.highlightElement(block);
  });
}

function setupToolCardListeners() {
  document.querySelectorAll('.tool-header').forEach(header => {
    header.addEventListener('click', e => {
      e.stopPropagation();
      header.parentElement.classList.toggle('collapsed');
    });
  });
}

// Event stream
function startEventStream(sessionId) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  state.eventSource = new EventSource(`/api/sessions/${sessionId}/events`);

  state.eventSource.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (state.currentSession) {
      state.currentSession.messages.push(message);
      appendMessage(message);
    }
  });

  state.eventSource.addEventListener('status', event => {
    const { status } = JSON.parse(event.data);
    if (state.currentSession) {
      state.currentSession.status = status;
    }
  });
}

function appendMessage(message) {
  if (!hasDisplayableContent(message.content)) return;

  const container = document.getElementById('messages');
  const isUser = message.type === 'user';
  const label = isUser ? 'You' : 'Claude';
  const contentHtml = renderMessageContent(message.content);
  if (!contentHtml.trim()) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `message message-${message.type}`;
  msgDiv.innerHTML = `
    <div class="message-label">${label}</div>
    <div class="message-content">${contentHtml}</div>
  `;

  container.appendChild(msgDiv);
  setupToolCardListeners();
  applyHighlighting(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// Navigation
function returnToList() {
  history.pushState(null, '', '/');
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  state.currentSession = null;
  document.getElementById('list-view').classList.remove('hidden');
  document.getElementById('detail-view').classList.remove('active');
}

async function showList() {
  returnToList();
  await loadSessions();
}

function handleRoute() {
  const path = window.location.pathname;
  if (path.startsWith('/session/')) {
    const sessionId = path.slice('/session/'.length);
    if (sessionId) navigateToSession(sessionId);
  }
}

function showSessionNotFound(sessionId) {
  document.getElementById('messages').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">&#x26A0;</div>
      <div class="empty-state-title">Session not found</div>
      <div class="empty-state-text">The session "${escapeHtml(sessionId)}" could not be found.</div>
    </div>
  `;
  document.getElementById('detail-title').textContent = 'Session not found';
  document.getElementById('detail-meta').innerHTML = '';
}

// Pin functionality
async function togglePin() {
  if (!state.currentSession) return;

  const isPinned = state.currentSession.isPinned;
  const sessionId = state.currentSession.id;

  try {
    if (isPinned) {
      await fetch(`/api/pins/${sessionId}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/pins/${sessionId}`, { method: 'POST' });
    }
    state.currentSession.isPinned = !isPinned;
    document.getElementById('pin-button').classList.toggle('pinned', !isPinned);
  } catch (error) {
    console.error('Failed to toggle pin:', error);
  }
}

// Search
function toggleSearchMode() {
  state.searchMode = state.searchMode === 'quick' ? 'deep' : 'quick';
  const btn = document.getElementById('search-mode-btn');
  btn.classList.toggle('active', state.searchMode === 'deep');
  document.getElementById('search-mode-label').textContent = state.searchMode === 'quick' ? 'Quick' : 'Deep';

  if (state.filters.search) {
    performSearch(state.filters.search);
  }
}

async function performSearch(query) {
  if (!query) {
    state.filters.search = '';
    renderSessionList();
    return;
  }

  if (state.searchMode === 'deep') {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=deep`);
      const data = await res.json();
      state.sessions = data.results;
      state.filters.search = query;
      renderSessionList();
    } catch (error) {
      console.error('Search failed:', error);
    }
  } else {
    state.filters.search = query;
    renderSessionList();
  }
}

// Settings modal
function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
  renderSettingsDirectories();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function renderSettingsDirectories() {
  const container = document.getElementById('settings-directories');
  const dirs = state.directories;

  if (dirs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted)">No directories configured.</p>';
    return;
  }

  container.innerHTML = dirs.map(dir => `
    <div class="settings-directory-item" data-path="${escapeHtml(dir.path)}">
      <div class="settings-directory-color" style="background: ${dir.color}"></div>
      <div class="settings-directory-info">
        <div class="settings-directory-label">${escapeHtml(dir.label)}</div>
        <div class="settings-directory-path">${escapeHtml(dir.path)}</div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${dir.enabled !== false ? 'checked' : ''} onchange="toggleDirectoryEnabled('${escapeHtml(dir.path)}', this.checked)">
        <span class="slider"></span>
      </label>
      <div class="settings-directory-actions">
        <button class="btn-icon" onclick="editDirectory('${escapeHtml(dir.path)}')" title="Edit">&#x270F;</button>
        <button class="btn-icon btn-danger" onclick="deleteDirectory('${escapeHtml(dir.path)}')" title="Delete">&#x1F5D1;</button>
      </div>
    </div>
  `).join('');
}

function showAddDirectoryForm() {
  const container = document.getElementById('settings-directories');
  const existingForm = document.getElementById('add-directory-form');
  if (existingForm) {
    existingForm.remove();
    return;
  }

  const formHtml = `
    <div class="add-directory-form" id="add-directory-form">
      <input type="text" id="new-dir-path" placeholder="Directory path (e.g., ~/.claude)" class="input">
      <input type="text" id="new-dir-label" placeholder="Label (e.g., Work)" class="input">
      <input type="color" id="new-dir-color" value="#10b981" class="input-color">
      <div class="form-actions">
        <button class="btn btn-primary" onclick="submitAddDirectory()">Add</button>
        <button class="btn btn-secondary" onclick="cancelAddDirectory()">Cancel</button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', formHtml);
  document.getElementById('new-dir-path').focus();
}

function cancelAddDirectory() {
  const form = document.getElementById('add-directory-form');
  if (form) form.remove();
}

async function submitAddDirectory() {
  const pathInput = document.getElementById('new-dir-path');
  const labelInput = document.getElementById('new-dir-label');
  const colorInput = document.getElementById('new-dir-color');

  const path = pathInput.value.trim();
  const label = labelInput.value.trim() || path.split('/').pop();
  const color = colorInput.value;

  if (!path) {
    showNotification('Please enter a directory path', 'error');
    return;
  }

  try {
    const res = await fetch('/api/directories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, label, color, enabled: true })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to add directory');
    }

    cancelAddDirectory();
    await loadDirectories();
    await loadSessions();
    renderSettingsDirectories();
    renderDirectoryList();
    showNotification('Directory added successfully', 'success');
  } catch (error) {
    showNotification('Failed to add directory: ' + error.message, 'error');
  }
}

async function toggleDirectoryEnabled(path, enabled) {
  try {
    const res = await fetch(`/api/directories/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });

    if (!res.ok) throw new Error('Failed to update directory');

    await loadDirectories();
    await loadSessions();
    renderDirectoryList();
    renderSessionList();
    showNotification(enabled ? 'Directory enabled' : 'Directory disabled', 'success');
  } catch (error) {
    showNotification('Failed to update: ' + error.message, 'error');
  }
}

function editDirectory(path) {
  const dir = state.directories.find(d => d.path === path);
  if (!dir) return;

  const existingModal = document.getElementById('edit-directory-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.id = 'edit-directory-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeEditDirectory()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Directory</h2>
        <button class="modal-close" onclick="closeEditDirectory()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Path</label>
          <input type="text" id="edit-dir-path" value="${escapeHtml(dir.path)}" class="input" readonly style="opacity: 0.6">
        </div>
        <div class="form-group">
          <label>Label</label>
          <input type="text" id="edit-dir-label" value="${escapeHtml(dir.label)}" class="input">
        </div>
        <div class="form-group">
          <label>Color</label>
          <input type="color" id="edit-dir-color" value="${dir.color}" class="input-color">
        </div>
        <div class="form-actions" style="margin-top: 16px;">
          <button class="btn btn-primary" onclick="submitEditDirectory('${escapeHtml(path)}')">Save</button>
          <button class="btn btn-secondary" onclick="closeEditDirectory()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeEditDirectory() {
  const modal = document.getElementById('edit-directory-modal');
  if (modal) modal.remove();
}

async function submitEditDirectory(originalPath) {
  const label = document.getElementById('edit-dir-label').value.trim();
  const color = document.getElementById('edit-dir-color').value;

  if (!label) {
    showNotification('Label cannot be empty', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/directories/${encodeURIComponent(originalPath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, color })
    });

    if (!res.ok) throw new Error('Failed to update directory');

    closeEditDirectory();
    await loadDirectories();
    await loadSessions();
    renderSettingsDirectories();
    renderDirectoryList();
    renderSessionList();
    showNotification('Directory updated', 'success');
  } catch (error) {
    showNotification('Failed to update: ' + error.message, 'error');
  }
}

async function deleteDirectory(path) {
  const dir = state.directories.find(d => d.path === path);
  if (!confirm(`Delete directory "${dir?.label || path}"? Sessions won't be deleted, just hidden.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/directories/${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete directory');

    await loadDirectories();
    await loadSessions();
    renderSettingsDirectories();
    renderDirectoryList();
    renderSessionList();
    showNotification('Directory removed', 'success');
  } catch (error) {
    showNotification('Failed to delete: ' + error.message, 'error');
  }
}

// Custom Tags UI
function renderTagsSection(session) {
  const autoTagsList = ['debugging', 'feature', 'refactoring', 'git', 'testing', 'docs', 'config', 'api', 'ui'];
  const customTags = session.tags.filter(t => !autoTagsList.includes(t));
  const autoTags = session.tags.filter(t => autoTagsList.includes(t));

  return `
    <div class="session-tags-section">
      <div class="tags-header">
        <span class="tags-label">Tags</span>
        <button class="btn-small" onclick="showAddTagForm('${session.id}')">+ Add Tag</button>
      </div>
      <div class="tags-list">
        ${autoTags.map(t => `<span class="tag tag-${t}">${t}</span>`).join('')}
        ${customTags.map(t => `
          <span class="tag tag-custom">
            ${escapeHtml(t)}
            <button class="tag-remove" onclick="event.stopPropagation(); removeTag('${session.id}', '${escapeHtml(t)}')">&times;</button>
          </span>
        `).join('')}
      </div>
      <div id="add-tag-form-${session.id}" class="add-tag-form hidden"></div>
    </div>
  `;
}

function showAddTagForm(sessionId) {
  const container = document.getElementById(`add-tag-form-${sessionId}`);
  if (!container) return;

  container.classList.remove('hidden');
  container.innerHTML = `
    <input type="text" id="new-tag-input-${sessionId}" placeholder="Tag name" class="input-small" onkeypress="if(event.key==='Enter')submitAddTag('${sessionId}')">
    <button class="btn-small btn-primary" onclick="submitAddTag('${sessionId}')">Add</button>
    <button class="btn-small" onclick="hideAddTagForm('${sessionId}')">Cancel</button>
  `;
  document.getElementById(`new-tag-input-${sessionId}`).focus();
}

function hideAddTagForm(sessionId) {
  const container = document.getElementById(`add-tag-form-${sessionId}`);
  if (container) {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}

async function submitAddTag(sessionId) {
  const input = document.getElementById(`new-tag-input-${sessionId}`);
  const tag = input.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');

  if (!tag) {
    showNotification('Please enter a tag name', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/sessions/${sessionId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: [tag] })
    });

    if (!res.ok) throw new Error('Failed to add tag');

    hideAddTagForm(sessionId);
    await loadSessions();
    await loadTags();
    if (state.currentSession && state.currentSession.id === sessionId) {
      const sessionRes = await fetch(`/api/sessions/${sessionId}`);
      const data = await sessionRes.json();
      state.currentSession = data.session;
      renderSessionDetail(data.session);
    }
    showNotification('Tag added', 'success');
  } catch (error) {
    showNotification('Failed to add tag: ' + error.message, 'error');
  }
}

async function removeTag(sessionId, tag) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to remove tag');

    await loadSessions();
    await loadTags();
    if (state.currentSession && state.currentSession.id === sessionId) {
      const sessionRes = await fetch(`/api/sessions/${sessionId}`);
      const data = await sessionRes.json();
      state.currentSession = data.session;
      renderSessionDetail(data.session);
    }
    showNotification('Tag removed', 'success');
  } catch (error) {
    showNotification('Failed to remove tag: ' + error.message, 'error');
  }
}

// Notification System
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('notification-fade');
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Event listeners
function setupEventListeners() {
  window.addEventListener('popstate', handleRoute);

  document.querySelectorAll('#time-filters .filter-item').forEach(el => {
    el.addEventListener('click', () => filterByTime(el.dataset.filter));
  });

  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
  });

  document.getElementById('search-mode-btn').addEventListener('click', toggleSearchMode);
  document.getElementById('back-button').addEventListener('click', showList);
  document.getElementById('pin-button').addEventListener('click', togglePin);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('modal-close').addEventListener('click', closeSettings);
  document.getElementById('modal-backdrop').addEventListener('click', closeSettings);
  document.getElementById('add-directory-btn').addEventListener('click', showAddDirectoryForm);
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Initialize
init();
