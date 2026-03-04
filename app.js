// ══════════════════════════════════════════════════════
//  TPS Client Desk AI — Main App (Consolidated)
//  Powered by Wisefox Solution
//  Version: 2.0.0
// ══════════════════════════════════════════════════════

import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signInWithRedirect,
         getRedirectResult, onAuthStateChanged,
         signOut }                      from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get,
         push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ── CONFIG ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAP6xYAgWtU8hyuJP2nximxRZRIJnwNgG0",
  authDomain:        "turning-point-task-manager.firebaseapp.com",
  databaseURL:       "https://turning-point-task-manager-default-rtdb.firebaseio.com",
  projectId:         "turning-point-task-manager",
  storageBucket:     "turning-point-task-manager.firebasestorage.app",
  messagingSenderId: "922397311479",
  appId:             "1:922397311479:web:0c4ed59ee86331261daef2",
  measurementId:     "G-BX36LQ0T1J"
};

const ADMIN_EMAIL = "nil000nilesh@gmail.com";
const ROLES = { ADMIN:'admin', LEADER:'leader', MEMBER:'member' };

// ── FIREBASE INIT ────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getDatabase(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ── APP STATE ────────────────────────────────────────
let currentUser = null;
let currentRole = ROLES.MEMBER;
let currentTeamId = null;
let allTasks = [], allMembers = [], allClients = [], allNotes = [], allReminders = [];
let currentTaskId = null, viewingClientId = null, activeNoteId = null;
let cachedApiKey = null;
let tasksFilter = 'all';

// ── HELPERS ──────────────────────────────────────────
function safeKey(email) { return email.replace(/\./g,'_').replace(/@/g,'__at__'); }
function toast(msg, isError=false) {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.innerHTML = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
}
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(n => n.classList.add('active'));
  if (name === 'settings') loadApiKeyStatus();
  if (name === 'dashboard') renderDashboard();
}
window.showView = showView;
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function timeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return Math.floor(d/60000) + 'm ago';
  if (d < 86400000) return Math.floor(d/3600000) + 'h ago';
  return Math.floor(d/86400000) + 'd ago';
}
function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
}

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════

// ── Reset button on every page load (stuck state fix) ──
function resetLoginBtn() {
  const btn = document.getElementById('googleLoginBtn');
  const txt = document.getElementById('googleBtnText');
  if (btn) btn.disabled = false;
  if (txt) txt.innerHTML = '<strong>Continue with Google</strong><br/><small style="font-weight:400;font-size:11px;color:#6b7280">Secure one-tap sign in</small>';
}
resetLoginBtn(); // call immediately on load

// ── Handle redirect result FIRST (before anything else) ──
getRedirectResult(auth).then(result => {
  if (result?.user) {
    // onAuthStateChanged will handle initApp
    console.log('✅ Redirect login success:', result.user.email);
  } else {
    // No redirect result — normal page load
    resetLoginBtn();
  }
}).catch(e => {
  resetLoginBtn();
  const ignoreCodes = ['auth/no-auth-event','auth/null-user','auth/missing-initial-state'];
  if (!ignoreCodes.includes(e.code)) {
    console.error('Redirect error:', e.code, e.message);
    // Show error only if it's meaningful
    if (e.code === 'auth/unauthorized-domain') {
      showLoginError('Domain authorized nahi hai. Firebase Console → Authentication → Authorized Domains mein apna domain add karo.');
    } else if (e.code !== 'auth/popup-closed-by-user') {
      showLoginError('Login error: ' + e.code);
    }
  }
});

function showLoginError(msg) {
  const el = document.getElementById('loginErrorMsg');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else toast(msg, true);
  resetLoginBtn();
}

window.loginWithGoogle = async () => {
  const btn = document.getElementById('googleLoginBtn');
  const txt = document.getElementById('googleBtnText');
  const errEl = document.getElementById('loginErrorMsg');
  if (errEl) errEl.style.display = 'none';

  if (btn) btn.disabled = true;
  if (txt) txt.innerHTML = '<strong>Signing in...</strong><br/><small style="color:#6b7280">Please wait...</small>';

  try {
    // Try popup first
    await signInWithPopup(auth, provider);
    // Success handled by onAuthStateChanged
  } catch(e) {
    console.log('Popup error:', e.code);
    if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(e.code)) {
      if (e.code !== 'auth/popup-closed-by-user') {
        // Popup was blocked — use redirect
        if (txt) txt.innerHTML = '<strong>Redirecting to Google...</strong><br/><small style="color:#6b7280">Please wait, do not refresh</small>';
        try {
          await signInWithRedirect(auth, provider);
          return; // Page will reload after Google auth
        } catch(e2) {
          showLoginError('Redirect failed: ' + e2.message);
        }
      } else {
        // User closed popup — just reset
        resetLoginBtn();
      }
    } else if (e.code === 'auth/unauthorized-domain') {
      showLoginError('❌ Domain unauthorized! Firebase Console → Authentication → Authorized Domains mein apna domain add karo.');
    } else {
      showLoginError('Login failed: ' + (e.message || e.code));
    }
  }
};

window.logout = async () => {
  await signOut(auth);
  currentUser = null;
  showScreen('login');
};

onAuthStateChanged(auth, async user => {
  if (user) {
    console.log('✅ Auth user:', user.email);
    currentUser = user;
    try {
      // Add timeout protection for DB reads
      const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      currentRole  = await Promise.race([resolveRole(user),  timeout(5000)]).catch(() => {
        console.warn('resolveRole timeout — using MEMBER default');
        return user.email === ADMIN_EMAIL ? ROLES.ADMIN : ROLES.MEMBER;
      });
      currentTeamId = await Promise.race([resolveTeam(user), timeout(5000)]).catch(() => {
        console.warn('resolveTeam timeout — using null');
        return null;
      });
      await Promise.race([registerUser(user), timeout(5000)]).catch(e => console.warn('registerUser failed:', e));
    } catch(e) {
      console.error('Pre-init error:', e);
      // Still try to init with defaults
      if (user.email === ADMIN_EMAIL) currentRole = ROLES.ADMIN;
    }
    try {
      initApp();
    } catch(e) {
      console.error('initApp error:', e);
      showLoginError('App load failed: ' + e.message + '. Please refresh.');
    }
  } else {
    showScreen('login');
    resetLoginBtn();
  }
});

async function resolveRole(user) {
  if (user.email === ADMIN_EMAIL) return ROLES.ADMIN;
  try {
    const snap = await get(ref(db, `roles/${safeKey(user.email)}`));
    if (snap.exists()) {
      const role = snap.val().role;
      console.log('Role from DB:', role);
      return role || ROLES.MEMBER;
    }
  } catch(e) {
    console.warn('resolveRole DB error:', e.code || e.message);
  }
  return ROLES.MEMBER;
}

async function resolveTeam(user) {
  try {
    const snap = await get(ref(db, 'teams'));
    if (!snap.exists()) return null;
    let teamId = null;
    snap.forEach(child => {
      const t = child.val();
      if (t.leaderEmail === user.email) teamId = child.key;
      if (t.members?.[safeKey(user.email)]) teamId = child.key;
    });
    return teamId;
  } catch(e) {
    console.warn('resolveTeam DB error:', e.code || e.message);
    return null;
  }
}

async function registerUser(user) {
  const k = safeKey(user.email);
  try {
    const snap = await get(ref(db, `users/${k}`));
    const data = { name: user.displayName || user.email.split('@')[0], email: user.email, photo: user.photoURL || '', lastSeen: Date.now() };
    if (!snap.exists()) data.createdAt = Date.now();
    await set(ref(db, `users/${k}`), snap.exists() ? {...snap.val(), ...data} : data);
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════
//  APP INIT
// ═══════════════════════════════════════════════════════

function initApp() {
  console.log('🚀 initApp — role:', currentRole, 'team:', currentTeamId);
  showScreen('app');
  setupSidebar();
  if (Notification.permission === 'default') Notification.requestPermission().catch(()=>{});

  const adminNav  = document.getElementById('adminNav');
  const leaderNav = document.getElementById('leaderNav');
  const memberNav = document.getElementById('memberNav');
  const roleEl    = document.getElementById('sidebarRole');

  if (currentRole === ROLES.ADMIN) {
    if (adminNav)  adminNav.style.display  = 'block';
    if (leaderNav) leaderNav.style.display = 'block';
    if (roleEl) { roleEl.textContent = '⚡ Admin'; roleEl.classList.add('admin'); }
    initLeaderModules();
    initAdminModule();
    showView('dashboard');
  } else if (currentRole === ROLES.LEADER) {
    if (leaderNav) leaderNav.style.display = 'block';
    if (roleEl) roleEl.textContent = '👑 Leader';
    initLeaderModules();
    showView('dashboard');
  } else {
    if (memberNav) memberNav.style.display = 'block';
    if (roleEl) { roleEl.textContent = '🧑‍💼 Staff'; roleEl.classList.add('member'); }
    initMemberModules();
    showView('my-tasks');
  }

  initAIFloat();
  setInterval(checkReminders, 60000);
  console.log('✅ App initialized successfully');
}

function setupSidebar() {
  const av = document.getElementById('sidebarAvatar');
  if (currentUser.photoURL) av.innerHTML = `<img src="${currentUser.photoURL}"/>`;
  else av.textContent = (currentUser.displayName || 'U')[0].toUpperCase();
  document.getElementById('sidebarName').textContent = currentUser.displayName || currentUser.email;
  const dashName = document.getElementById('dashName');
  if (dashName) dashName.textContent = (currentUser.displayName || 'Leader').split(' ')[0];
}

function initLeaderModules() {
  subscribeMembers();
  subscribeTasks();
  subscribeClients();
  subscribeNotes();
  subscribeReminders();
}

function initMemberModules() {
  subscribeTasks();
  subscribeReminders();
}

// ═══════════════════════════════════════════════════════
//  MEMBERS MODULE
// ═══════════════════════════════════════════════════════

function subscribeMembers() {
  onValue(ref(db, 'users'), snap => {
    onValue(ref(db, 'roles'), rolesSnap => {
      const roles = {};
      if (rolesSnap.exists()) rolesSnap.forEach(c => { roles[c.key] = c.val(); });
      allMembers = [];
      if (snap.exists()) snap.forEach(c => {
        const u = {id: c.key, ...c.val()};
        const r = roles[c.key] || {};
        u.role = r.role || 'member';
        u.teamId = r.teamId || '';
        if (currentTeamId) {
          if (r.teamId === currentTeamId || u.email === currentUser.email) allMembers.push(u);
        } else {
          allMembers.push(u);
        }
      });
      renderMembers();
      populateAssigneeSelect();
      populateReminderMemberSelect();
      setEl('statMembers', allMembers.length);
    });
  });
}

function renderMembers() {
  const el = document.getElementById('memberGrid'); if (!el) return;
  if (!allMembers.length) { el.innerHTML = emptyState('👥','No team members yet'); return; }
  el.innerHTML = allMembers.map(m => `<div class="member-card">
    <div class="member-avatar-lg">${m.photo ? `<img src="${m.photo}"/>` : (m.name||'?')[0]}</div>
    <div class="member-name">${m.name || '—'}</div>
    <div class="member-email">${m.email}</div>
    <span class="tag" style="margin:6px 0">${m.role||'member'}</span>
  </div>`).join('');
}

window.inviteMember = async () => {
  const email = document.getElementById('inviteEmail')?.value.trim().toLowerCase();
  const name  = document.getElementById('inviteName')?.value.trim();
  if (!email || !email.includes('@')) return toast('Valid email required', true);
  const k = safeKey(email);
  try {
    const snap = await get(ref(db, `users/${k}`));
    if (!snap.exists()) await set(ref(db, `users/${k}`), {email, name: name || email.split('@')[0], photo:'', createdAt: Date.now()});
    await set(ref(db, `roles/${k}`), {role:'member', email, teamId: currentTeamId||'', updatedAt: Date.now()});
    if (currentTeamId) await set(ref(db, `teams/${currentTeamId}/members/${k}`), {email, addedAt: Date.now()});
    toast(`✅ ${email} added as member`);
    ['inviteEmail','inviteName'].forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  } catch(e) { toast('Error: ' + e.message, true); }
};

function populateAssigneeSelect() {
  const el = document.getElementById('taskAssignee'); if (!el) return;
  el.innerHTML = '<option value="">Select Member...</option>' +
    allMembers.filter(m => m.role !== 'admin').map(m => `<option value="${m.email}">${m.name||m.email}</option>`).join('');
}

function populateReminderMemberSelect() {
  const el = document.getElementById('remMember'); if (!el) return;
  el.innerHTML = '<option value="all">All Members</option>' +
    allMembers.map(m => `<option value="${m.email}">${m.name||m.email}</option>`).join('');
}

// ═══════════════════════════════════════════════════════
//  TASKS MODULE
// ═══════════════════════════════════════════════════════

function subscribeTasks() {
  onValue(ref(db, 'tasks'), snap => {
    const raw = [];
    if (snap.exists()) snap.forEach(c => raw.push({id: c.key, ...c.val()}));
    if (currentRole === ROLES.MEMBER) {
      allTasks = raw.filter(t => t.assigneeEmail === currentUser.email);
    } else if (currentRole === ROLES.LEADER) {
      allTasks = raw.filter(t => t.teamId === currentTeamId || t.createdBy === currentUser.email);
    } else {
      allTasks = raw;
    }
    renderAllTasksList();
    renderMyTasks();
    renderRecentTasks();
    updateTaskBadge();
    renderDashboard();
    renderMyProgress();
  });
}

function renderMyTasks() {
  const el = document.getElementById('myTasksList'); if (!el) return;
  if (!allTasks.length) { el.innerHTML = emptyState('📋','No tasks assigned yet'); return; }
  el.innerHTML = allTasks.map(t => memberTaskCard(t)).join('');
}

function memberTaskCard(t) {
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
  return `<div class="task-item${overdue?' overdue-task':''}">
    <div class="task-status-pill">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title${t.status==='done'?' done':''}">${t.title}</div>
      ${t.desc?`<div class="task-desc">${t.desc}</div>`:''}
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag status-${t.status||'pending'}">${t.status||'pending'}</span>
        ${t.dueDate?`<span class="tag${overdue?' tag-danger':''}">📅 ${t.dueDate}</span>`:''}
        ${t.clientName?`<span class="tag">🏢 ${t.clientName}</span>`:''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-sm btn-update" onclick="openTaskUpdate('${t.id}')">💬 Update</button>
    </div>
  </div>`;
}

function renderAllTasksList(filter) {
  if (filter) tasksFilter = filter;
  const el = document.getElementById('allTasksList'); if (!el) return;
  const now = new Date();
  let tasks = allTasks;
  if (tasksFilter === 'pending') tasks = allTasks.filter(t => t.status === 'pending');
  else if (tasksFilter === 'inprogress') tasks = allTasks.filter(t => t.status === 'inprogress');
  else if (tasksFilter === 'review') tasks = allTasks.filter(t => t.status === 'review');
  else if (tasksFilter === 'done') tasks = allTasks.filter(t => t.status === 'done');
  else if (tasksFilter === 'overdue') tasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate)<now && t.status!=='done');
  if (!tasks.length) { el.innerHTML = emptyState('📋','No tasks found'); return; }
  el.innerHTML = tasks.map(t => leaderTaskCard(t)).join('');
}
window.filterTasks = (f) => renderAllTasksList(f);

function leaderTaskCard(t) {
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
  return `<div class="task-item${overdue?' overdue-task':''}">
    <div class="task-status-pill">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title${t.status==='done'?' done':''}">${t.title}</div>
      ${t.desc?`<div class="task-desc">${t.desc}</div>`:''}
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag status-${t.status||'pending'}">${t.status||'pending'}</span>
        ${t.dueDate?`<span class="tag${overdue?' tag-danger':''}">📅 ${t.dueDate}</span>`:''}
        <span class="tag">👤 ${t.assigneeName||t.assigneeEmail||'—'}</span>
        ${t.clientName?`<span class="tag">🏢 ${t.clientName}</span>`:''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-sm btn-update" onclick="openTaskUpdate('${t.id}')">💬 Chat</button>
      <button class="btn-sm btn-done" onclick="cycleTaskStatus('${t.id}','${t.status}')">⟳</button>
      <button class="btn-sm btn-del" onclick="deleteTask('${t.id}')">🗑</button>
    </div>
  </div>`;
}

function renderRecentTasks() {
  const el = document.getElementById('recentTasksList'); if (!el) return;
  const recent = [...allTasks].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  if (!recent.length) { el.innerHTML = emptyState('📋','No tasks yet'); return; }
  el.innerHTML = recent.map(t => `<div class="task-item compact">
    <div class="task-status-pill">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title">${t.title}</div>
      <div class="task-meta"><span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span><span class="tag">👤 ${t.assigneeName||'—'}</span></div>
    </div>
  </div>`).join('');
}

function statusIcon(s) { return s==='done'?'✅':s==='inprogress'?'🔄':s==='review'?'👁':'⏳'; }

window.createTask = async () => {
  const title   = document.getElementById('taskTitle')?.value.trim();
  const desc    = document.getElementById('taskDesc')?.value.trim();
  const email   = document.getElementById('taskAssignee')?.value;
  const priority= document.getElementById('taskPriority')?.value || 'medium';
  const dueDate = document.getElementById('taskDue')?.value;
  const clientId= document.getElementById('taskClient')?.value;
  if (!title) return toast('Task title required', true);
  if (!email) return toast('Select assignee', true);
  const member = allMembers.find(m => m.email === email) || {email, name:email};
  const cSelect = document.getElementById('taskClient');
  const clientName = clientId && cSelect ? cSelect.options[cSelect.selectedIndex]?.text || '' : '';
  try {
    await push(ref(db, 'tasks'), {
      title, desc:desc||'', assigneeEmail:member.email, assigneeName:member.name||member.email,
      priority, dueDate:dueDate||'', status:'pending',
      clientId:clientId||'', clientName: clientId ? clientName : '',
      teamId:currentTeamId||'', createdAt:Date.now(), createdBy:currentUser.email,
      createdByName:currentUser.displayName||''
    });
    toast('✅ Task assigned!');
    ['taskTitle','taskDesc','taskDue'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  } catch(e) { toast('Error: ' + e.message, true); }
};

window.resetTaskForm = () => {
  ['taskTitle','taskDesc','taskDue'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  const ta = document.getElementById('taskAssignee'); if(ta) ta.value='';
  const tc = document.getElementById('taskClient'); if(tc) tc.value='';
};

window.deleteTask = async (id) => {
  if (!confirm('Delete task?')) return;
  await remove(ref(db, `tasks/${id}`));
  toast('Task deleted');
};

window.cycleTaskStatus = async (id, current) => {
  const order = ['pending','inprogress','review','done'];
  const next = order[(order.indexOf(current)+1) % order.length];
  await update(ref(db, `tasks/${id}`), {status:next, updatedAt:Date.now()});
  toast(`Status → ${next}`);
};

function updateTaskBadge() {
  const pending = allTasks.filter(t => t.status !== 'done').length;
  const b1 = document.getElementById('taskBadge'); if(b1) b1.textContent = pending;
  const b2 = document.getElementById('myTaskBadge'); if(b2) b2.textContent = pending;
}

// ── Task Chat ──
window.openTaskUpdate = async (taskId) => {
  currentTaskId = taskId;
  const task = allTasks.find(t => t.id === taskId); if (!task) return;
  document.getElementById('taskUpdateTitle').textContent = task.title;
  document.getElementById('taskUpdateStatus').value = task.status || 'pending';
  document.getElementById('taskUpdateAssignee').textContent = task.assigneeName || task.assigneeEmail || '—';
  document.getElementById('taskUpdateDue').textContent = task.dueDate || 'No due date';
  loadTaskChat(taskId);
  openModal('taskUpdateModal');
};

window.updateTaskStatus = async () => {
  if (!currentTaskId) return;
  const status = document.getElementById('taskUpdateStatus').value;
  await update(ref(db, `tasks/${currentTaskId}`), {status, updatedAt:Date.now()});
};

window.sendTaskChat = async () => {
  if (!currentTaskId) return;
  const input = document.getElementById('taskChatInput');
  const text = input.value.trim(); if (!text) return;
  const status = document.getElementById('taskUpdateStatus').value;
  await update(ref(db, `tasks/${currentTaskId}`), {status, updatedAt:Date.now()});
  await push(ref(db, `taskChats/${currentTaskId}`), {
    text, by:currentUser.email, byName:currentUser.displayName||currentUser.email,
    type:'message', timestamp:Date.now()
  });
  input.value = '';
};

window.taskChatKeyDown = (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTaskChat();} };

function loadTaskChat(taskId) {
  const el = document.getElementById('taskChatMessages'); if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Loading...</div>';
  onValue(ref(db, `taskChats/${taskId}`), snap => {
    let msgs = [];
    if (snap.exists()) snap.forEach(c => msgs.push({id:c.key,...c.val()}));
    if (!msgs.length) { el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">No messages yet. Start the conversation!</div>'; return; }
    el.innerHTML = msgs.map(m => {
      const isMe = m.by === currentUser.email;
      return `<div class="task-chat-msg${isMe?' mine':''}">
        <div class="chat-msg-meta">${m.byName||m.by} · ${timeAgo(m.timestamp)}</div>
        <div class="chat-bubble${m.type==='update'?' bubble-update':''}">${m.type==='update'?'📊 ':''} ${m.text}</div>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  });
}

// ═══════════════════════════════════════════════════════
//  CLIENTS MODULE
// ═══════════════════════════════════════════════════════

let clientSearch = '', clientFilter = 'all';

function subscribeClients() {
  onValue(ref(db, 'clients'), snap => {
    allClients = [];
    if (snap.exists()) snap.forEach(c => allClients.push({id:c.key,...c.val()}));
    renderClientList();
    populateClientSelect();
    setEl('statClients', allClients.length);
  });
}

function renderClientList() {
  const el = document.getElementById('clientList'); if (!el) return;
  let list = allClients;
  if (clientFilter !== 'all') list = list.filter(c => c.type === clientFilter);
  if (clientSearch) {
    const q = clientSearch.toLowerCase();
    list = list.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.city||'').toLowerCase().includes(q));
  }
  if (!list.length) { el.innerHTML = emptyState('🏢','No clients found'); return; }
  el.innerHTML = list.map(c => `<div class="client-card" onclick="openClientDetail('${c.id}')">
    <div class="client-avatar">${(c.name||'C')[0].toUpperCase()}</div>
    <div class="client-info">
      <div class="client-name">${c.name}</div>
      <div class="client-sub">${c.phone||''} ${c.city?'· '+c.city:''}</div>
      <div class="client-tags">
        <span class="tag">${c.type||'retail'}</span>
        ${(c.outstanding||0)>0 ? `<span class="tag tag-danger">₹${Number(c.outstanding).toLocaleString('en-IN')} due</span>` : ''}
        ${(c.outstanding||0)===0 && c.totalPaid ? `<span class="tag tag-success">Cleared</span>` : ''}
      </div>
    </div>
    <div class="client-arrow">›</div>
  </div>`).join('');
}

window.filterClients = (f) => { clientFilter=f; renderClientList(); };
window.searchClients = (q) => { clientSearch=q; renderClientList(); };

window.addClient = async () => {
  const name    = document.getElementById('cName')?.value.trim();
  const phone   = document.getElementById('cPhone')?.value.trim();
  const email   = document.getElementById('cEmail')?.value.trim();
  const type    = document.getElementById('cType')?.value;
  const city    = document.getElementById('cCity')?.value.trim();
  const gst     = document.getElementById('cGst')?.value.trim();
  const address = document.getElementById('cAddress')?.value.trim();
  const notes   = document.getElementById('cNotes')?.value.trim();
  if (!name) return toast('Client name required', true);
  if (!phone) return toast('Phone required', true);
  try {
    await push(ref(db, 'clients'), {
      name, phone, email:email||'', type:type||'retail', city:city||'',
      gst:gst||'', address:address||'', notes:notes||'',
      outstanding:0, totalPaid:0, totalBilled:0,
      teamId:currentTeamId||'', createdAt:Date.now(), createdBy:currentUser.email
    });
    toast('✅ Client added!');
    closeModal('addClientModal');
    ['cName','cPhone','cEmail','cCity','cGst','cAddress','cNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { toast('Error: ' + e.message, true); }
};

window.openClientDetail = async (clientId) => {
  viewingClientId = clientId;
  const client = allClients.find(c => c.id === clientId); if (!client) return;
  const av = document.getElementById('cdAvatar'); if(av) { av.textContent = (client.name||'C')[0].toUpperCase(); }
  document.getElementById('cdName').textContent = client.name;
  const sub = document.getElementById('cdSubInfo'); if(sub) sub.textContent = `${client.phone||'—'} ${client.city?'· '+client.city:''}`;
  document.getElementById('cdOutstanding').textContent = '₹' + Number(client.outstanding||0).toLocaleString('en-IN');
  document.getElementById('cdTotalBilled').textContent = '₹' + Number(client.totalBilled||0).toLocaleString('en-IN');
  document.getElementById('cdTotalPaid').textContent = '₹' + Number(client.totalPaid||0).toLocaleString('en-IN');
  // Set today as default pay/order date
  const today = new Date().toISOString().split('T')[0];
  ['orderDate','payDate'].forEach(id => { const e=document.getElementById(id); if(e&&!e.value) e.value=today; });
  loadClientOrders(clientId);
  loadClientPayments(clientId);
  loadClientContacts(clientId);
  openModal('clientDetailModal');
};

window.switchClientTab = (name, el) => {
  ['orders','payments','contacts'].forEach(t => { document.getElementById('clientTab-'+t).style.display = t===name?'block':'none'; });
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
};

window.addOrder = async () => {
  if (!viewingClientId) return;
  const desc   = document.getElementById('orderDesc')?.value.trim();
  const amount = parseFloat(document.getElementById('orderAmount')?.value) || 0;
  const date   = document.getElementById('orderDate')?.value;
  const status = document.getElementById('orderStatus')?.value;
  if (!desc) return toast('Order description required', true);
  try {
    await push(ref(db, `clientOrders/${viewingClientId}`), {desc, amount, date:date||new Date().toISOString().split('T')[0], status:status||'pending', createdAt:Date.now(), createdBy:currentUser.email});
    const client = allClients.find(c => c.id===viewingClientId);
    await update(ref(db, `clients/${viewingClientId}`), {totalBilled:(client?.totalBilled||0)+amount, outstanding:(client?.outstanding||0)+amount});
    toast('Order added');
    document.getElementById('orderDesc').value = '';
    document.getElementById('orderAmount').value = '';
  } catch(e) { toast('Error: '+e.message, true); }
};

function loadClientOrders(clientId) {
  const el = document.getElementById('clientOrdersList'); if (!el) return;
  onValue(ref(db, `clientOrders/${clientId}`), snap => {
    let orders = [];
    if (snap.exists()) snap.forEach(c => orders.push({id:c.key,...c.val()}));
    if (!orders.length) { el.innerHTML = emptyState('📦','No orders yet'); return; }
    el.innerHTML = orders.reverse().map(o => `<div class="order-row">
      <div class="order-info"><div class="order-desc">${o.desc}</div><div class="order-meta">${o.date||'—'} · <span class="tag status-${o.status||'pending'}">${o.status||'pending'}</span></div></div>
      <div class="order-amount">₹${Number(o.amount||0).toLocaleString('en-IN')}</div>
    </div>`).join('');
  });
}

window.addPayment = async () => {
  if (!viewingClientId) return;
  const amount = parseFloat(document.getElementById('payAmount')?.value) || 0;
  const mode   = document.getElementById('payMode')?.value;
  const refNo  = document.getElementById('payRef')?.value.trim();
  const date   = document.getElementById('payDate')?.value;
  if (!amount) return toast('Amount required', true);
  try {
    await push(ref(db, `clientPayments/${viewingClientId}`), {amount, mode:mode||'cash', ref:refNo||'', date:date||new Date().toISOString().split('T')[0], createdAt:Date.now(), createdBy:currentUser.email});
    const client = allClients.find(c => c.id===viewingClientId);
    await update(ref(db, `clients/${viewingClientId}`), {totalPaid:(client?.totalPaid||0)+amount, outstanding:Math.max(0,(client?.outstanding||0)-amount)});
    toast('✅ Payment recorded');
    document.getElementById('payAmount').value = '';
    document.getElementById('payRef').value = '';
    // Refresh outstanding display
    const newOutstanding = Math.max(0,(client?.outstanding||0)-amount);
    document.getElementById('cdOutstanding').textContent = '₹' + newOutstanding.toLocaleString('en-IN');
  } catch(e) { toast('Error: '+e.message, true); }
};

function loadClientPayments(clientId) {
  const el = document.getElementById('clientPaymentsList'); if (!el) return;
  onValue(ref(db, `clientPayments/${clientId}`), snap => {
    let pays = [];
    if (snap.exists()) snap.forEach(c => pays.push({id:c.key,...c.val()}));
    if (!pays.length) { el.innerHTML = emptyState('💰','No payments yet'); return; }
    el.innerHTML = pays.reverse().map(p => `<div class="payment-row">
      <div class="pay-icon">💰</div>
      <div class="pay-info"><div class="pay-mode">${p.mode||'cash'} ${p.ref?'· '+p.ref:''}</div><div class="pay-date">${p.date||'—'}</div></div>
      <div class="pay-amount" style="color:var(--accent)">+₹${Number(p.amount||0).toLocaleString('en-IN')}</div>
    </div>`).join('');
  });
}

window.addContact = async () => {
  if (!viewingClientId) return;
  const cName  = document.getElementById('contactName')?.value.trim();
  const cPhone = document.getElementById('contactPhone')?.value.trim();
  const cRole  = document.getElementById('contactRole')?.value.trim();
  if (!cName || !cPhone) return toast('Name and phone required', true);
  try {
    await push(ref(db, `clientContacts/${viewingClientId}`), {name:cName, phone:cPhone, role:cRole||'', createdAt:Date.now()});
    toast('Contact added');
    ['contactName','contactPhone','contactRole'].forEach(id => {const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { toast('Error: '+e.message, true); }
};

function loadClientContacts(clientId) {
  const el = document.getElementById('clientContactsList'); if (!el) return;
  onValue(ref(db, `clientContacts/${clientId}`), snap => {
    let contacts = [];
    if (snap.exists()) snap.forEach(c => contacts.push({id:c.key,...c.val()}));
    if (!contacts.length) { el.innerHTML = emptyState('📞','No contacts yet'); return; }
    el.innerHTML = contacts.map(c => `<div class="contact-row">
      <div class="contact-avatar">${(c.name||'C')[0]}</div>
      <div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-sub">${c.phone} ${c.role?'· '+c.role:''}</div></div>
      <a href="tel:${c.phone}" class="btn-sm btn-done">📞</a>
    </div>`).join('');
  });
}

function populateClientSelect() {
  const el = document.getElementById('taskClient'); if (!el) return;
  el.innerHTML = '<option value="">No Client</option>' + allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// ═══════════════════════════════════════════════════════
//  NOTES MODULE
// ═══════════════════════════════════════════════════════

function subscribeNotes() {
  const notesPath = `notes/${safeKey(currentUser.email)}`;
  onValue(ref(db, notesPath), snap => {
    allNotes = [];
    if (snap.exists()) snap.forEach(c => allNotes.push({id:c.key,...c.val()}));
    allNotes.sort((a,b) => (b.updatedAt||b.createdAt||0) - (a.updatedAt||a.createdAt||0));
    renderNoteList();
  });
}

function renderNoteList() {
  const el = document.getElementById('noteList'); if (!el) return;
  const q = (document.getElementById('noteSearch')?.value || '').toLowerCase();
  let notes = allNotes;
  if (q) notes = notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q));
  if (!notes.length) { el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">No notes yet</div>'; return; }
  el.innerHTML = notes.map(n => `<div class="note-list-item${activeNoteId===n.id?' active':''}" onclick="openNoteById('${n.id}')" style="border-left:3px solid ${n.color||'var(--surface2)'}">
    <div class="note-list-title">${n.title||'Untitled'}</div>
    <div class="note-list-preview">${(n.content||'').substring(0,60)}</div>
    <div class="note-list-date">${formatDate(n.updatedAt||n.createdAt)}</div>
  </div>`).join('');
}

window.openNoteById = (id) => {
  const n = allNotes.find(n => n.id === id); if (!n) return;
  activeNoteId = id;
  document.getElementById('noteEditorTitle').value = n.title || '';
  document.getElementById('noteEditorContent').value = n.content || '';
  document.getElementById('noteEditorContent').style.background = n.color || 'var(--surface)';
  document.getElementById('noteCategory').value = n.category || '';
  document.querySelectorAll('.note-color-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.color === (n.color || '#181c24')));
  const empty = document.getElementById('noteEmptyState'); if(empty) empty.style.display = 'none';
  renderNoteList();
};

window.newNote = async () => {
  try {
    const newRef = await push(ref(db, `notes/${safeKey(currentUser.email)}`), {
      title:'', content:'', category:'', color:'#181c24',
      createdAt:Date.now(), updatedAt:Date.now(), createdBy:currentUser.email
    });
    activeNoteId = newRef.key;
    setTimeout(() => openNoteById(newRef.key), 300);
  } catch(e) { toast('Error: '+e.message, true); }
};

window.saveNote = async () => {
  if (!activeNoteId) return;
  const title   = document.getElementById('noteEditorTitle')?.value.trim() || 'Untitled';
  const content = document.getElementById('noteEditorContent')?.value || '';
  const category= document.getElementById('noteCategory')?.value || '';
  const color   = document.querySelector('.note-color-btn.active')?.dataset.color || '#181c24';
  try {
    await update(ref(db, `notes/${safeKey(currentUser.email)}/${activeNoteId}`), {title, content, category, color, updatedAt:Date.now()});
  } catch(e) {}
};

window.deleteCurrentNote = async () => {
  if (!activeNoteId) return;
  if (!confirm('Delete this note?')) return;
  await remove(ref(db, `notes/${safeKey(currentUser.email)}/${activeNoteId}`));
  activeNoteId = null;
  document.getElementById('noteEditorTitle').value = '';
  document.getElementById('noteEditorContent').value = '';
  const empty = document.getElementById('noteEmptyState'); if(empty) empty.style.display = 'flex';
  toast('Note deleted');
};

window.setNoteColor = (color) => {
  document.querySelectorAll('.note-color-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.color === color));
  const content = document.getElementById('noteEditorContent'); if(content) content.style.background = color;
  noteAutoSave();
};

let _noteTimer;
window.noteAutoSave = () => { clearTimeout(_noteTimer); _noteTimer = setTimeout(saveNote, 1500); };
window.renderNoteList = renderNoteList;

// ═══════════════════════════════════════════════════════
//  REMINDERS MODULE
// ═══════════════════════════════════════════════════════

function subscribeReminders() {
  onValue(ref(db, 'reminders'), snap => {
    const raw = [];
    if (snap.exists()) snap.forEach(c => raw.push({id:c.key,...c.val()}));
    if (currentRole === ROLES.ADMIN) {
      allReminders = raw;
    } else if (currentRole === ROLES.LEADER) {
      allReminders = raw.filter(r => r.teamId === currentTeamId);
    } else {
      allReminders = raw.filter(r =>
        (r.forEmail === currentUser.email || (r.forEmail === 'all' && r.teamId === currentTeamId))
      );
    }
    renderReminders();
    renderMyReminders();
    renderDashReminders();
    updateReminderBadge();
  });
}

function renderReminders() {
  const el = document.getElementById('remindersList'); if (!el) return;
  if (!allReminders.length) { el.innerHTML = emptyState('🔔','No reminders set'); return; }
  const now = Date.now();
  el.innerHTML = allReminders.map(r => {
    const overdue = r.time < now && r.status !== 'done';
    return `<div class="reminder-item">
      <div class="reminder-icon">${overdue?'⚠️':r.status==='done'?'✅':'🔔'}</div>
      <div class="reminder-body">
        <div class="reminder-title">${r.title}</div>
        <div class="reminder-time${overdue?' overdue':''}">${formatDateTime(r.time)} ${r.forEmail&&r.forEmail!=='all'?'· '+r.forEmail:r.forEmail==='all'?'· All':''}  </div>
      </div>
      <div style="display:flex;gap:6px">
        ${r.status!=='done'?`<button class="btn-sm btn-done" onclick="doneReminder('${r.id}')">✅</button>`:''}
        <button class="btn-sm btn-del" onclick="deleteReminder('${r.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function renderMyReminders() {
  const el = document.getElementById('myRemindersList'); if (!el) return;
  if (!allReminders.length) { el.innerHTML = emptyState('🔔','No reminders'); return; }
  const now = Date.now();
  el.innerHTML = allReminders.map(r => {
    const overdue = r.time < now && r.status !== 'done';
    return `<div class="reminder-item">
      <div class="reminder-icon">${overdue?'⚠️':r.status==='done'?'✅':'🔔'}</div>
      <div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time${overdue?' overdue':''}">${formatDateTime(r.time)}</div></div>
    </div>`;
  }).join('');
}

function renderDashReminders() {
  const el = document.getElementById('dashReminderList'); if (!el) return;
  const upcoming = allReminders.filter(r => r.status !== 'done').slice(0,4);
  if (!upcoming.length) { el.innerHTML = emptyState('🔔','No upcoming reminders'); return; }
  el.innerHTML = upcoming.map(r => `<div class="reminder-item">
    <div class="reminder-icon">🔔</div>
    <div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time">${formatDateTime(r.time)}</div></div>
  </div>`).join('');
}

window.createReminder = async () => {
  const title    = document.getElementById('remTitle')?.value.trim();
  const time     = document.getElementById('remTime')?.value;
  const forEmail = document.getElementById('remMember')?.value || 'all';
  if (!title || !time) return toast('Fill all fields', true);
  try {
    await push(ref(db, 'reminders'), {title, time:new Date(time).getTime(), forEmail, status:'pending', teamId:currentTeamId||'', createdAt:Date.now(), createdBy:currentUser.email});
    toast('🔔 Reminder set!');
    document.getElementById('remTitle').value = '';
    document.getElementById('remTime').value = '';
  } catch(e) { toast('Error: '+e.message, true); }
};

window.doneReminder = async (id) => { await update(ref(db, `reminders/${id}`), {status:'done'}); toast('Done!'); };
window.deleteReminder = async (id) => { await remove(ref(db, `reminders/${id}`)); toast('Removed'); };

function updateReminderBadge() {
  const pending = allReminders.filter(r => r.status !== 'done').length;
  ['reminderBadge','myReminderBadge'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=pending; });
}

function checkReminders() {
  const now = Date.now();
  allReminders.forEach(r => {
    if (r.status==='pending' && r.time<=now && r.time>now-70000) {
      toast('🔔 Reminder: ' + r.title);
      if (Notification.permission==='granted') {
        new Notification('TPS Reminder', {body:r.title});
      }
    }
  });
}

// ═══════════════════════════════════════════════════════
//  ADMIN MODULE
// ═══════════════════════════════════════════════════════

let adminTeams = [], adminUsers = [];

function initAdminModule() {
  let latestUsers = null, latestRoles = null;
  function mergeAndRender() {
    if (!latestUsers) return;
    adminUsers = [];
    latestUsers.forEach(c => {
      const role = latestRoles?.[c.key]?.role || 'member';
      adminUsers.push({id:c.key,...c.val(), role});
    });
    renderAdminUserList();
  }
  onValue(ref(db, 'users'), snap => {
    latestUsers = snap.exists() ? snap : null;
    mergeAndRender();
  });
  onValue(ref(db, 'roles'), snap => {
    latestRoles = {};
    if (snap.exists()) snap.forEach(c => { latestRoles[c.key] = c.val(); });
    mergeAndRender();
  });
  onValue(ref(db, 'teams'), snap => {
    adminTeams = [];
    if (snap.exists()) snap.forEach(c => adminTeams.push({id:c.key,...c.val()}));
    renderAdminTeamList();
    populateAdminTeamSelect();
  });
}

window.adminCreateTeam = async () => {
  const name  = document.getElementById('newTeamName')?.value.trim();
  const email = document.getElementById('newTeamLeader')?.value.trim().toLowerCase();
  if (!name) return toast('Team name required', true);
  if (!email || !email.includes('@')) return toast('Valid leader email required', true);
  try {
    const k = safeKey(email);
    const teamRef = push(ref(db, 'teams'));
    const teamId = teamRef.key;
    await set(teamRef, {name, leaderEmail:email, createdAt:Date.now()});
    await set(ref(db, `roles/${k}`), {role:ROLES.LEADER, email, teamId, updatedAt:Date.now()});
    // Register leader as user if not already present
    const userSnap = await get(ref(db, `users/${k}`));
    if (!userSnap.exists()) {
      await set(ref(db, `users/${k}`), {name: email.split('@')[0], email, photo:'', createdAt:Date.now()});
    }
    toast(`✅ Team "${name}" created!`);
    ['newTeamName','newTeamLeader'].forEach(id => {const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) {
    console.error('adminCreateTeam error:', e);
    toast('Error: '+e.message, true);
  }
};

window.adminAddMember = async () => {
  const email  = document.getElementById('newMemberEmailAdmin')?.value.trim().toLowerCase();
  const teamId = document.getElementById('memberTeamSelect')?.value;
  if (!email || !email.includes('@')) return toast('Valid email required', true);
  if (!teamId) return toast('Select a team', true);
  try {
    const k = safeKey(email);
    await set(ref(db, `roles/${k}`), {role:ROLES.MEMBER, email, teamId, updatedAt:Date.now()});
    await set(ref(db, `teams/${teamId}/members/${k}`), {email, addedAt:Date.now()});
    toast(`✅ ${email} added to team`);
    document.getElementById('newMemberEmailAdmin').value = '';
  } catch(e) { toast('Error: '+e.message, true); }
};

window.adminChangeRole = async (email, role) => {
  await update(ref(db, `roles/${safeKey(email)}`), {role, updatedAt:Date.now()});
  toast(`Role updated → ${role}`);
};

window.adminDeleteTeam = async (id, name) => {
  if (!confirm(`Delete team "${name}"?`)) return;
  await remove(ref(db, `teams/${id}`));
  toast('Team deleted');
};

function renderAdminUserList() {
  const el = document.getElementById('adminUserList'); if (!el) return;
  if (!adminUsers.length) { el.innerHTML = emptyState('👥','No users yet'); return; }
  el.innerHTML = adminUsers.map(u => `<div class="admin-user-row">
    <div class="user-avatar-sm">${u.photo?`<img src="${u.photo}"/>`:((u.name||'U')[0])}</div>
    <div class="admin-user-info"><div class="admin-user-name">${u.name||'—'}</div><div class="admin-user-email">${u.email}</div></div>
    <select class="form-control" style="width:100px;padding:4px 6px;font-size:12px" onchange="adminChangeRole('${u.email}',this.value)">
      <option value="member"${u.role==='member'?' selected':''}>Member</option>
      <option value="leader"${u.role==='leader'?' selected':''}>Leader</option>
      <option value="admin"${u.role==='admin'?' selected':''}>Admin</option>
    </select>
  </div>`).join('');
}

function renderAdminTeamList() {
  const el = document.getElementById('adminTeamList'); if (!el) return;
  if (!adminTeams.length) { el.innerHTML = emptyState('🏢','No teams yet'); return; }
  el.innerHTML = adminTeams.map(team => {
    const members = team.members ? Object.entries(team.members) : [];
    return `<div class="admin-team-card">
      <div class="admin-team-header">
        <div><div class="admin-team-name">🏢 ${team.name}</div><div class="admin-team-leader">Leader: ${team.leaderEmail||'—'}</div></div>
        <button class="btn-sm btn-del" onclick="adminDeleteTeam('${team.id}','${team.name}')">🗑</button>
      </div>
      <div class="team-members-wrap">${members.map(([k,m])=>`<span class="team-member-chip">${m.email}</span>`).join('') || '<span style="color:var(--muted);font-size:12px">No members</span>'}</div>
    </div>`;
  }).join('');
}

function populateAdminTeamSelect() {
  const el = document.getElementById('memberTeamSelect'); if (!el) return;
  el.innerHTML = '<option value="">Select Team...</option>' + adminTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════

function renderDashboard() {
  const now = Date.now();
  let total=0, done=0, progress=0, overdue=0;
  allTasks.forEach(t => {
    total++;
    if(t.status==='done') done++;
    else if(t.status==='inprogress') progress++;
    if(t.status!=='done' && t.dueDate && new Date(t.dueDate).getTime()<now) overdue++;
  });
  setEl('statTotal', total); setEl('statDone', done); setEl('statProgress', progress); setEl('statOverdue', overdue);
}

function renderMyProgress() {
  const total = allTasks.length;
  const done  = allTasks.filter(t => t.status==='done').length;
  const pct   = total ? Math.round((done/total)*100) : 0;
  setEl('myStatTotal', total); setEl('myStatDone', done); setEl('myStatPending', total-done);
  setEl('myProgressPct', pct+'%');
  const fill = document.getElementById('myProgressFill'); if(fill) fill.style.width = pct+'%';
}

function setEl(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

// ═══════════════════════════════════════════════════════
//  FLOATING AI + PIN SYSTEM
// ═══════════════════════════════════════════════════════

const PIN_KEY = 'tps_ai_pin_hash';

async function hashPIN(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin+'tps_wisefox_2025'));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function getPINHash() { return localStorage.getItem(PIN_KEY); }

function initAIFloat() {
  if (!getPINHash()) {
    document.getElementById('aiPinSetupPanel').classList.add('show');
  }
  // Show welcome if already open
}

window.openAIFloat = () => {
  if (!getPINHash()) { document.getElementById('aiPinSetupPanel').classList.add('show'); return; }
  document.getElementById('aiPinVerifyPanel').classList.add('show');
  setTimeout(() => document.getElementById('aiPinVerifyInput')?.focus(), 100);
};

window.setupAIPIN = async () => {
  const pin     = document.getElementById('aiPinInput').value.trim();
  const confirm = document.getElementById('aiPinConfirm').value.trim();
  if (pin.length < 4) return toast('PIN must be at least 4 digits', true);
  if (pin !== confirm) return toast('PINs do not match', true);
  localStorage.setItem(PIN_KEY, await hashPIN(pin));
  document.getElementById('aiPinSetupPanel').classList.remove('show');
  document.getElementById('aiPinInput').value = '';
  document.getElementById('aiPinConfirm').value = '';
  toast('✅ AI PIN set!');
};

window.verifyAIPIN = async () => {
  const pin = document.getElementById('aiPinVerifyInput').value.trim();
  if ((await hashPIN(pin)) === getPINHash()) {
    document.getElementById('aiPinVerifyPanel').classList.remove('show');
    document.getElementById('aiPinVerifyInput').value = '';
    openAIChat();
  } else {
    toast('❌ Wrong PIN', true);
    document.getElementById('aiPinVerifyInput').value = '';
  }
};

window.resetAIPIN = () => {
  if (!confirm('Reset AI PIN?')) return;
  localStorage.removeItem(PIN_KEY);
  document.getElementById('aiPinVerifyPanel').classList.remove('show');
  document.getElementById('aiPinSetupPanel').classList.add('show');
};

window.aiPinKeyDown = (e) => { if(e.key==='Enter') verifyAIPIN(); };
window.setupPinKeyDown = (e) => { if(e.key==='Enter') setupAIPIN(); };

function openAIChat() {
  const chat = document.getElementById('aiFloatChat');
  const btn  = document.getElementById('aiFloatBtn');
  chat.classList.add('open');
  btn.style.display = 'none';
  const msgs = document.getElementById('aiFloatMessages');
  if (!msgs.children.length) addAIMsg(getWelcomeMsg(), false);
}

window.closeAIFloat = () => {
  document.getElementById('aiFloatChat').classList.remove('open');
  document.getElementById('aiFloatBtn').style.display = 'flex';
};

function getWelcomeMsg() {
  return `<strong>TPS AI Assistant</strong> — <span style="color:var(--accent)">Wisefox Solution</span> 🦊<br/><br/>
Main kya kar sakta hoon:<br/>
• 📝 <strong>Note banao:</strong> "Note: Client call Friday 4pm"<br/>
• 📋 <strong>Task assign:</strong> "Rahul ko printer install task do, due 30 June, high priority"<br/>
• 🔔 <strong>Reminder:</strong> "Kal subah 9 baje meeting ka reminder"<br/>
• 📊 <strong>Status:</strong> "Team ka status dikhao"<br/><br/>
💡 Hindi, English, Hinglish — sab samajhta hoon!`;
}

window.sendAIChat = async () => {
  const input = document.getElementById('aiFloatInput');
  const msg = input.value.trim(); if (!msg) return;
  input.value = '';
  addAIMsg(msg, true);
  showAITyping();
  setTimeout(async () => {
    const res = await processAI(msg);
    removeAITyping();
    addAIMsg(res, false);
  }, 600);
};

window.aiFloatKeyDown = (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAIChat();} };

function addAIMsg(text, isUser) {
  const el  = document.getElementById('aiFloatMessages');
  const div = document.createElement('div');
  div.className = 'float-msg' + (isUser ? ' user' : '');
  div.innerHTML = `<div class="float-bubble">${text}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

let typingEl = null;
function showAITyping() {
  const el = document.getElementById('aiFloatMessages');
  typingEl = document.createElement('div');
  typingEl.className = 'float-msg';
  typingEl.innerHTML = '<div class="float-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
  el.appendChild(typingEl); el.scrollTop = el.scrollHeight;
}
function removeAITyping() { if(typingEl){typingEl.remove();typingEl=null;} }

async function processAI(msg) {
  const key = await getApiKey();
  if (key) return callOpenAI(msg, key);
  return localAI(msg);
}

async function getApiKey() {
  if (cachedApiKey) return cachedApiKey;
  try {
    const snap = await get(ref(db, 'settings/openaiApiKey'));
    if (snap.exists()) { cachedApiKey = snap.val(); return cachedApiKey; }
  } catch(e) {}
  return null;
}

async function callOpenAI(msg, apiKey) {
  const context = `You are TPS AI Assistant for Turning Point Solution — a computer hardware/software sales & service firm.
Team members: ${allMembers.map(m=>m.name||m.email).join(', ')||'None'}
Tasks: Total:${allTasks.length} Done:${allTasks.filter(t=>t.status==='done').length} Pending:${allTasks.filter(t=>t.status!=='done').length}
Clients: ${allClients.length} clients
Today: ${new Date().toISOString().split('T')[0]}

For actions respond ONLY with JSON:
{"action":"note","content":"..."}
{"action":"task","title":"...","assigneeName":"...","priority":"high/medium/low","dueDate":"YYYY-MM-DD"}
{"action":"reminder","title":"...","hoursFromNow":1}
For general questions respond in clean HTML. Reply in user's language (Hindi/English/Hinglish).`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'gpt-4o',max_tokens:600,temperature:0.4,
        messages:[{role:'system',content:context},{role:'user',content:msg}]})
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content||'').trim();
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { const a = JSON.parse(match[0]); if(a.action) return execAIAction(a, msg); }
    } catch(e) {}
    return text;
  } catch(e) { return localAI(msg); }
}

async function execAIAction(a, orig) {
  if (a.action === 'note') {
    const content = a.content || orig;
    await push(ref(db, `notes/${safeKey(currentUser.email)}`), {content, title:content.substring(0,30), category:'', color:'#181c24', createdAt:Date.now(), updatedAt:Date.now(), createdBy:currentUser.email});
    return `✅ <strong>Note saved!</strong><br/>"${content}"<br/>📝 Notes section mein dekho.`;
  }
  if (a.action === 'task') {
    const m = allMembers.find(m => (m.name||'').toLowerCase().includes((a.assigneeName||'').toLowerCase()) || m.email.includes((a.assigneeName||'').toLowerCase()));
    if (!m) return `❌ Member nahi mila: "${a.assigneeName}"<br/>Available: ${allMembers.map(m=>m.name||m.email).join(', ')||'No members'}`;
    await push(ref(db, 'tasks'), {title:a.title, desc:a.description||'', assigneeEmail:m.email, assigneeName:m.name||m.email, priority:a.priority||'medium', dueDate:a.dueDate||'', status:'pending', teamId:currentTeamId||'', createdAt:Date.now(), createdBy:currentUser.email, source:'ai'});
    return `✅ <strong>Task assigned!</strong><br/>📋 ${a.title}<br/>👤 ${m.name||m.email}<br/>📅 ${a.dueDate||'No date'}<br/>🎯 ${a.priority||'medium'}`;
  }
  if (a.action === 'reminder') {
    const t = Date.now() + ((parseFloat(a.hoursFromNow)||1)*3600000);
    await push(ref(db, 'reminders'), {title:a.title, time:t, forEmail:'all', status:'pending', createdAt:Date.now(), createdBy:currentUser.email});
    return `✅ <strong>Reminder set!</strong><br/>🔔 "${a.title}"<br/>⏰ ${new Date(t).toLocaleString()}`;
  }
  return '🤔 Unknown action';
}

function localAI(msg) {
  const l = msg.toLowerCase();
  if (l.includes('status')||l.includes('report')||l.includes('kitne')) {
    const done=allTasks.filter(t=>t.status==='done').length;
    return `📊 <strong>Team Status</strong><br/>Total: ${allTasks.length} | ✅ Done: ${done} | 🔄 Pending: ${allTasks.length-done}<br/>Clients: ${allClients.length} | Members: ${allMembers.length}`;
  }
  return `🤔 Samajh nahi aaya: "${msg.substring(0,50)}"<br/>Try: "Status dikhao" ya "Help"<br/><small style="color:var(--muted)">Settings → OpenAI API Key add karo for full AI!</small>`;
}

// ── API Key Settings ──
async function loadApiKeyStatus() {
  const key = await getApiKey();
  const el = document.getElementById('apiKeyStatus'); if (!el) return;
  if (key) { el.textContent='✅ Active'; el.style.background='rgba(0,229,160,0.15)'; el.style.color='var(--accent)'; }
  else { el.textContent='Not Set'; el.style.background='rgba(255,107,107,0.15)'; el.style.color='#ff6b6b'; }
}

window.saveApiKey = async () => {
  const key = document.getElementById('apiKeyInput')?.value.trim();
  if (!key) return toast('API Key empty', true);
  if (!key.startsWith('sk-')) return toast('Invalid key — must start with sk-', true);
  await set(ref(db, 'settings/openaiApiKey'), key);
  cachedApiKey = key;
  loadApiKeyStatus();
  toast('✅ API Key saved!');
  document.getElementById('apiKeyInput').value = '';
};

window.clearApiKey = async () => {
  if (!confirm('Remove API Key?')) return;
  await remove(ref(db, 'settings/openaiApiKey'));
  cachedApiKey = null;
  loadApiKeyStatus();
  toast('API Key removed');
};

window.toggleApiKeyVisibility = () => {
  const inp = document.getElementById('apiKeyInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
};

window.changePIN = async () => {
  const oldPin = document.getElementById('changePinOld')?.value.trim();
  const newPin = document.getElementById('changePinNew')?.value.trim();
  if (!oldPin || !newPin) return toast('Fill all fields', true);
  if (newPin.length < 4) return toast('PIN min 4 digits', true);
  if ((await hashPIN(oldPin)) !== getPINHash()) return toast('❌ Wrong current PIN', true);
  localStorage.setItem(PIN_KEY, await hashPIN(newPin));
  toast('✅ PIN changed!');
  ['changePinOld','changePinNew'].forEach(id => {const e=document.getElementById(id);if(e)e.value='';});
};
