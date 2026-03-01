// ══════════════════════════════════════════
//  TPS Client Desk — UI Helpers
// ══════════════════════════════════════════

// ── Toast ──
export function toast(msg, isError = false) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.innerHTML = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Modal ──
export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}
window.closeModal = closeModal;

// ── Screen switch ──
export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + name);
  if (sc) sc.classList.add('active');
}

// ── View router ──
export function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(n => n.classList.add('active'));
  // Fire custom event so modules can react
  document.dispatchEvent(new CustomEvent('viewChanged', { detail: name }));
}
window.showView = showView;

// ── Date helpers ──
export function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

// ── Safe email key (Firebase path safe) ──
export function safeKey(email) {
  return email.replace(/\./g, '_').replace(/@/g, '__at__');
}

// ── Empty state HTML ──
export function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
}

// ── Priority tag ──
export function priorityTag(p) {
  return `<span class="tag priority-${p || 'medium'}">${p || 'medium'}</span>`;
}
export function statusTag(s) {
  return `<span class="tag status-${s || 'pending'}">${s || 'pending'}</span>`;
}

// ── Confirm dialog ──
export function confirmAction(msg) {
  return confirm(msg);
}
