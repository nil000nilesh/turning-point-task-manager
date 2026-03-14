// ══════════════════════════════════════════════════════
//  TPS Client Desk AI — Main App
//  Powered by Wisefox Solution
//  Version: 5.0.0 — Realtime Database Edition (Wisefox-1)
// ══════════════════════════════════════════════════════

import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signInWithRedirect,
         getRedirectResult, onAuthStateChanged,
         signOut }                      from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, push,
         onValue, onChildAdded, update, remove,
         query, orderByChild, equalTo }
                                        from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ── CONFIG (Wisefox-1) ───────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAKT-pTIOoJAML5WfR733IXle0l7hCwBeI",
  authDomain:        "wisefox-1.firebaseapp.com",
  projectId:         "wisefox-1",
  storageBucket:     "wisefox-1.firebasestorage.app",
  messagingSenderId: "524714148006",
  appId:             "1:524714148006:web:d2799b38388b9577073467",
  measurementId:     "G-D93REXPD6P",
  databaseURL:       "https://wisefox-1-default-rtdb.firebaseio.com"
};

const ADMIN_EMAIL     = "nil000nilesh@gmail.com";
const ADMIN_USER_PIN  = "5786";
const PIN_EXPIRY_DAYS = 30;
const INACTIVITY_MS   = 5 * 60 * 1000;
const ROLES = { ADMIN:'admin', LEADER:'leader', MEMBER:'member' };

// ── FIREBASE INIT ────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getDatabase(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ── APP STATE ────────────────────────────────────────
let currentUser   = null;
let currentRole   = ROLES.MEMBER;
let currentTeamId = null;
let allTasks=[], allMembers=[], allClients=[], allNotes=[], allReminders=[];
let currentTaskId=null, viewingClientId=null, activeNoteId=null;
let cachedApiKey=null, tasksFilter='all';
let _chatNotifySet=new Set(), _knownTaskIds=new Set(), _appStartTime=Date.now();
let _taskChatUnsubscribe=null;
let _inactivityTimer=null;
let _pinBuffer={ setup:'', verify:'' };

// ── DB HELPERS (Realtime Database) ───────────────────
// Firestore ki jagah RTDB helper functions
async function dbSet(path, data)  { await set(ref(db, path), data); }
async function dbUpdate(path, data) { await update(ref(db, path), data); }
async function dbRemove(path)     { await remove(ref(db, path)); }
async function dbGet(path)        { const s = await get(ref(db, path)); return s.exists() ? s.val() : null; }
function dbPushKey(path)          { return push(ref(db, path)).key; }
async function dbPush(path, data) {
  const newRef = push(ref(db, path));
  await set(newRef, { ...data, id: newRef.key });
  return newRef.key;
}
function dbListen(path, cb) {
  const r = ref(db, path);
  onValue(r, snap => cb(snap.exists() ? snap.val() : null));
  return () => {}; // unsubscribe placeholder
}

function safeKey(email) { return email.replace(/\./g,'_').replace(/@/g,'__at__'); }

// ═══════════════════════════════════════════════════════
//  PIN SYSTEM
// ═══════════════════════════════════════════════════════

async function hashPIN(pin) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(pin + 'tps_wisefox_salt_2025'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function injectPINStyles() {
  if (document.getElementById('tpsPinStyles')) return;
  const s = document.createElement('style');
  s.id = 'tpsPinStyles';
  s.textContent = `
#tpsPinOverlay {
  position:fixed; inset:0; z-index:99999;
  background:linear-gradient(135deg,#0f0c29 0%,#1a1a4e 50%,#24243e 100%);
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; padding:20px;
}
#tpsPinOverlay.hidden { display:none; }
.tps-pin-card {
  background:rgba(255,255,255,0.05);
  backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:28px;
  padding:40px 32px 32px;
  width:340px; max-width:95vw;
  display:flex; flex-direction:column;
  align-items:center; gap:18px;
  box-shadow:0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
}
.tps-pin-app-logo {
  width:52px; height:52px; border-radius:14px;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex; align-items:center; justify-content:center;
  font-size:24px; box-shadow:0 8px 20px rgba(102,126,234,0.4);
  margin-bottom:-4px;
}
.tps-pin-photo {
  width:76px; height:76px; border-radius:50%;
  border:3px solid rgba(102,126,234,0.5);
  object-fit:cover;
}
.tps-pin-initials {
  width:76px; height:76px; border-radius:50%;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex; align-items:center; justify-content:center;
  font-size:28px; font-weight:700; color:#fff;
  border:3px solid rgba(102,126,234,0.5);
}
.tps-pin-lock-icon {
  width:60px; height:60px; border-radius:18px;
  background:rgba(102,126,234,0.18);
  border:1px solid rgba(102,126,234,0.3);
  display:flex; align-items:center; justify-content:center;
  font-size:28px;
}
.tps-pin-name  { font-size:16px; font-weight:700; color:#fff; margin-top:-6px; }
.tps-pin-email { font-size:12px; color:rgba(255,255,255,0.4); margin-top:-12px; }
.tps-pin-title { font-size:20px; font-weight:700; color:#fff; text-align:center; }
.tps-pin-sub   { font-size:12px; color:rgba(255,255,255,0.45); text-align:center; margin-top:-10px; line-height:1.6; }
.tps-pin-boxes { display:flex; gap:12px; margin:4px 0; }
.tps-pin-box {
  width:58px; height:66px; border-radius:16px;
  background:rgba(255,255,255,0.06);
  border:2px solid rgba(255,255,255,0.1);
  display:flex; align-items:center; justify-content:center;
  transition:all 0.2s;
}
.tps-pin-box.active { border-color:#667eea; box-shadow:0 0 0 4px rgba(102,126,234,0.2); background:rgba(102,126,234,0.1); }
.tps-pin-box.filled { border-color:#667eea; background:rgba(102,126,234,0.15); }
.tps-pin-dot { width:16px; height:16px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:none; box-shadow:0 2px 8px rgba(102,126,234,0.5); }
.tps-pin-box.filled .tps-pin-dot { display:block; }
.tps-pin-keypad { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; width:100%; max-width:260px; }
.tps-pin-key {
  height:56px; border-radius:14px;
  background:rgba(255,255,255,0.07);
  border:1px solid rgba(255,255,255,0.09);
  color:#fff; font-size:20px; font-weight:600;
  cursor:pointer; transition:all 0.15s;
  display:flex; align-items:center; justify-content:center;
  user-select:none;
}
.tps-pin-key:hover { background:rgba(102,126,234,0.25); border-color:rgba(102,126,234,0.5); }
.tps-pin-key:active { transform:scale(0.93); background:rgba(102,126,234,0.4); }
.tps-pin-key.empty { background:transparent; border-color:transparent; pointer-events:none; }
.tps-pin-unlock-btn {
  width:100%; height:52px; border-radius:14px;
  background:linear-gradient(135deg,#667eea,#764ba2);
  color:#fff; font-size:15px; font-weight:700;
  border:none; cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:8px;
  transition:all 0.2s; opacity:0.4; pointer-events:none;
  box-shadow:0 4px 16px rgba(102,126,234,0.3);
}
.tps-pin-unlock-btn.ready { opacity:1; pointer-events:all; box-shadow:0 8px 24px rgba(102,126,234,0.5); }
.tps-pin-unlock-btn.ready:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(102,126,234,0.6); }
.tps-pin-logout-btn { background:transparent; border:none; color:rgba(255,255,255,0.35); font-size:12px; cursor:pointer; padding:4px 8px; border-radius:8px; transition:color 0.2s; }
.tps-pin-logout-btn:hover { color:rgba(255,255,255,0.65); }
.tps-pin-footer { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:1.5px; text-transform:uppercase; text-align:center; }
.tps-pin-shake { animation:tpsPinShake 0.45s ease; }
@keyframes tpsPinShake {
  0%,100%{ transform:translateX(0); }
  20%{ transform:translateX(-9px); }
  40%{ transform:translateX(9px); }
  60%{ transform:translateX(-6px); }
  80%{ transform:translateX(6px); }
}`;
  document.head.appendChild(s);
}

function buildPINCard(mode, user) {
  const photoHTML = user?.photoURL
    ? `<img class="tps-pin-photo" src="${user.photoURL}" />`
    : `<div class="tps-pin-initials">${(user?.displayName||'U')[0].toUpperCase()}</div>`;
  if (mode === 'setup') {
    return `<div class="tps-pin-card">
      <div class="tps-pin-app-logo">⚡</div>${photoHTML}
      <div class="tps-pin-name">${user?.displayName||'User'}</div>
      <div class="tps-pin-email">${user?.email||''}</div>
      <div class="tps-pin-lock-icon">🔐</div>
      <div class="tps-pin-title">Set Security PIN</div>
      <div class="tps-pin-sub">4-digit PIN choose karo<br/>Har 30 din mein automatically reset hoga</div>
      <div class="tps-pin-boxes" id="pinBoxes_setup">
        <div class="tps-pin-box active"><div class="tps-pin-dot"></div></div>
        <div class="tps-pin-box"><div class="tps-pin-dot"></div></div>
        <div class="tps-pin-box"><div class="tps-pin-dot"></div></div>
        <div class="tps-pin-box"><div class="tps-pin-dot"></div></div>
      </div>
      <div class="tps-pin-keypad" id="pinKeypad_setup"></div>
      <button class="tps-pin-unlock-btn" id="pinActionBtn_setup" onclick="window._pinAction('setup')">🔒 Set PIN</button>
      <div class="tps-pin-footer">🛡 PROTECTED BY TPS · AES-256</div>
    </div>`;
  } else {
    return `<div class="tps-pin-card">
      ${photoHTML}
      <div class="tps-pin-name">${user?.displayName||'User'}</div>
      <div class="tps-pin-email">${user?.email||''}</div>
      <div class="tps-pin-lock-icon">🔒</div>
      <div class="tps-pin-title">Enter Security PIN</div>
      <div class="tps-pin-sub">4-digit PIN enter karein</div>
      <div class="tps-pin-boxes" id="pinBoxes_verify">
        <div class="tps-pin-box active"><div class="tps-pin-dot"></div></div>
        <div class="tps-pin-box"><div class="tps-pin-dot"></div></div>
        <div class="tps-pin-box"><div class="tps-pin-dot"></div></div>
        <div class="tps-pin-box"><div class="tps-pin-dot"></div></div>
      </div>
      <div class="tps-pin-keypad" id="pinKeypad_verify"></div>
      <button class="tps-pin-unlock-btn" id="pinActionBtn_verify" onclick="window._pinAction('verify')">🔓 Unlock Dashboard</button>
      <button class="tps-pin-logout-btn" onclick="window.logout()">↩ Logout & Switch Account</button>
      <div class="tps-pin-footer">🛡 PROTECTED BY TPS · AES-256</div>
    </div>`;
  }
}

function showPINOverlay(mode, user) {
  injectPINStyles();
  let overlay = document.getElementById('tpsPinOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'tpsPinOverlay'; document.body.appendChild(overlay); }
  overlay.classList.remove('hidden');
  overlay.innerHTML = buildPINCard(mode, user);
  window._activePinMode = mode;
  _pinBuffer[mode] = '';
  const kp = document.getElementById(`pinKeypad_${mode}`);
  ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(k => {
    const btn = document.createElement('button');
    btn.className = 'tps-pin-key' + (k===''?' empty':'');
    btn.textContent = k;
    if (k !== '') btn.onclick = () => k==='⌫' ? _pinBack(mode) : _pinDigit(k, mode);
    kp.appendChild(btn);
  });
  document.removeEventListener('keydown', _pinKeydown);
  document.addEventListener('keydown', _pinKeydown);
  setTimeout(() => overlay.style.opacity='1', 10);
}

function _pinKeydown(e) {
  const m = window._activePinMode; if (!m) return;
  if (e.key>='0'&&e.key<='9') _pinDigit(e.key, m);
  else if (e.key==='Backspace') _pinBack(m);
  else if (e.key==='Enter') window._pinAction(m);
}
function _pinDigit(d, mode) {
  if (_pinBuffer[mode].length >= 4) return;
  _pinBuffer[mode] += d;
  _refreshBoxes(mode);
  if (_pinBuffer[mode].length === 4) setTimeout(() => window._pinAction(mode), 280);
}
function _pinBack(mode) { _pinBuffer[mode] = _pinBuffer[mode].slice(0,-1); _refreshBoxes(mode); }
function _refreshBoxes(mode) {
  const val = _pinBuffer[mode];
  document.querySelectorAll(`#pinBoxes_${mode} .tps-pin-box`).forEach((box,i) => {
    box.classList.toggle('filled', i < val.length);
    box.classList.toggle('active', i === val.length);
  });
  const btn = document.getElementById(`pinActionBtn_${mode}`);
  if (btn) btn.classList.toggle('ready', val.length===4);
}
window._pinAction = async (mode) => {
  const pin = _pinBuffer[mode];
  if (pin.length !== 4) return;
  const k = safeKey(currentUser.email);
  if (mode === 'setup') {
    try {
      const hash = await hashPIN(pin);
      const now = Date.now();
      await dbSet(`userPins/${k}`, { pinHash:hash, email:currentUser.email, setAt:now, expiresAt:now+(PIN_EXPIRY_DAYS*86400000) });
      _closePINOverlay(); initApp();
    } catch(e) { toast('PIN save error: '+e.message, true); _pinShake(mode); }
  } else {
    try {
      const data = await dbGet(`userPins/${k}`);
      if (!data) { _pinShake(mode); return; }
      const ok = (await hashPIN(pin)) === data.pinHash;
      if (ok) { _closePINOverlay(); initApp(); }
      else _pinShake(mode);
    } catch(e) { _pinShake(mode); }
  }
};
function _pinShake(mode) {
  _pinBuffer[mode] = '';
  _refreshBoxes(mode);
  const boxes = document.getElementById(`pinBoxes_${mode}`);
  if (boxes) { boxes.classList.add('tps-pin-shake'); setTimeout(()=>boxes.classList.remove('tps-pin-shake'),500); }
  toast('❌ Wrong PIN', true);
}
function _closePINOverlay() {
  document.removeEventListener('keydown', _pinKeydown);
  window._activePinMode = null;
  const o = document.getElementById('tpsPinOverlay');
  if (o) { o.classList.add('hidden'); setTimeout(()=>o.remove(),300); }
}

async function showPINScreen(user) {
  const k = safeKey(user.email);
  try {
    const data = await dbGet(`userPins/${k}`);
    if (!data) {
      // Admin ke liye default PIN auto-set
      if (user.email === ADMIN_EMAIL) {
        const hash = await hashPIN(ADMIN_USER_PIN);
        const now = Date.now();
        await dbSet(`userPins/${k}`, { pinHash:hash, email:user.email, setAt:now, expiresAt:now+(PIN_EXPIRY_DAYS*86400000) });
        showPINOverlay('verify', user);
      } else {
        showPINOverlay('setup', user);
      }
    } else {
      if (Date.now() > data.expiresAt) {
        await dbRemove(`userPins/${k}`);
        toast('🔄 PIN expire ho gaya! Naya PIN set karo.');
        showPINOverlay('setup', user);
      } else {
        showPINOverlay('verify', user);
      }
    }
  } catch(e) { showPINOverlay('setup', user); }
}

function lockApp() {
  clearTimeout(_inactivityTimer);
  _pinBuffer.verify = '';
  showPINOverlay('verify', currentUser);
}

// ═══════════════════════════════════════════════════════
//  INACTIVITY AUTO-LOCK
// ═══════════════════════════════════════════════════════
function startInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => { lockApp(); toast('🔒 5 min inactivity — locked'); }, INACTIVITY_MS);
}
function resetInactivityTimer() {
  const overlay = document.getElementById('tpsPinOverlay');
  if (overlay && !overlay.classList.contains('hidden')) return;
  startInactivityTimer();
}
function setupInactivityListeners() {
  ['mousemove','keydown','click','touchstart','scroll'].forEach(ev => {
    document.addEventListener(ev, resetInactivityTimer, { passive:true });
  });
  startInactivityTimer();
}

// ── HELPERS ──────────────────────────────────────────
function toast(msg, isError=false) {
  const c = document.getElementById('toastContainer'); if(!c) return;
  const el = document.createElement('div');
  el.className = 'toast'+(isError?' error':'');
  el.innerHTML = msg;
  c.appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name)?.classList.add('active');
}
function showView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+name)?.classList.add('active');
  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(n=>n.classList.add('active'));
  if (name==='settings') loadApiKeyStatus();
  if (name==='dashboard') renderDashboard();
  // Close mobile sidebar on nav click
  if(window.innerWidth<=640) { window.closeMobileSidebar?.(); }
}
window.showView = showView;
function formatDate(ts) { if(!ts)return'—'; return new Date(ts).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function formatDateTime(ts) { if(!ts)return'—'; return new Date(ts).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }
function timeAgo(ts) {
  if(!ts)return''; const d=Date.now()-ts;
  if(d<60000)return'Just now';if(d<3600000)return Math.floor(d/60000)+'m ago';
  if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago';
}
function emptyState(icon,text) { return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`; }
function setEl(id,val) { const el=document.getElementById(id);if(el)el.textContent=val; }

window.shareApp = async () => {
  const shareData = { title: 'TPS Client Desk AI', text: 'Team aur task management — ek jagah.', url: window.location.origin };
  try { if (navigator.share) { await navigator.share(shareData); return; } } catch(e) {}
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(shareData.url); toast('📋 Link copied!'); }
};

// ═══════════════════════════════════════════════════════
//  AUTH — Google Login (Popup with Redirect fallback)
// ═══════════════════════════════════════════════════════

function resetLoginBtn() {
  const btn=document.getElementById('googleLoginBtn'), txt=document.getElementById('googleBtnText');
  if(btn) btn.disabled=false;
  if(txt) txt.innerHTML='<strong>Continue with Google</strong><br/><small style="font-weight:400;font-size:11px;color:#6b7280">Secure one-tap sign in</small>';
}
resetLoginBtn();

// Redirect result check (fallback se wapas aaya to)
getRedirectResult(auth).then(r => {
  if(r?.user) console.log('✅ Redirect login:', r.user.email);
  else resetLoginBtn();
}).catch(e => {
  resetLoginBtn();
  const ign=['auth/no-auth-event','auth/null-user','auth/missing-initial-state'];
  if(!ign.includes(e.code) && e.code!=='auth/popup-closed-by-user') showLoginError(buildAuthMsg(e.code));
});

function showLoginError(msg) {
  const el=document.getElementById('loginErrorMsg');
  if(el){el.textContent=msg;el.style.display='block';}else toast(msg,true);
  resetLoginBtn();
}
function buildAuthMsg(code, fallback='Login failed') {
  const host = window.location.hostname;
  if (code==='auth/unauthorized-domain') return `❌ Domain unauthorized: ${host}. Firebase Console → Auth → Settings → Authorized domains mein add karo.`;
  if (code==='auth/operation-not-allowed'||code==='auth/configuration-not-found') return '❌ Google sign-in disabled. Firebase Auth → Sign-in method → Google enable karo.';
  return fallback;
}

window.loginWithGoogle = async () => {
  const btn=document.getElementById('googleLoginBtn'), txt=document.getElementById('googleBtnText'), errEl=document.getElementById('loginErrorMsg');
  if(errEl) errEl.style.display='none';
  if(btn) btn.disabled=true;
  if(txt) txt.innerHTML='<strong>Signing in...</strong><br/><small style="color:#6b7280">Please wait...</small>';
  try {
    await signInWithPopup(auth, provider);
  } catch(e) {
    if(['auth/popup-blocked','auth/cancelled-popup-request'].includes(e.code)) {
      if(txt) txt.innerHTML='<strong>Redirecting...</strong>';
      try { await signInWithRedirect(auth, provider); return; } catch(e2) { showLoginError('Redirect failed: '+e2.message); }
    } else if(e.code==='auth/popup-closed-by-user') { resetLoginBtn(); }
    else { showLoginError(buildAuthMsg(e.code, 'Login failed: '+(e.message||e.code))); }
  }
};

window.logout = async () => {
  clearTimeout(_inactivityTimer);
  document.removeEventListener('keydown', _pinKeydown);
  window._activePinMode=null;
  await signOut(auth);
  currentUser=null;
  const o=document.getElementById('tpsPinOverlay'); if(o) o.remove();
  showScreen('login');
};

// Auth state listener
onAuthStateChanged(auth, async user => {
  if (user) {
    console.log('✅ Auth:', user.email);
    currentUser = user;
    try {
      currentRole   = await resolveRole(user);
      currentTeamId = await resolveTeam(user);
      await registerUser(user);
    } catch(e) { if(user.email===ADMIN_EMAIL) currentRole=ROLES.ADMIN; }
    showPINScreen(user);
  } else {
    showScreen('login');
    resetLoginBtn();
  }
});

async function resolveRole(user) {
  if(user.email===ADMIN_EMAIL) return ROLES.ADMIN;
  try {
    const data = await dbGet(`roles/${safeKey(user.email)}`);
    if(data) return data.role || ROLES.MEMBER;
  } catch(e) {}
  return ROLES.MEMBER;
}
async function resolveTeam(user) {
  try {
    const data = await dbGet(`roles/${safeKey(user.email)}`);
    if(data?.teamId) return data.teamId;
  } catch(e) {}
  return null;
}
async function registerUser(user) {
  const k = safeKey(user.email);
  try {
    const existing = await dbGet(`users/${k}`);
    const data = { name:user.displayName||user.email.split('@')[0], email:user.email, photo:user.photoURL||'', lastSeen:Date.now() };
    if(!existing) { data.createdAt=Date.now(); await dbSet(`users/${k}`, data); }
    else await dbUpdate(`users/${k}`, data);
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════
//  APP INIT — called AFTER PIN verified
// ═══════════════════════════════════════════════════════
function initApp() {
  console.log('🚀 initApp role:', currentRole, 'team:', currentTeamId);
  showScreen('app');
  setupSidebar();
  // Browser notification permission maango
  if(Notification.permission==='default') {
    Notification.requestPermission().then(perm => {
      if(perm==='granted') toast('🔔 Notifications enabled! Reminders milenge.');
    }).catch(()=>{});
  }
  const adminNav=document.getElementById('adminNav'), leaderNav=document.getElementById('leaderNav'), memberNav=document.getElementById('memberNav'), roleEl=document.getElementById('sidebarRole');
  if(currentRole===ROLES.ADMIN) {
    if(adminNav) adminNav.style.display='block';
    if(leaderNav) leaderNav.style.display='block';
    if(roleEl){roleEl.textContent='⚡ Admin';roleEl.classList.add('admin');}
    initLeaderModules(); initAdminModule(); showView('dashboard');
  } else if(currentRole===ROLES.LEADER) {
    if(leaderNav) leaderNav.style.display='block';
    if(roleEl) roleEl.textContent='👑 Leader';
    initLeaderModules(); showView('dashboard');
  } else {
    if(memberNav) memberNav.style.display='block';
    if(roleEl){roleEl.textContent='🧑‍💼 Staff';roleEl.classList.add('member');}
    initMemberModules(); showView('my-tasks');
  }
  initAIFloat();
  setInterval(checkReminders, 60000);
  setupInactivityListeners();
  setupLiveNotifications();
  console.log('✅ App ready');
}

function setupSidebar() {
  const av=document.getElementById('sidebarAvatar');
  if(currentUser.photoURL) av.innerHTML=`<img src="${currentUser.photoURL}"/>`;
  else av.textContent=(currentUser.displayName||'U')[0].toUpperCase();
  // Sync mobile avatar
  const mav=document.getElementById('mobileAvatar');
  if(mav){ if(currentUser.photoURL) mav.innerHTML=`<img src="${currentUser.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
  else mav.textContent=(currentUser.displayName||'U')[0].toUpperCase(); }
  document.getElementById('sidebarName').textContent=currentUser.displayName||currentUser.email;
  const dn=document.getElementById('dashName'); if(dn) dn.textContent=(currentUser.displayName||'Leader').split(' ')[0];
}

// ── Mobile Sidebar Toggle ──
window.toggleMobileSidebar = () => {
  const sidebar=document.getElementById('mainSidebar');
  const overlay=document.getElementById('sidebarOverlay');
  const ham=document.querySelector('.hamburger');
  const isOpen=sidebar.classList.contains('mobile-open');
  if(isOpen){ sidebar.classList.remove('mobile-open'); overlay.classList.remove('show'); ham?.classList.remove('open'); }
  else { sidebar.classList.add('mobile-open'); overlay.classList.add('show'); ham?.classList.add('open'); }
};
window.closeMobileSidebar = () => {
  document.getElementById('mainSidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
  document.querySelector('.hamburger')?.classList.remove('open');
};
function initLeaderModules(){subscribeMembers();subscribeTasks();subscribeClients();subscribeNotes();subscribeReminders();}
function initMemberModules(){subscribeTasks();subscribeReminders();}

// ═══════════════════════════════════════════════════════
//  BROWSER PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════
function notifyBrowser(title, body, tag='tps-notify'){
  if(Notification.permission!=='granted') return;
  try {
    const n=new Notification(title, {body:body?.substring(0,100)||'', icon:'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', tag, badge:'', vibrate:[200,100,200], requireInteraction:false, silent:false });
    n.onclick=()=>{ window.focus(); n.close(); };
    setTimeout(()=>n.close(), 8000);
  } catch(e){}
}

function setupTaskChatNotifications(){
  allTasks.forEach(t=>{
    if(_chatNotifySet.has(t.id)) return;
    const isMine = t.assigneeEmail===currentUser.email || t.createdBy===currentUser.email;
    if(!isMine) return;
    _chatNotifySet.add(t.id);
    const notifyAfter = Date.now();
    onChildAdded(ref(db,`taskChats/${t.id}`), snap=>{
      const msg=snap.val();
      if(!msg || msg.by===currentUser.email || msg.ts<=notifyAfter) return;
      const sender = msg.name||msg.by.split('@')[0];
      const taskTitle = t.title?.substring(0,40)||'Task';
      notifyBrowser(`💬 ${sender}: "${taskTitle}"`, msg.text, `chat-${t.id}`);
      toast(`💬 <strong>${sender}</strong>: ${msg.text?.substring(0,60)}`);
    });
  });
}

// ── Self Task Creation (Members + Leaders for themselves) ──
window.createMyTask = async () => {
  const title=document.getElementById('myTaskTitle')?.value.trim();
  const desc=document.getElementById('myTaskDesc')?.value.trim();
  const priority=document.getElementById('myTaskPriority')?.value||'medium';
  const dueDate=document.getElementById('myTaskDue')?.value;
  if(!title) return toast('Task title required',true);
  try {
    await dbPush('tasks',{title,desc:desc||'',assigneeEmail:currentUser.email,assigneeName:currentUser.displayName||currentUser.email,priority,dueDate:dueDate||'',status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||currentUser.email,source:'self'});
    toast('✅ Task added!');
    ['myTaskTitle','myTaskDesc','myTaskDue'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e){toast('Error: '+e.message,true);}
};

// ── Self Reminder Creation (Members) ──
window.createMyReminder = async () => {
  const title=document.getElementById('myRemTitle')?.value.trim();
  const timeVal=document.getElementById('myRemTime')?.value;
  const forVal=document.getElementById('myRemFor')?.value||'self';
  if(!title||!timeVal) return toast('Title aur time dono zaroori hain',true);
  const forEmail = forVal==='all' ? 'all' : currentUser.email;
  try {
    await dbPush('reminders',{title,time:new Date(timeVal).getTime(),forEmail,status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||currentUser.email});
    toast('🔔 Reminder set!');
    document.getElementById('myRemTitle').value='';
    document.getElementById('myRemTime').value='';
  } catch(e){toast('Error: '+e.message,true);}
};

// ═══════════════════════════════════════════════════════
//  MEMBERS MODULE (Realtime Database)
// ═══════════════════════════════════════════════════════
function subscribeMembers() {
  onValue(ref(db,'users'), usersSnap => {
    onValue(ref(db,'roles'), rolesSnap => {
      const roles = rolesSnap.val() || {};
      allMembers = [];
      const usersObj = usersSnap.val() || {};
      Object.entries(usersObj).forEach(([k,u]) => {
        const r = roles[k] || {};
        const member = {...u, id:k, role:r.role||'member', teamId:r.teamId||''};
        if(currentTeamId) { if(r.teamId===currentTeamId||u.email===currentUser.email) allMembers.push(member); }
        else allMembers.push(member);
      });
      renderMembers(); populateAssigneeSelect(); populateReminderMemberSelect(); setEl('statMembers',allMembers.length);
    }, {onlyOnce:true});
  });
}

function renderMembers(){
  const el=document.getElementById('memberGrid'); if(!el) return;
  if(!allMembers.length){el.innerHTML=emptyState('👥','No team members yet');return;}
  el.innerHTML=allMembers.map(m=>`<div class="member-card">
    <div class="member-avatar-lg">${m.photo?`<img src="${m.photo}"/>`:(m.name||'?')[0]}</div>
    <div class="member-name">${m.name||'—'}</div>
    <div class="member-email">${m.email}</div>
    <span class="tag" style="margin:6px 0">${m.role||'member'}</span>
  </div>`).join('');
}

window.inviteMember = async () => {
  const email=document.getElementById('inviteEmail')?.value.trim().toLowerCase();
  const name=document.getElementById('inviteName')?.value.trim();
  if(!email||!email.includes('@')) return toast('Valid email required',true);
  const k=safeKey(email);
  try {
    const existing = await dbGet(`users/${k}`);
    if(!existing) await dbSet(`users/${k}`, {email, name:name||email.split('@')[0], photo:'', createdAt:Date.now()});
    await dbSet(`roles/${k}`, {role:'member', email, teamId:currentTeamId||'', updatedAt:Date.now()});
    if(currentTeamId) await dbUpdate(`teams/${currentTeamId}/members/${k}`, {email, addedAt:Date.now()});
    toast(`✅ ${email} added as member`);
    ['inviteEmail','inviteName'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { toast('Error: '+e.message,true); }
};

function populateAssigneeSelect(){
  const el=document.getElementById('taskAssignee'); if(!el) return;
  el.innerHTML='<option value="">Select Member...</option>'+allMembers.filter(m=>m.role!=='admin').map(m=>`<option value="${m.email}">${m.name||m.email}</option>`).join('');
}
function populateReminderMemberSelect(){
  const el=document.getElementById('remMember'); if(!el) return;
  el.innerHTML='<option value="all">All Members</option>'+allMembers.map(m=>`<option value="${m.email}">${m.name||m.email}</option>`).join('');
}

// ═══════════════════════════════════════════════════════
//  TASKS MODULE (Realtime Database)
// ═══════════════════════════════════════════════════════
function subscribeTasks(){
  onValue(ref(db,'tasks'), snap => {
    const raw = [];
    const obj = snap.val() || {};
    Object.entries(obj).forEach(([k,v]) => raw.push({...v, id:k}));
    if(currentRole===ROLES.MEMBER) allTasks=raw.filter(t=>t.assigneeEmail===currentUser.email||t.createdBy===currentUser.email);
    else if(currentRole===ROLES.LEADER) allTasks=raw.filter(t=>t.teamId===currentTeamId||t.createdBy===currentUser.email);
    else allTasks=raw;

    // Notify on new task assignment
    allTasks.forEach(t=>{
      if(!_knownTaskIds.has(t.id)){
        if(t.assigneeEmail===currentUser.email && t.createdBy!==currentUser.email && t.createdAt>_appStartTime){
          notifyBrowser(`📋 Naya Task Assign Hua!`, `"${t.title}" — by ${t.createdByName||t.createdBy}`, `task-${t.id}`);
          toast(`📋 New task: <strong>${t.title}</strong>`);
        }
        _knownTaskIds.add(t.id);
      }
    });

    renderAllTasksList(); renderMyTasks(); renderRecentTasks(); updateTaskBadge(); renderDashboard(); renderMyProgress();
    setupTaskChatNotifications();
  });
}

function renderMyTasks(){
  const el=document.getElementById('myTasksList'); if(!el) return;
  if(!allTasks.length){el.innerHTML=emptyState('📋','No tasks assigned yet');return;}
  el.innerHTML=allTasks.map(t=>memberTaskCard(t)).join('');
}
function memberTaskCard(t){
  const ov=t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=='done';
  return `<div class="task-item${ov?' overdue-task':''}">
    <div class="task-status-pill">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title${t.status==='done'?' done':''}">${t.title}</div>
      ${t.desc?`<div class="task-desc">${t.desc}</div>`:''}
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag status-${t.status||'pending'}">${t.status||'pending'}</span>
        ${t.dueDate?`<span class="tag${ov?' tag-danger':''}">📅 ${t.dueDate}</span>`:''}
      </div>
    </div>
    <div class="task-actions"><button class="btn-sm btn-update" onclick="openTaskUpdate('${t.id}')">💬 Update</button></div>
  </div>`;
}
function renderAllTasksList(filter){
  if(filter) tasksFilter=filter;
  const el=document.getElementById('allTasksList'); if(!el) return;
  const now=new Date(); let tasks=allTasks;
  if(tasksFilter==='pending')tasks=allTasks.filter(t=>t.status==='pending');
  else if(tasksFilter==='inprogress')tasks=allTasks.filter(t=>t.status==='inprogress');
  else if(tasksFilter==='review')tasks=allTasks.filter(t=>t.status==='review');
  else if(tasksFilter==='done')tasks=allTasks.filter(t=>t.status==='done');
  else if(tasksFilter==='overdue')tasks=allTasks.filter(t=>t.dueDate&&new Date(t.dueDate)<now&&t.status!=='done');
  if(!tasks.length){el.innerHTML=emptyState('📋','No tasks found');return;}
  el.innerHTML=tasks.map(t=>leaderTaskCard(t)).join('');
}
window.filterTasks=(f)=>renderAllTasksList(f);

function leaderTaskCard(t){
  const ov=t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=='done';
  return `<div class="task-item${ov?' overdue-task':''}">
    <div class="task-status-pill">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title${t.status==='done'?' done':''}">${t.title}</div>
      ${t.desc?`<div class="task-desc">${t.desc}</div>`:''}
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag status-${t.status||'pending'}">${t.status||'pending'}</span>
        ${t.dueDate?`<span class="tag${ov?' tag-danger':''}">📅 ${t.dueDate}</span>`:''}
        <span class="tag">👤 ${t.assigneeName||t.assigneeEmail||'—'}</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-sm btn-update" onclick="openTaskUpdate('${t.id}')">💬</button>
      <button class="btn-sm btn-done" onclick="cycleTaskStatus('${t.id}','${t.status}')">⟳</button>
      <button class="btn-sm btn-del" onclick="deleteTask('${t.id}')">🗑</button>
    </div>
  </div>`;
}
function renderRecentTasks(){
  const el=document.getElementById('recentTasksList'); if(!el) return;
  const recent=[...allTasks].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  if(!recent.length){el.innerHTML=emptyState('📋','No tasks yet');return;}
  el.innerHTML=recent.map(t=>`<div class="task-item compact"><div class="task-status-pill">${statusIcon(t.status)}</div><div class="task-body"><div class="task-title">${t.title}</div><div class="task-meta"><span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span><span class="tag">👤 ${t.assigneeName||'—'}</span></div></div></div>`).join('');
}
function statusIcon(s){return s==='done'?'✅':s==='inprogress'?'🔄':s==='review'?'👁':'⏳';}
function updateTaskBadge(){const p=allTasks.filter(t=>t.status!=='done').length;['taskBadge','myTaskBadge'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=p;});}

window.createTask = async () => {
  const title=document.getElementById('taskTitle')?.value.trim();
  const desc=document.getElementById('taskDesc')?.value.trim();
  const email=document.getElementById('taskAssignee')?.value;
  const priority=document.getElementById('taskPriority')?.value||'medium';
  const dueDate=document.getElementById('taskDue')?.value;
  const clientId=document.getElementById('taskClient')?.value;
  if(!title) return toast('Task title required',true);
  if(!email) return toast('Select assignee',true);
  const member=allMembers.find(m=>m.email===email)||{email,name:email};
  const cSelect=document.getElementById('taskClient');
  const clientName=clientId&&cSelect?cSelect.options[cSelect.selectedIndex]?.text||'':'';
  try {
    await dbPush('tasks', {title,desc:desc||'',assigneeEmail:member.email,assigneeName:member.name||member.email,priority,dueDate:dueDate||'',status:'pending',clientId:clientId||'',clientName:clientId?clientName:'',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||''});
    toast('✅ Task assigned!');
    ['taskTitle','taskDesc','taskDue'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { toast('Error: '+e.message,true); }
};
window.resetTaskForm = () => {
  ['taskTitle','taskDesc','taskDue'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const ta=document.getElementById('taskAssignee');if(ta)ta.value='';
  const tc=document.getElementById('taskClient');if(tc)tc.value='';
};
window.deleteTask = async (id) => { if(!confirm('Delete task?'))return; await dbRemove(`tasks/${id}`); toast('Task deleted'); };
window.cycleTaskStatus = async (id,current) => {
  const order=['pending','inprogress','review','done'];
  const next=order[(order.indexOf(current)+1)%order.length];
  await dbUpdate(`tasks/${id}`, {status:next, updatedAt:Date.now()});
  toast(`Status → ${next}`);
};

// Task Chat / Update
window.openTaskUpdate = (id) => {
  currentTaskId=id;
  const t=allTasks.find(t=>t.id===id); if(!t) return;
  document.getElementById('taskUpdateTitle').textContent=t.title||'Task';
  document.getElementById('taskUpdateStatus').value=t.status||'pending';
  const asgn=document.getElementById('taskUpdateAssignee');
  if(asgn) asgn.textContent='👤 '+(t.assigneeName||t.assigneeEmail||'—');
  const dueEl=document.getElementById('taskUpdateDue');
  if(dueEl) dueEl.textContent=t.dueDate?'📅 '+t.dueDate:'';
  const cby=document.getElementById('taskChatCreatedBy');
  if(cby) cby.textContent=t.createdByName?'Created by '+t.createdByName:'';
  const msgs=document.getElementById('taskChatMessages');
  if(msgs) msgs.innerHTML='<div class="chat-empty-state"><div style="font-size:32px">💬</div><div>Loading...</div></div>';

  // Unsubscribe previous listener
  if(_taskChatUnsubscribe){ _taskChatUnsubscribe(); _taskChatUnsubscribe=null; }

  const unsub=onValue(ref(db,`taskChats/${id}`), snap => {
    if(!msgs) return;
    const obj=snap.val()||{};
    const chats=Object.values(obj).sort((a,b)=>a.ts-b.ts);
    if(!chats.length){
      msgs.innerHTML='<div class="chat-empty-state"><div style="font-size:32px">💬</div><div>Yahan conversation shuru karo</div><div style="font-size:11px;margin-top:4px">Task update, sawaal ya progress share karo</div></div>';
      return;
    }
    msgs.innerHTML=chats.map(c=>{
      const isMe=c.by===currentUser.email;
      const initials=(c.name||c.by||'?')[0].toUpperCase();
      return `<div class="task-chat-msg-wrap ${isMe?'mine':'theirs'}">
        ${!isMe?`<div class="chat-avatar-sm">${initials}</div>`:''}
        <div class="chat-msg-inner">
          <div class="chat-meta-name">${isMe?'Aap':c.name||c.by.split('@')[0]}</div>
          <div class="chat-bubble">${c.text.replace(/\n/g,'<br/>')}</div>
          <div class="chat-meta-time">${formatDateTime(c.ts)}</div>
        </div>
        ${isMe?`<div class="chat-avatar-sm me">${initials}</div>`:''}
      </div>`;
    }).join('');
    msgs.scrollTop=msgs.scrollHeight;
  });
  _taskChatUnsubscribe = unsub;
  openModal('taskUpdateModal');
};

window.closeTaskChat = () => {
  closeModal('taskUpdateModal');
  if(_taskChatUnsubscribe){ _taskChatUnsubscribe(); _taskChatUnsubscribe=null; }
};

window.sendTaskChat = async () => {
  const input=document.getElementById('taskChatInput');
  const text=input?.value.trim(); if(!text||!currentTaskId) return;
  input.value='';
  const msgData = {text, by:currentUser.email, name:currentUser.displayName||'', ts:Date.now()};
  await dbPush(`taskChats/${currentTaskId}`, msgData);
  // Notify the other party
  const task=allTasks.find(t=>t.id===currentTaskId);
  if(task){
    const notifyEmail = currentUser.email===task.assigneeEmail ? task.createdBy : task.assigneeEmail;
    if(notifyEmail && notifyEmail!==currentUser.email){
      await dbPush(`notifications/${safeKey(notifyEmail)}`,{
        type:'chat', taskId:currentTaskId, taskTitle:task.title,
        from:currentUser.displayName||currentUser.email, text, ts:Date.now(), read:false
      });
    }
  }
};
window.updateTaskStatus = async () => {
  const s=document.getElementById('taskUpdateStatus')?.value;
  if(!currentTaskId||!s) return;
  await dbUpdate(`tasks/${currentTaskId}`, {status:s, updatedAt:Date.now()});
  toast('Status updated');
};
window.taskChatKeyDown = (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTaskChat();} };

// ═══════════════════════════════════════════════════════
//  CLIENTS MODULE (Realtime Database)
// ═══════════════════════════════════════════════════════
function subscribeClients(){
  onValue(ref(db,'clients'), snap => {
    const obj=snap.val()||{};
    let raw=Object.entries(obj).map(([k,v])=>({...v,id:k}));
    if(currentRole===ROLES.LEADER) raw=raw.filter(c=>c.teamId===currentTeamId);
    allClients=raw;
    renderClients(); populateClientSelect(); setEl('statClients',allClients.length);
  });
}

function renderClients(){
  const el=document.getElementById('clientGrid'); if(!el) return;
  const q=(document.getElementById('clientSearch')?.value||'').toLowerCase();
  let list=allClients;
  if(q) list=list.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q));
  if(!list.length){el.innerHTML=emptyState('🏢','No clients yet');return;}
  el.innerHTML=list.map(c=>`<div class="client-card" onclick="openClientDetail('${c.id}')">
    <div class="client-avatar">${(c.name||'C')[0].toUpperCase()}</div>
    <div class="client-info">
      <div class="client-name">${c.name}</div>
      <div class="client-phone">${c.phone||'—'} ${c.city?'· '+c.city:''}</div>
      <div class="client-meta"><span class="tag">${c.type||'retail'}</span></div>
    </div>
    <div class="client-outstanding">₹${Number(c.outstanding||0).toLocaleString('en-IN')}<div style="font-size:10px;color:var(--muted)">due</div></div>
  </div>`).join('');
}
window.filterClients = () => renderClients();

window.addClient = async () => {
  const name=document.getElementById('cName')?.value.trim(), phone=document.getElementById('cPhone')?.value.trim();
  if(!name||!phone) return toast('Name and phone required',true);
  const email=document.getElementById('cEmail')?.value.trim(), type=document.getElementById('cType')?.value;
  const city=document.getElementById('cCity')?.value.trim(), gst=document.getElementById('cGst')?.value.trim();
  const address=document.getElementById('cAddress')?.value.trim(), notes=document.getElementById('cNotes')?.value.trim();
  try {
    await dbPush('clients', {name,phone,email:email||'',type:type||'retail',city:city||'',gst:gst||'',address:address||'',notes:notes||'',outstanding:0,totalPaid:0,totalBilled:0,teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email});
    toast('✅ Client added!'); closeModal('addClientModal');
    ['cName','cPhone','cEmail','cCity','cGst','cAddress','cNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { toast('Error: '+e.message,true); }
};

window.openClientDetail = async (clientId) => {
  viewingClientId=clientId;
  const client=allClients.find(c=>c.id===clientId); if(!client) return;
  const av=document.getElementById('cdAvatar'); if(av) av.textContent=(client.name||'C')[0].toUpperCase();
  document.getElementById('cdName').textContent=client.name;
  const sub=document.getElementById('cdSubInfo'); if(sub) sub.textContent=`${client.phone||'—'} ${client.city?'· '+client.city:''}`;
  document.getElementById('cdOutstanding').textContent='₹'+Number(client.outstanding||0).toLocaleString('en-IN');
  document.getElementById('cdTotalBilled').textContent='₹'+Number(client.totalBilled||0).toLocaleString('en-IN');
  document.getElementById('cdTotalPaid').textContent='₹'+Number(client.totalPaid||0).toLocaleString('en-IN');
  const today=new Date().toISOString().split('T')[0];
  ['orderDate','payDate'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.value)e.value=today;});
  loadClientOrders(clientId); loadClientPayments(clientId); loadClientContacts(clientId); openModal('clientDetailModal');
};
window.switchClientTab = (name,el) => {
  ['orders','payments','contacts'].forEach(t=>{document.getElementById('clientTab-'+t).style.display=t===name?'block':'none';});
  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active')); if(el) el.classList.add('active');
};

window.addOrder = async () => {
  if(!viewingClientId) return;
  const desc=document.getElementById('orderDesc')?.value.trim(), amount=parseFloat(document.getElementById('orderAmount')?.value)||0;
  const date=document.getElementById('orderDate')?.value, status=document.getElementById('orderStatus')?.value;
  if(!desc) return toast('Order description required',true);
  try {
    await dbPush(`clientOrders/${viewingClientId}`, {desc,amount,date:date||new Date().toISOString().split('T')[0],status:status||'pending',createdAt:Date.now(),createdBy:currentUser.email});
    const client=allClients.find(c=>c.id===viewingClientId);
    await dbUpdate(`clients/${viewingClientId}`, {totalBilled:(client?.totalBilled||0)+amount, outstanding:(client?.outstanding||0)+amount});
    toast('Order added'); document.getElementById('orderDesc').value=''; document.getElementById('orderAmount').value='';
  } catch(e) { toast('Error: '+e.message,true); }
};
function loadClientOrders(clientId){
  const el=document.getElementById('clientOrdersList'); if(!el) return;
  onValue(ref(db,`clientOrders/${clientId}`), snap => {
    const obj=snap.val()||{};
    let orders=Object.values(obj).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!orders.length){el.innerHTML=emptyState('📦','No orders yet');return;}
    el.innerHTML=orders.map(o=>`<div class="order-row"><div class="order-info"><div class="order-desc">${o.desc}</div><div class="order-meta">${o.date||'—'} · <span class="tag status-${o.status||'pending'}">${o.status||'pending'}</span></div></div><div class="order-amount">₹${Number(o.amount||0).toLocaleString('en-IN')}</div></div>`).join('');
  });
}
window.addPayment = async () => {
  if(!viewingClientId) return;
  const amount=parseFloat(document.getElementById('payAmount')?.value)||0, mode=document.getElementById('payMode')?.value;
  const refNo=document.getElementById('payRef')?.value.trim(), date=document.getElementById('payDate')?.value;
  if(!amount) return toast('Amount required',true);
  try {
    await dbPush(`clientPayments/${viewingClientId}`, {amount,mode:mode||'cash',ref:refNo||'',date:date||new Date().toISOString().split('T')[0],createdAt:Date.now(),createdBy:currentUser.email});
    const client=allClients.find(c=>c.id===viewingClientId);
    await dbUpdate(`clients/${viewingClientId}`, {totalPaid:(client?.totalPaid||0)+amount, outstanding:Math.max(0,(client?.outstanding||0)-amount)});
    toast('✅ Payment recorded'); document.getElementById('payAmount').value=''; document.getElementById('payRef').value='';
    document.getElementById('cdOutstanding').textContent='₹'+Math.max(0,(client?.outstanding||0)-amount).toLocaleString('en-IN');
  } catch(e) { toast('Error: '+e.message,true); }
};
function loadClientPayments(clientId){
  const el=document.getElementById('clientPaymentsList'); if(!el) return;
  onValue(ref(db,`clientPayments/${clientId}`), snap => {
    const obj=snap.val()||{};
    let pays=Object.values(obj).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!pays.length){el.innerHTML=emptyState('💰','No payments yet');return;}
    el.innerHTML=pays.map(p=>`<div class="payment-row"><div class="pay-icon">💰</div><div class="pay-info"><div class="pay-mode">${p.mode||'cash'} ${p.ref?'· '+p.ref:''}</div><div class="pay-date">${p.date||'—'}</div></div><div class="pay-amount" style="color:var(--accent)">+₹${Number(p.amount||0).toLocaleString('en-IN')}</div></div>`).join('');
  });
}
window.addContact = async () => {
  if(!viewingClientId) return;
  const cName=document.getElementById('contactName')?.value.trim(), cPhone=document.getElementById('contactPhone')?.value.trim(), cRole=document.getElementById('contactRole')?.value.trim();
  if(!cName||!cPhone) return toast('Name and phone required',true);
  try { await dbPush(`clientContacts/${viewingClientId}`, {name:cName,phone:cPhone,role:cRole||'',createdAt:Date.now()}); toast('Contact added'); ['contactName','contactPhone','contactRole'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';}); } catch(e) { toast('Error: '+e.message,true); }
};
function loadClientContacts(clientId){
  const el=document.getElementById('clientContactsList'); if(!el) return;
  onValue(ref(db,`clientContacts/${clientId}`), snap => {
    const obj=snap.val()||{};
    let contacts=Object.values(obj);
    if(!contacts.length){el.innerHTML=emptyState('📞','No contacts yet');return;}
    el.innerHTML=contacts.map(c=>`<div class="contact-row"><div class="contact-avatar">${(c.name||'C')[0]}</div><div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-sub">${c.phone} ${c.role?'· '+c.role:''}</div></div><a href="tel:${c.phone}" class="btn-sm btn-done">📞</a></div>`).join('');
  });
}
function populateClientSelect(){
  const el=document.getElementById('taskClient'); if(!el) return;
  el.innerHTML='<option value="">No Client</option>'+allClients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

// ═══════════════════════════════════════════════════════
//  NOTES MODULE (Realtime Database)
// ═══════════════════════════════════════════════════════
function subscribeNotes(){
  const ownerKey=safeKey(currentUser.email);
  onValue(ref(db,'notes'), snap => {
    const obj=snap.val()||{};
    allNotes=Object.entries(obj).filter(([k,v])=>v.ownerKey===ownerKey).map(([k,v])=>({...v,id:k}));
    allNotes.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    renderNoteList();
  });
}
function renderNoteList(){
  const el=document.getElementById('noteList'); if(!el) return;
  const q=(document.getElementById('noteSearch')?.value||'').toLowerCase();
  let notes=allNotes;
  if(q) notes=notes.filter(n=>(n.title||'').toLowerCase().includes(q)||(n.content||'').toLowerCase().includes(q));
  if(!notes.length){el.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">No notes yet</div>';return;}
  el.innerHTML=notes.map(n=>`<div class="note-list-item${activeNoteId===n.id?' active':''}" onclick="openNoteById('${n.id}')" style="border-left:3px solid ${n.color||'var(--surface2)'}"><div class="note-list-title">${n.title||'Untitled'}</div><div class="note-list-preview">${(n.content||'').substring(0,60)}</div><div class="note-list-date">${formatDate(n.updatedAt||n.createdAt)}</div></div>`).join('');
}
window.openNoteById = (id) => {
  const n=allNotes.find(n=>n.id===id); if(!n) return;
  activeNoteId=id;
  document.getElementById('noteEditorTitle').value=n.title||'';
  document.getElementById('noteEditorContent').value=n.content||'';
  document.getElementById('noteEditorContent').style.background=n.color||'var(--surface)';
  document.getElementById('noteCategory').value=n.category||'';
  document.querySelectorAll('.note-color-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.color===(n.color||'#181c24')));
  const empty=document.getElementById('noteEmptyState'); if(empty) empty.style.display='none';
  renderNoteList();
};
window.newNote = async () => {
  try {
    const id=await dbPush('notes', {title:'',content:'',category:'',color:'#181c24',ownerKey:safeKey(currentUser.email),createdAt:Date.now(),updatedAt:Date.now(),createdBy:currentUser.email});
    activeNoteId=id; setTimeout(()=>openNoteById(id),300);
  } catch(e) { toast('Error: '+e.message,true); }
};
window.saveNote = async () => {
  if(!activeNoteId) return;
  const title=document.getElementById('noteEditorTitle')?.value.trim()||'Untitled';
  const content=document.getElementById('noteEditorContent')?.value||'';
  const category=document.getElementById('noteCategory')?.value||'';
  const color=document.querySelector('.note-color-btn.active')?.dataset.color||'#181c24';
  try { await dbUpdate(`notes/${activeNoteId}`, {title,content,category,color,updatedAt:Date.now()}); } catch(e) {}
};
window.deleteCurrentNote = async () => {
  if(!activeNoteId) return; if(!confirm('Delete this note?')) return;
  await dbRemove(`notes/${activeNoteId}`); activeNoteId=null;
  document.getElementById('noteEditorTitle').value=''; document.getElementById('noteEditorContent').value='';
  const empty=document.getElementById('noteEmptyState'); if(empty) empty.style.display='flex';
  toast('Note deleted');
};
window.setNoteColor = (color) => {
  document.querySelectorAll('.note-color-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.color===color));
  const c=document.getElementById('noteEditorContent'); if(c) c.style.background=color; noteAutoSave();
};
let _noteTimer;
window.noteAutoSave = () => { clearTimeout(_noteTimer); _noteTimer=setTimeout(saveNote,1500); };
window.renderNoteList = renderNoteList;

// ═══════════════════════════════════════════════════════
//  REMINDERS MODULE (Realtime Database + Browser Notifications)
// ═══════════════════════════════════════════════════════
function subscribeReminders(){
  onValue(ref(db,'reminders'), snap => {
    const obj=snap.val()||{};
    const raw=Object.entries(obj).map(([k,v])=>({...v,id:k}));
    if(currentRole===ROLES.ADMIN) allReminders=raw;
    else if(currentRole===ROLES.LEADER) allReminders=raw.filter(r=>r.teamId===currentTeamId||r.createdBy===currentUser.email);
    else allReminders=raw.filter(r=>
      r.forEmail===currentUser.email ||
      r.createdBy===currentUser.email ||
      (r.forEmail==='all'&&r.teamId===currentTeamId)
    );
    renderReminders(); renderMyReminders(); renderDashReminders(); updateReminderBadge();
  });
}
function renderReminders(){
  const el=document.getElementById('remindersList'); if(!el) return;
  if(!allReminders.length){el.innerHTML=emptyState('🔔','No reminders set');return;}
  const now=Date.now();
  el.innerHTML=allReminders.map(r=>{
    const ov=r.time<now&&r.status!=='done';
    return `<div class="reminder-item">
      <div class="reminder-icon">${ov?'⚠️':r.status==='done'?'✅':'🔔'}</div>
      <div class="reminder-body">
        <div class="reminder-title">${r.title}</div>
        <div class="reminder-time${ov?' overdue':''}">${formatDateTime(r.time)} ${r.forEmail&&r.forEmail!=='all'?'· '+r.forEmail:r.forEmail==='all'?'· All':''}</div>
      </div>
      <div style="display:flex;gap:6px">
        ${r.status!=='done'?`<button class="btn-sm btn-done" onclick="doneReminder('${r.id}')">✅</button>`:''}
        <button class="btn-sm btn-del" onclick="deleteReminder('${r.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}
function renderMyReminders(){
  const el=document.getElementById('myRemindersList'); if(!el) return;
  if(!allReminders.length){el.innerHTML=emptyState('🔔','No reminders');return;}
  const now=Date.now();
  el.innerHTML=allReminders.map(r=>{const ov=r.time<now&&r.status!=='done';return`<div class="reminder-item"><div class="reminder-icon">${ov?'⚠️':r.status==='done'?'✅':'🔔'}</div><div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time${ov?' overdue':''}">${formatDateTime(r.time)}</div></div></div>`;}).join('');
}
function renderDashReminders(){
  const el=document.getElementById('dashReminderList'); if(!el) return;
  const upcoming=allReminders.filter(r=>r.status!=='done').slice(0,4);
  if(!upcoming.length){el.innerHTML=emptyState('🔔','No upcoming reminders');return;}
  el.innerHTML=upcoming.map(r=>`<div class="reminder-item"><div class="reminder-icon">🔔</div><div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time">${formatDateTime(r.time)}</div></div></div>`).join('');
}
window.createReminder = async () => {
  const title=document.getElementById('remTitle')?.value.trim(), time=document.getElementById('remTime')?.value, forEmail=document.getElementById('remMember')?.value||'all';
  if(!title||!time) return toast('Fill all fields',true);
  try {
    await dbPush('reminders', {title,time:new Date(time).getTime(),forEmail,status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email});
    toast('🔔 Reminder set!'); document.getElementById('remTitle').value=''; document.getElementById('remTime').value='';
  } catch(e) { toast('Error: '+e.message,true); }
};
window.doneReminder = async (id) => { await dbUpdate(`reminders/${id}`, {status:'done'}); toast('Done!'); };
window.deleteReminder = async (id) => { await dbRemove(`reminders/${id}`); toast('Removed'); };
function updateReminderBadge(){
  const p=allReminders.filter(r=>r.status!=='done').length;
  ['reminderBadge','myReminderBadge'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=p;});
}
// Reminder check — browser notification bhi bhejta hai
function checkReminders(){
  const now=Date.now();
  allReminders.forEach(r=>{
    if(r.status==='pending'&&r.time<=now&&r.time>now-70000){
      toast(`🔔 <strong>Reminder:</strong> ${r.title}`);
      notifyBrowser('🔔 TPS Reminder — Tarningpoint', r.title, `rem-${r.id}`);
    }
  });
}

// Live notifications watcher (task chat messages from others)
function setupLiveNotifications(){
  onChildAdded(ref(db,`notifications/${safeKey(currentUser.email)}`), snap=>{
    const n=snap.val(); if(!n||n.read) return;
    if(n.ts<=_appStartTime) return; // purane skip karo
    if(n.type==='chat'){
      notifyBrowser(`💬 ${n.from}: "${n.taskTitle}"`, n.text, `notif-${snap.key}`);
      toast(`💬 <strong>${n.from}</strong> ne task pe message bheja: ${n.text?.substring(0,50)}`);
    }
    // Mark read
    update(ref(db,`notifications/${safeKey(currentUser.email)}/${snap.key}`),{read:true}).catch(()=>{});
  });
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════
function renderDashboard(){
  const now=Date.now(); let total=0,done=0,progress=0,overdue=0;
  allTasks.forEach(t=>{total++;if(t.status==='done')done++;else if(t.status==='inprogress')progress++;if(t.status!=='done'&&t.dueDate&&new Date(t.dueDate).getTime()<now)overdue++;});
  setEl('statTotal',total); setEl('statDone',done); setEl('statProgress',progress); setEl('statOverdue',overdue);
}
function renderMyProgress(){
  const total=allTasks.length, done=allTasks.filter(t=>t.status==='done').length, pct=total?Math.round((done/total)*100):0;
  setEl('myStatTotal',total); setEl('myStatDone',done); setEl('myStatPending',total-done); setEl('myProgressPct',pct+'%');
  const fill=document.getElementById('myProgressFill'); if(fill) fill.style.width=pct+'%';
}

// ═══════════════════════════════════════════════════════
//  AI FLOAT
// ═══════════════════════════════════════════════════════
function initAIFloat(){ const b=document.getElementById('aiFloatBtn'); if(b) b.style.display='flex'; }
window.openAIFloat  = () => openAIChat();
window.closeAIFloat = () => { document.getElementById('aiFloatChat').classList.remove('open'); document.getElementById('aiFloatBtn').style.display='flex'; };
function openAIChat(){
  const chat=document.getElementById('aiFloatChat'), btn=document.getElementById('aiFloatBtn');
  chat.classList.add('open'); btn.style.display='none';
  const msgs=document.getElementById('aiFloatMessages');
  if(!msgs.children.length) addAIMsg(getWelcomeMsg(),false);
}
function getWelcomeMsg(){
  const isLeaderOrAdmin = currentRole===ROLES.ADMIN||currentRole===ROLES.LEADER;
  const taskCmds = isLeaderOrAdmin
    ? `• 📋 <strong>Task assign:</strong> "Rahul ko task do: printer install, due 30 June, high priority"<br/>• 📋 <strong>Task assign:</strong> "Priya ko website update task assign karo"<br/>• 📋 <strong>Members list:</strong> "Members dikhao"<br/>`
    : `• 📋 <strong>Tasks:</strong> "Mera task status dikhao"<br/>`;
  return`<strong>TPS AI Assistant</strong> — <span style="color:var(--accent)">Wisefox Solution</span> 🦊<br/><br/>Main kya kar sakta hoon:<br/>${taskCmds}• 📝 <strong>Note:</strong> "Note: Client call Friday 4pm"<br/>• 🔔 <strong>Reminder:</strong> "Kal 9 baje meeting reminder"<br/>• 📊 <strong>Status:</strong> "Team ka status dikhao"<br/><br/>💡 Hindi, English, Hinglish — sab samajhta hoon!`;
}
window.sendAIChat = async () => {
  const input=document.getElementById('aiFloatInput'), msg=input.value.trim(); if(!msg) return;
  input.value=''; addAIMsg(msg,true); showAITyping();
  setTimeout(async()=>{ const res=await processAI(msg); removeAITyping(); addAIMsg(res,false); },600);
};
window.aiFloatKeyDown = (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAIChat();} };
function addAIMsg(text,isUser){ const el=document.getElementById('aiFloatMessages'); const div=document.createElement('div'); div.className='float-msg'+(isUser?' user':''); div.innerHTML=`<div class="float-bubble">${text}</div>`; el.appendChild(div); el.scrollTop=el.scrollHeight; }
let typingEl=null;
function showAITyping(){ const el=document.getElementById('aiFloatMessages'); typingEl=document.createElement('div'); typingEl.className='float-msg'; typingEl.innerHTML='<div class="float-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>'; el.appendChild(typingEl); el.scrollTop=el.scrollHeight; }
function removeAITyping(){ if(typingEl){ typingEl.remove(); typingEl=null; } }
async function processAI(msg){ const key=await getApiKey(); if(key) return callOpenAI(msg,key); return await localAI(msg); }
async function getApiKey(){
  if(cachedApiKey) return cachedApiKey;
  try { const d=await dbGet('settings/config'); if(d?.openaiApiKey){ cachedApiKey=d.openaiApiKey; return cachedApiKey; } } catch(e) {}
  return null;
}
async function callOpenAI(msg,apiKey){
  const ctx=`You are TPS AI Assistant. Team: ${allMembers.map(m=>m.name||m.email).join(',')||'None'} Tasks: ${allTasks.length} Clients: ${allClients.length} Today: ${new Date().toISOString().split('T')[0]}\nFor actions: {"action":"note","content":"..."} {"action":"task","title":"...","assigneeName":"...","priority":"high/medium/low","dueDate":"YYYY-MM-DD"} {"action":"reminder","title":"...","hoursFromNow":1}\nFor general: clean HTML. Language: Hindi/English/Hinglish.`;
  try {
    const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'gpt-4o',max_tokens:600,temperature:0.4,messages:[{role:'system',content:ctx},{role:'user',content:msg}]})});
    if(!res.ok) throw new Error('API error');
    const data=await res.json(); const text=(data.choices?.[0]?.message?.content||'').trim();
    try { const match=text.match(/\{[\s\S]*\}/); if(match){ const a=JSON.parse(match[0]); if(a.action) return execAIAction(a,msg); } } catch(e) {}
    return text;
  } catch(e) { return localAI(msg); }
}
async function execAIAction(a,orig){
  if(a.action==='note'){ const content=a.content||orig; await dbPush('notes',{content,title:content.substring(0,30),category:'',color:'#181c24',ownerKey:safeKey(currentUser.email),createdAt:Date.now(),updatedAt:Date.now(),createdBy:currentUser.email}); return`✅ <strong>Note saved!</strong><br/>"${content}"`; }
  if(a.action==='task'){
    if(currentRole!==ROLES.ADMIN&&currentRole!==ROLES.LEADER) return`❌ Sirf Leader aur Admin task assign kar sakte hain.`;
    const m=allMembers.find(m=>(m.name||'').toLowerCase().includes((a.assigneeName||'').toLowerCase())||m.email.includes((a.assigneeName||'').toLowerCase()));
    if(!m) return`❌ Member nahi mila: "${a.assigneeName}"<br/>Available: ${allMembers.map(m=>m.name||m.email).join(', ')||'No members'}`;
    await dbPush('tasks',{title:a.title,desc:a.description||'',assigneeEmail:m.email,assigneeName:m.name||m.email,priority:a.priority||'medium',dueDate:a.dueDate||'',status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||currentUser.email,source:'ai-chat'});
    return`✅ <strong>Task Assign Ho Gaya!</strong><br/>📋 ${a.title}<br/>👤 ${m.name||m.email}<br/>🚨 Priority: ${a.priority||'medium'}${a.dueDate?`<br/>📅 Due: ${a.dueDate}`:''}`;
  }
  if(a.action==='reminder'){ const t=Date.now()+((parseFloat(a.hoursFromNow)||1)*3600000); await dbPush('reminders',{title:a.title,time:t,forEmail:'all',status:'pending',createdAt:Date.now(),createdBy:currentUser.email}); return`✅ <strong>Reminder!</strong> 🔔 "${a.title}" ⏰ ${new Date(t).toLocaleString()}`; }
  return '🤔 Unknown action';
}
// ── Hindi/Hinglish Time Parser ──
function parseHindiTime(msg){
  const l=msg.toLowerCase();
  const now=new Date();
  let d=new Date(now);
  if(l.includes('kal ')||l.includes('tomorrow')) d.setDate(d.getDate()+1);
  else if(l.includes('parso')) d.setDate(d.getDate()+2);

  let hour=null, min=0;
  // "6 baje", "6:30 baje", "6 bajey"
  const bajeM=l.match(/(\d{1,2})(?::(\d{2}))?\s*baj/);
  if(bajeM){ hour=parseInt(bajeM[1]); min=bajeM[2]?parseInt(bajeM[2]):0; }
  // "6 pm / am"
  const pmM=l.match(/(\d{1,2})(?::(\d{2}))?\s*pm/);
  if(pmM){ hour=parseInt(pmM[1])+(parseInt(pmM[1])<12?12:0); min=pmM[2]?parseInt(pmM[2]):0; }
  const amM=l.match(/(\d{1,2})(?::(\d{2}))?\s*am/);
  if(amM){ hour=parseInt(amM[1])%12; min=amM[2]?parseInt(amM[2]):0; }

  if(hour!==null){
    // Context clue for AM/PM if not already set by pm/am keyword
    if(!pmM&&!amM){
      if(l.includes('subah')||l.includes('morning')){if(hour>=12)hour-=12;}
      else if(l.includes('sham')||l.includes('shaam')||l.includes('evening')){if(hour<12)hour+=12;}
      else if(l.includes('raat')||l.includes('night')){if(hour<12&&hour!==0)hour+=12;}
      else { if(hour>=1&&hour<=6) hour+=12; } // 1-6 baje = likely afternoon/evening
    }
    d.setHours(hour,min,0,0);
    if(d.getTime()<Date.now()&&!l.includes('kal')&&!l.includes('parso')) d.setDate(d.getDate()+1);
  } else {
    d=new Date(Date.now()+3600000); // default 1 hour from now
  }
  return d.getTime();
}

// ── Extract clean title from Hindi message ──
function extractCleanTitle(msg){
  let t=msg;
  t=t.replace(/\bmujhe\b|\bmere liye\b|\bkhud ke liye\b/gi,'');
  t=t.replace(/\b(aaj|kal|parso|tomorrow|subah|sham|shaam|raat|morning|evening|night)\b/gi,'');
  t=t.replace(/\d{1,2}(?::\d{2})?\s*(?:baj[eay]*|pm|am)/gi,'');
  t=t.replace(/\b(reminder|yaad|set karo|karna hai|karni hai|chahiye|lagao|dena hai|lena hai)\b/gi,'');
  t=t.replace(/\s+/g,' ').trim();
  if(t.length<3) t=msg.substring(0,60);
  return t.substring(0,80);
}

async function localAI(msg){
  const l = msg.toLowerCase();
  const isLeaderOrAdmin = currentRole===ROLES.ADMIN||currentRole===ROLES.LEADER;

  // ── STATUS / REPORT ──
  if(l.includes('status')||l.includes('report')||l.includes('kitne')||l.includes('summary')||l.includes('dikhao task')||l.includes('mera task')){
    const myTasks=allTasks.filter(t=>t.assigneeEmail===currentUser.email||t.createdBy===currentUser.email);
    const done=myTasks.filter(t=>t.status==='done').length;
    const pending=myTasks.filter(t=>t.status==='pending').length;
    const inprog=myTasks.filter(t=>t.status==='inprogress').length;
    if(isLeaderOrAdmin){
      const tdone=allTasks.filter(t=>t.status==='done').length;
      return`📊 <strong>Team Status</strong><br/>Total Tasks: ${allTasks.length} | ✅ Done: ${tdone} | 🔄 In Progress: ${allTasks.filter(t=>t.status==='inprogress').length} | ⏳ Pending: ${allTasks.filter(t=>t.status==='pending').length}<br/>👥 Members: ${allMembers.length} | 🏢 Clients: ${allClients.length}<br/><br/>📋 <strong>Aapke Tasks: ${myTasks.length}</strong> (Done: ${done}, Pending: ${pending})`;
    }
    return`📊 <strong>Aapke Tasks</strong><br/>Total: ${myTasks.length} | ✅ Done: ${done} | 🔄 In Progress: ${inprog} | ⏳ Pending: ${pending}`;
  }

  // ── MEMBERS LIST ──
  if((l.includes('member')||l.includes('team'))&&(l.includes('list')||l.includes('dikhao')||l.includes('kaun')||l.includes('show'))){
    if(!allMembers.length) return`👥 Koi member nahi mila abhi.`;
    return`👥 <strong>Team Members (${allMembers.length})</strong><br/>${allMembers.map((m,i)=>`${i+1}. ${m.name||m.email} <small style="color:var(--muted)">(${m.role})</small>`).join('<br/>')}`;
  }

  // ── REMINDER (detect by keywords or natural time expression) ──
  const isReminderCmd = l.includes('reminder')||l.includes('yaad')||l.includes('yaad dilao')||l.includes('alert')||
    (l.includes('baje')&&(l.includes('lena')||l.includes('karna')||l.includes('milna')||l.includes('payment')||l.includes('call')||l.includes('meeting')||l.includes('aaj')||l.includes('kal')));

  if(isReminderCmd){
    const ts=parseHindiTime(msg);
    const title=extractCleanTitle(msg);
    await dbPush('reminders',{title,time:ts,forEmail:currentUser.email,status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||currentUser.email});
    return`✅ <strong>Reminder Set!</strong><br/>🔔 <strong>${title}</strong><br/>⏰ ${new Date(ts).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}<br/><small>Browser notification milegi jab time aayega!</small>`;
  }

  // ── SELF TASK (mujhe karna hai / khud ke liye task) ──
  const isSelfTask = l.includes('mujhe')&&(l.includes('karna')||l.includes('karni')||l.includes('task')||l.includes('lena')||l.includes('dena')||l.includes('baat'));
  if(isSelfTask){
    const title=extractCleanTitle(msg);
    let priority='medium';
    if(l.includes('urgent')||l.includes('important')||l.includes('zaruri')) priority='high';
    await dbPush('tasks',{title,desc:'',assigneeEmail:currentUser.email,assigneeName:currentUser.displayName||currentUser.email,priority,dueDate:'',status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||currentUser.email,source:'ai-self'});
    return`✅ <strong>Task Add Ho Gaya!</strong><br/>📋 <strong>${title}</strong><br/>👤 Assignee: Aap<br/>🚨 Priority: ${priority}`;
  }

  // ── TASK ASSIGNMENT (leader/admin) ──
  if(isLeaderOrAdmin && (l.includes('task')||l.includes('assign')||l.includes('ko karo')||l.includes('ko de')||l.includes('ko task'))){
    const foundMember=allMembers.find(m=>{
      const name=(m.name||'').toLowerCase();
      const uname=(m.email||'').toLowerCase().split('@')[0];
      return (name&&l.includes(name))||(uname&&l.includes(uname));
    });
    if(!foundMember){
      const names=allMembers.length?allMembers.map(m=>m.name||m.email).join(', '):'koi nahi';
      return`❌ <strong>Member ka naam nahi mila.</strong><br/>Available: ${names}<br/><br/>💡 Format: <em>"Rahul ko task do: printer install, due 30 June"</em>`;
    }
    let title='';
    const ci=msg.indexOf(':');
    if(ci>-1) title=msg.substring(ci+1).trim().split(',')[0].trim();
    if(!title){ const ki=l.indexOf('ko task'); if(ki>-1) title=msg.substring(ki+7).replace(/assign|karo|do|kar/gi,'').trim().split(',')[0].trim(); }
    if(!title) return`❌ Task title nahi mila.<br/>Format: <em>"${foundMember.name||foundMember.email} ko task do: <strong>title yahan</strong>"</em>`;

    let dueDate='';
    const dm=msg.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
    if(dm){ const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}; const mn=months[dm[2].substring(0,3).toLowerCase()]; if(mn) dueDate=`${new Date().getFullYear()}-${String(mn).padStart(2,'0')}-${String(parseInt(dm[1])).padStart(2,'0')}`; }
    let priority='medium';
    if(l.includes('high')||l.includes('urgent')) priority='high';
    else if(l.includes('low')) priority='low';

    await dbPush('tasks',{title,desc:'',assigneeEmail:foundMember.email,assigneeName:foundMember.name||foundMember.email,priority,dueDate,status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||currentUser.email,source:'ai-chat'});
    // Notify assignee
    await dbPush(`notifications/${safeKey(foundMember.email)}`,{type:'task',taskTitle:title,from:currentUser.displayName||currentUser.email,ts:Date.now(),read:false});
    return`✅ <strong>Task Assign Ho Gaya!</strong><br/>📋 ${title}<br/>👤 ${foundMember.name||foundMember.email}<br/>🚨 Priority: ${priority}${dueDate?`<br/>📅 Due: ${dueDate}`:''}`;
  }

  // ── HELP ──
  if(l.includes('help')||l.includes('kya kar')||l.includes('commands')){
    return getWelcomeMsg();
  }

  return`🤔 <strong>Samajh nahi aaya:</strong> "${msg.substring(0,50)}"<br/><br/>💡 <strong>Try karo:</strong><br/>• "Mujhe aaj 6 baje meeting hai" → Reminder set hoga<br/>• "Mujhe client ka payment lena hai kal 3 baje" → Reminder<br/>• "Team status dikhao" → Report<br/>• "Members dikhao" → Team list<br/>• "Rahul ko task do: kaam karna" → Task assign<br/><small style="color:var(--muted)">Ya Settings → OpenAI API Key add karo!</small>`;
}

// ── API Key & Settings ──
async function loadApiKeyStatus(){ const d=await getApiKey(); const el=document.getElementById('apiKeyStatus'); if(!el)return; if(d){el.textContent='✅ Active';el.style.background='rgba(0,229,160,0.15)';el.style.color='var(--accent)';}else{el.textContent='Not Set';el.style.background='rgba(255,107,107,0.15)';el.style.color='#ff6b6b';} }
window.saveApiKey = async () => {
  const key=document.getElementById('apiKeyInput')?.value.trim(); if(!key) return toast('API Key empty',true); if(!key.startsWith('sk-')) return toast('Invalid key',true);
  await dbUpdate('settings/config', {openaiApiKey:key}); cachedApiKey=key; loadApiKeyStatus(); toast('✅ API Key saved!'); document.getElementById('apiKeyInput').value='';
};
window.clearApiKey = async () => { if(!confirm('Remove API Key?'))return; await dbUpdate('settings/config',{openaiApiKey:''}); cachedApiKey=null; loadApiKeyStatus(); toast('API Key removed'); };
window.toggleApiKeyVisibility = () => { const inp=document.getElementById('apiKeyInput'); inp.type=inp.type==='password'?'text':'password'; };

// ── Change PIN ──
window.changePIN = async () => {
  const oldPin=document.getElementById('changePinOld')?.value.trim(), newPin=document.getElementById('changePinNew')?.value.trim();
  if(!oldPin||!newPin) return toast('Fill all fields',true);
  if(newPin.length!==4||!/^\d+$/.test(newPin)) return toast('PIN must be exactly 4 digits',true);
  try {
    const k=safeKey(currentUser.email);
    const data=await dbGet(`userPins/${k}`); if(!data) return toast('No PIN found',true);
    const validOld=(await hashPIN(oldPin))===data.pinHash; if(!validOld) return toast('❌ Wrong current PIN',true);
    const now=Date.now();
    await dbSet(`userPins/${k}`, {pinHash:await hashPIN(newPin), email:currentUser.email, setAt:now, expiresAt:now+(PIN_EXPIRY_DAYS*86400000)});
    toast('✅ PIN changed!');
    ['changePinOld','changePinNew'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { toast('Error: '+e.message,true); }
};

// ═══════════════════════════════════════════════════════
//  ADMIN MODULE (Realtime Database)
// ═══════════════════════════════════════════════════════
let adminTeams=[], adminUsers=[];
function initAdminModule(){
  let latestUsers=null, latestRoles=null;
  function merge(){
    if(!latestUsers) return; adminUsers=[];
    Object.entries(latestUsers).forEach(([k,u])=>{ adminUsers.push({id:k,...u,role:latestRoles?.[k]?.role||'member'}); });
    renderAdminUserList();
  }
  onValue(ref(db,'users'),  snap=>{ latestUsers=snap.val()||{}; merge(); });
  onValue(ref(db,'roles'),  snap=>{ latestRoles=snap.val()||{}; merge(); });
  onValue(ref(db,'teams'),  snap=>{ adminTeams=Object.entries(snap.val()||{}).map(([k,v])=>({...v,id:k})); renderAdminTeamList(); populateAdminTeamSelect(); });
}

window.adminCreateTeam = async () => {
  const name=document.getElementById('newTeamName')?.value.trim(), email=document.getElementById('newTeamLeader')?.value.trim().toLowerCase();
  if(!name) return toast('Team name required',true);
  if(!email||!email.includes('@')) return toast('Valid leader email required',true);
  try {
    const k=safeKey(email);
    const teamId=dbPushKey('teams');
    await dbSet(`teams/${teamId}`, {name,leaderEmail:email,createdAt:Date.now(),members:{[k]:{email,role:'leader',addedAt:Date.now()}}});
    await dbSet(`roles/${k}`, {role:ROLES.LEADER,email,teamId,updatedAt:Date.now()});
    const existing=await dbGet(`users/${k}`);
    if(!existing) await dbSet(`users/${k}`, {name:email.split('@')[0],email,photo:'',role:'leader',teamId,createdAt:Date.now()});
    else await dbUpdate(`users/${k}`, {role:'leader',teamId,updatedAt:Date.now()});
    toast(`✅ Team "${name}" created! Leader: ${email}`);
    ['newTeamName','newTeamLeader'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  } catch(e) { console.error(e); toast('❌ Error: '+e.message,true); }
};

window.adminAddMember = async () => {
  const email=document.getElementById('newMemberEmailAdmin')?.value.trim().toLowerCase(), teamId=document.getElementById('memberTeamSelect')?.value;
  if(!email||!email.includes('@')) return toast('Valid email required',true);
  if(!teamId) return toast('Select a team first',true);
  try {
    const k=safeKey(email);
    await dbSet(`roles/${k}`, {role:ROLES.MEMBER,email,teamId,updatedAt:Date.now()});
    await dbUpdate(`teams/${teamId}/members/${k}`, {email,role:'member',addedAt:Date.now()});
    const existing=await dbGet(`users/${k}`);
    if(!existing) await dbSet(`users/${k}`, {name:email.split('@')[0],email,photo:'',role:'member',teamId,createdAt:Date.now()});
    else await dbUpdate(`users/${k}`, {role:'member',teamId,updatedAt:Date.now()});
    toast(`✅ ${email} added as member`); document.getElementById('newMemberEmailAdmin').value='';
  } catch(e) { toast('❌ Error: '+e.message,true); }
};

window.adminChangeRole = async (email,role) => { await dbUpdate(`roles/${safeKey(email)}`, {role,updatedAt:Date.now()}); toast(`Role → ${role}`); };
window.adminDeleteTeam = async (id,name) => { if(!confirm(`Delete team "${name}"?`))return; await dbRemove(`teams/${id}`); toast('Team deleted'); };

window.adminResetUserPIN = async (email) => {
  if(!confirm(`"${email}" ka PIN reset karo?\nUnhein naya PIN set karna hoga.`)) return;
  try { await dbRemove(`userPins/${safeKey(email)}`); toast(`✅ PIN reset for ${email}`); } catch(e) { toast('Error: '+e.message,true); }
};

function renderAdminUserList(){
  const el=document.getElementById('adminUserList'); if(!el) return;
  if(!adminUsers.length){el.innerHTML=emptyState('👥','No users yet');return;}
  el.innerHTML=adminUsers.map(u=>`<div class="admin-user-row">
    <div class="user-avatar-sm">${u.photo?`<img src="${u.photo}"/>`:((u.name||'U')[0])}</div>
    <div class="admin-user-info"><div class="admin-user-name">${u.name||'—'}</div><div class="admin-user-email">${u.email}</div></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select class="form-control" style="width:90px;padding:4px 6px;font-size:12px" onchange="adminChangeRole('${u.email}',this.value)">
        <option value="member"${u.role==='member'?' selected':''}>Member</option>
        <option value="leader"${u.role==='leader'?' selected':''}>Leader</option>
        <option value="admin"${u.role==='admin'?' selected':''}>Admin</option>
      </select>
      <button class="btn-sm" style="background:rgba(255,107,107,0.15);color:#ff6b6b;font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid rgba(255,107,107,0.2)" onclick="adminResetUserPIN('${u.email}')">🔑 Reset PIN</button>
    </div>
  </div>`).join('');
}

function renderAdminTeamList(){
  const el=document.getElementById('adminTeamList'); if(!el) return;
  if(!adminTeams.length){el.innerHTML=emptyState('🏢','No teams yet');return;}
  el.innerHTML=adminTeams.map(team=>{
    const members=team.members?Object.entries(team.members):[];
    return `<div class="admin-team-card"><div class="admin-team-header"><div><div class="admin-team-name">🏢 ${team.name}</div><div class="admin-team-leader">Leader: ${team.leaderEmail||'—'}</div></div><button class="btn-sm btn-del" onclick="adminDeleteTeam('${team.id}','${team.name}')">🗑</button></div><div class="team-members-wrap">${members.map(([k,m])=>`<span class="team-member-chip">${m.email}</span>`).join('')||'<span style="color:var(--muted);font-size:12px">No members</span>'}</div></div>`;
  }).join('');
}
function populateAdminTeamSelect(){ const el=document.getElementById('memberTeamSelect'); if(!el) return; el.innerHTML='<option value="">Select Team...</option>'+adminTeams.map(t=>`<option value="${t.id}">${t.name}</option>`).join(''); }
