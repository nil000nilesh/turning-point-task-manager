// ══════════════════════════════════════════════════════
//  TPS Client Desk AI — Main App (Consolidated)
//  Powered by Wisefox Solution
//  Version: 4.0.0 — Firestore + CaseDesk PIN Lock Edition
// ══════════════════════════════════════════════════════

import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signInWithRedirect,
         getRedirectResult, onAuthStateChanged,
         signOut }                      from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore,
         collection, doc,
         setDoc, getDoc, addDoc,
         onSnapshot, updateDoc, deleteDoc,
         query, where, orderBy }        from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── CONFIG ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAP6xYAgWtU8hyuJP2nximxRZRIJnwNgG0",
  authDomain:        "turning-point-task-manager.firebaseapp.com",
  projectId:         "turning-point-task-manager",
  storageBucket:     "turning-point-task-manager.firebasestorage.app",
  messagingSenderId: "922397311479",
  appId:             "1:922397311479:web:0c4ed59ee86331261daef2",
  measurementId:     "G-BX36LQ0T1J"
};

const ADMIN_EMAIL     = "nil000nilesh@gmail.com";
const ADMIN_USER_PIN  = "5786";           // Default PIN for Admin user only
const PIN_EXPIRY_DAYS = 30;              // Monthly reset
const INACTIVITY_MS   = 5 * 60 * 1000;  // 5 min auto-lock
const ROLES = { ADMIN:'admin', LEADER:'leader', MEMBER:'member' };

// ── FIREBASE INIT ────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ── APP STATE ────────────────────────────────────────
let currentUser   = null;
let currentRole   = ROLES.MEMBER;
let currentTeamId = null;
let allTasks=[], allMembers=[], allClients=[], allNotes=[], allReminders=[];
let currentTaskId=null, viewingClientId=null, activeNoteId=null;
let cachedApiKey=null, tasksFilter='all';
let _inactivityTimer=null, _unsubTaskChat=null;
let _pinBuffer={ setup:'', verify:'' };

// ═══════════════════════════════════════════════════════
//  ██████╗ ██╗███╗  ██╗    ███████╗██╗   ██╗███████╗
//  ██╔══██╗██║████╗ ██║    ██╔════╝╚██╗ ██╔╝██╔════╝
//  ██████╔╝██║██╔██╗██║    ███████╗ ╚████╔╝ ███████╗
//  ██╔═══╝ ██║██║╚████║    ╚════██║  ╚██╔╝  ╚════██║
//  ██║     ██║██║ ╚███║    ███████║   ██║   ███████║
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
.tps-pin-boxes {
  display:flex; gap:12px; margin:4px 0;
}
.tps-pin-box {
  width:58px; height:66px; border-radius:16px;
  background:rgba(255,255,255,0.06);
  border:2px solid rgba(255,255,255,0.1);
  display:flex; align-items:center; justify-content:center;
  transition:all 0.2s;
}
.tps-pin-box.active {
  border-color:#667eea;
  box-shadow:0 0 0 4px rgba(102,126,234,0.2);
  background:rgba(102,126,234,0.1);
}
.tps-pin-box.filled { border-color:#667eea; background:rgba(102,126,234,0.15); }
.tps-pin-dot {
  width:16px; height:16px; border-radius:50%;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:none; box-shadow:0 2px 8px rgba(102,126,234,0.5);
}
.tps-pin-box.filled .tps-pin-dot { display:block; }
.tps-pin-keypad {
  display:grid; grid-template-columns:repeat(3,1fr); gap:10px;
  width:100%; max-width:260px;
}
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
.tps-pin-unlock-btn.ready {
  opacity:1; pointer-events:all;
  box-shadow:0 8px 24px rgba(102,126,234,0.5);
}
.tps-pin-unlock-btn.ready:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(102,126,234,0.6); }
.tps-pin-logout-btn {
  background:transparent; border:none;
  color:rgba(255,255,255,0.35); font-size:12px;
  cursor:pointer; padding:4px 8px; border-radius:8px;
  transition:color 0.2s;
}
.tps-pin-logout-btn:hover { color:rgba(255,255,255,0.65); }
.tps-pin-footer {
  font-size:10px; color:rgba(255,255,255,0.2);
  letter-spacing:1.5px; text-transform:uppercase;
  text-align:center;
}
.tps-pin-shake { animation:tpsPinShake 0.45s ease; }
@keyframes tpsPinShake {
  0%,100%{ transform:translateX(0); }
  20%{ transform:translateX(-9px); }
  40%{ transform:translateX(9px); }
  60%{ transform:translateX(-6px); }
  80%{ transform:translateX(6px); }
}
`;
  document.head.appendChild(s);
}

function buildPINCard(mode, user) {
  const photoHTML = user?.photoURL
    ? `<img class="tps-pin-photo" src="${user.photoURL}" />`
    : `<div class="tps-pin-initials">${(user?.displayName||'U')[0].toUpperCase()}</div>`;

  if (mode === 'setup') {
    return `
      <div class="tps-pin-card">
        <div class="tps-pin-app-logo">⚡</div>
        ${photoHTML}
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
    return `
      <div class="tps-pin-card">
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
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tpsPinOverlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  overlay.innerHTML = buildPINCard(mode, user);
  window._activePinMode = mode;
  _pinBuffer[mode] = '';

  // Build keypad
  const kp = document.getElementById(`pinKeypad_${mode}`);
  ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(k => {
    const btn = document.createElement('button');
    btn.className = 'tps-pin-key' + (k===''?' empty':'');
    btn.textContent = k;
    if (k !== '') btn.onclick = () => k==='⌫' ? _pinBack(mode) : _pinDigit(k, mode);
    kp.appendChild(btn);
  });

  // Keyboard support
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

function _pinBack(mode) {
  _pinBuffer[mode] = _pinBuffer[mode].slice(0,-1);
  _refreshBoxes(mode);
}

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

  if (mode === 'setup') {
    try {
      const hash = await hashPIN(pin);
      const k = safeKey(currentUser.email);
      const now = Date.now();
      await setDoc(doc(db,'userPins',k), {
        pinHash:hash, email:currentUser.email,
        setAt:now, expiresAt: now+(PIN_EXPIRY_DAYS*86400000)
      });
      _closePINOverlay();
      initApp();
    } catch(e) {
      toast('PIN save error: '+e.message, true);
      _pinShake(mode);
    }
  } else {
    // Admin bypass
      try {
      const snap = await getDoc(doc(db,'userPins',safeKey(currentUser.email)));
      if (!snap.exists()) { _pinShake(mode); return; }
      const ok = (await hashPIN(pin)) === snap.data().pinHash;
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

// showPINScreen function mein, setup ke pehle ye add karo:
if (!snap.exists()) {
  // Admin ka default PIN auto-set karo
  if (user.email === ADMIN_EMAIL) {
    const hash = await hashPIN(ADMIN_USER_PIN);
    const now = Date.now();
    await setDoc(doc(db,'userPins',k), {
      pinHash:hash, email:user.email,
      setAt:now, expiresAt:now+(PIN_EXPIRY_DAYS*86400000)
    });
    showPINOverlay('verify', user);  // Setup screen nahi, directly verify
  } else {
    showPINOverlay('setup', user);   // Normal users PIN set karein
  }
}
async function showPINScreen(user) {
  const k = safeKey(user.email);
  try {
    const snap = await getDoc(doc(db,'userPins',k));
    if (!snap.exists()) {
      showPINOverlay('setup', user);
    } else {
      const { expiresAt } = snap.data();
      if (Date.now() > expiresAt) {
        await deleteDoc(doc(db,'userPins',k));
        toast('🔄 PIN expire ho gaya! Naya PIN set karo.', false);
        showPINOverlay('setup', user);
      } else {
        showPINOverlay('verify', user);
      }
    }
  } catch(e) {
    showPINOverlay('setup', user);
  }
}

// Re-lock app (called on inactivity)
function lockApp() {
  clearTimeout(_inactivityTimer);
  _pinBuffer.verify = '';
  showPINOverlay('verify', currentUser);
}

// ═══════════════════════════════════════════════════════
//  INACTIVITY AUTO-LOCK (5 min)
// ═══════════════════════════════════════════════════════

function startInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    lockApp();
    toast('🔒 5 min inactivity — locked');
  }, INACTIVITY_MS);
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
function safeKey(email) { return email.replace(/\./g,'_').replace(/@/g,'__at__'); }
function toast(msg, isError=false) {
  const c = document.getElementById('toastContainer'); if(!c) return;
  const el = document.createElement('div');
  el.className = 'toast'+(isError?' error':'');
  el.innerHTML = msg;
  c.appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
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
  const shareData = {
    title: 'Tarning Point Marketing — Task Manager',
    text: 'Team aur task management ke liye is app ko use karo.',
    url: window.location.origin
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      toast('✅ App link shared successfully');
      return;
    }
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Share cancelled', true);
    return;
  }

  const encodedURL = encodeURIComponent(shareData.url);
  const encodedText = encodeURIComponent(`${shareData.text} ${shareData.url}`);
  const options = [
    `WhatsApp: https://wa.me/?text=${encodedText}`,
    `X / Twitter: https://twitter.com/intent/tweet?text=${encodedText}`,
    `Facebook: https://www.facebook.com/sharer/sharer.php?u=${encodedURL}`,
    `Email: mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodedText}`
  ];

  const choice = prompt(`Share options:\n\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\n(1-4 select karo, ya Cancel)`);
  const idx = Number(choice) - 1;
  if (idx >= 0 && idx < options.length) {
    const target = options[idx].split(': ')[1];
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareData.url);
    toast('📋 Link copied. Aap manually share kar sakte ho.');
  } else {
    toast(`Link copy karo: ${shareData.url}`);
  }
};

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════

function resetLoginBtn() {
  const btn=document.getElementById('googleLoginBtn');
  const txt=document.getElementById('googleBtnText');
  if(btn) btn.disabled=false;
  if(txt) txt.innerHTML='<strong>Continue with Google</strong><br/><small style="font-weight:400;font-size:11px;color:#6b7280">Secure one-tap sign in</small>';
}
resetLoginBtn();

getRedirectResult(auth).then(r=>{if(r?.user)console.log('✅ Redirect:',r.user.email);else resetLoginBtn();})
.catch(e=>{ resetLoginBtn(); const ign=['auth/no-auth-event','auth/null-user','auth/missing-initial-state']; if(!ign.includes(e.code)&&e.code!=='auth/popup-closed-by-user') showLoginError('Login error: '+e.code); });

function showLoginError(msg) {
  const el=document.getElementById('loginErrorMsg');
  if(el){el.textContent=msg;el.style.display='block';}else toast(msg,true);
  resetLoginBtn();
}

function buildAuthHelpMessage(code, fallbackMessage='Login failed') {
  const host = window.location.hostname;
  if (code === 'auth/unauthorized-domain') {
    return `❌ Domain unauthorized: ${host}. Firebase Console → Authentication → Settings → Authorized domains mein isi domain ko add karein.`;
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return '❌ Google sign-in disabled lag raha hai. Firebase Authentication → Sign-in method mein Google provider enable karein.';
  }
  return fallbackMessage;
}

window.loginWithGoogle = async () => {
  const btn=document.getElementById('googleLoginBtn');
  const txt=document.getElementById('googleBtnText');
  const errEl=document.getElementById('loginErrorMsg');
  if(errEl) errEl.style.display='none';
  if(btn) btn.disabled=true;
  if(txt) txt.innerHTML='<strong>Signing in...</strong><br/><small style="color:#6b7280">Please wait...</small>';
  try {
    await signInWithPopup(auth, provider);
  } catch(e) {
    if(['auth/popup-blocked','auth/cancelled-popup-request'].includes(e.code)) {
      if(txt) txt.innerHTML='<strong>Redirecting...</strong>';
      try{await signInWithRedirect(auth,provider);return;}catch(e2){showLoginError('Redirect failed: '+e2.message);}
    } else if(e.code==='auth/popup-closed-by-user') { resetLoginBtn(); }
    else {
      const raw = e.message || e.code || 'Unknown error';
      showLoginError(buildAuthHelpMessage(e.code, 'Login failed: ' + raw));
    }
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

onAuthStateChanged(auth, async user => {
  if (user) {
    console.log('✅ Auth:', user.email);
    currentUser = user;
    try {
      const timeout = ms => new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));
      currentRole   = await Promise.race([resolveRole(user),  timeout(5000)]).catch(()=>user.email===ADMIN_EMAIL?ROLES.ADMIN:ROLES.MEMBER);
      currentTeamId = await Promise.race([resolveTeam(user), timeout(5000)]).catch(()=>null);
      await Promise.race([registerUser(user), timeout(5000)]).catch(e=>console.warn('registerUser:',e));
    } catch(e) { if(user.email===ADMIN_EMAIL) currentRole=ROLES.ADMIN; }
    // ─ Show PIN screen BEFORE initApp ─
    showPINScreen(user);
  } else {
    showScreen('login');
    resetLoginBtn();
  }
});

async function resolveRole(user) {
  if(user.email===ADMIN_EMAIL) return ROLES.ADMIN;
  try { const s=await getDoc(doc(db,'roles',safeKey(user.email))); if(s.exists()) return s.data().role||ROLES.MEMBER; } catch(e){}
  return ROLES.MEMBER;
}
async function resolveTeam(user) {
  try { const s=await getDoc(doc(db,'roles',safeKey(user.email))); if(s.exists()&&s.data().teamId) return s.data().teamId; } catch(e){}
  return null;
}
async function registerUser(user) {
  const k=safeKey(user.email);
  try {
    const s=await getDoc(doc(db,'users',k));
    const data={name:user.displayName||user.email.split('@')[0],email:user.email,photo:user.photoURL||'',lastSeen:Date.now()};
    if(!s.exists()){data.createdAt=Date.now();await setDoc(doc(db,'users',k),data);}
    else await updateDoc(doc(db,'users',k),data);
  } catch(e){}
}

// ═══════════════════════════════════════════════════════
//  APP INIT — called AFTER PIN verified
// ═══════════════════════════════════════════════════════

function initApp() {
  console.log('🚀 initApp role:',currentRole,'team:',currentTeamId);
  showScreen('app');
  setupSidebar();
  if(Notification.permission==='default') Notification.requestPermission().catch(()=>{});

  const adminNav=document.getElementById('adminNav');
  const leaderNav=document.getElementById('leaderNav');
  const memberNav=document.getElementById('memberNav');
  const roleEl=document.getElementById('sidebarRole');

  if(currentRole===ROLES.ADMIN) {
    if(adminNav)  adminNav.style.display='block';
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
  console.log('✅ App ready');
}

function setupSidebar() {
  const av=document.getElementById('sidebarAvatar');
  if(currentUser.photoURL) av.innerHTML=`<img src="${currentUser.photoURL}"/>`;
  else av.textContent=(currentUser.displayName||'U')[0].toUpperCase();
  document.getElementById('sidebarName').textContent=currentUser.displayName||currentUser.email;
  const dn=document.getElementById('dashName'); if(dn) dn.textContent=(currentUser.displayName||'Leader').split(' ')[0];
}
function initLeaderModules(){subscribeMembers();subscribeTasks();subscribeClients();subscribeNotes();subscribeReminders();}
function initMemberModules(){subscribeTasks();subscribeReminders();}

// ═══════════════════════════════════════════════════════
//  MEMBERS MODULE
// ═══════════════════════════════════════════════════════

function subscribeMembers() {
  onSnapshot(collection(db,'users'), usersSnap=>{
    onSnapshot(collection(db,'roles'), rolesSnap=>{
      const roles={};rolesSnap.forEach(c=>{roles[c.id]=c.data();});
      allMembers=[];
      usersSnap.forEach(c=>{
        const u={id:c.id,...c.data()};
        const r=roles[c.id]||{};
        u.role=r.role||'member'; u.teamId=r.teamId||'';
        if(currentTeamId){if(r.teamId===currentTeamId||u.email===currentUser.email)allMembers.push(u);}
        else allMembers.push(u);
      });
      renderMembers();populateAssigneeSelect();populateReminderMemberSelect();setEl('statMembers',allMembers.length);
    });
  });
}

function renderMembers(){
  const el=document.getElementById('memberGrid');if(!el)return;
  if(!allMembers.length){el.innerHTML=emptyState('👥','No team members yet');return;}
  el.innerHTML=allMembers.map(m=>`<div class="member-card">
    <div class="member-avatar-lg">${m.photo?`<img src="${m.photo}"/>`:(m.name||'?')[0]}</div>
    <div class="member-name">${m.name||'—'}</div>
    <div class="member-email">${m.email}</div>
    <span class="tag" style="margin:6px 0">${m.role||'member'}</span>
  </div>`).join('');
}

window.inviteMember=async()=>{
  const email=document.getElementById('inviteEmail')?.value.trim().toLowerCase();
  const name=document.getElementById('inviteName')?.value.trim();
  if(!email||!email.includes('@'))return toast('Valid email required',true);
  const k=safeKey(email);
  try{
    const s=await getDoc(doc(db,'users',k));
    if(!s.exists())await setDoc(doc(db,'users',k),{email,name:name||email.split('@')[0],photo:'',createdAt:Date.now()});
    await setDoc(doc(db,'roles',k),{role:'member',email,teamId:currentTeamId||'',updatedAt:Date.now()});
    if(currentTeamId)await updateDoc(doc(db,'teams',currentTeamId),{[`members.${k}`]:{email,addedAt:Date.now()}});
    toast(`✅ ${email} added as member`);
    ['inviteEmail','inviteName'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  }catch(e){toast('Error: '+e.message,true);}
};

function populateAssigneeSelect(){
  const el=document.getElementById('taskAssignee');if(!el)return;
  el.innerHTML='<option value="">Select Member...</option>'+allMembers.filter(m=>m.role!=='admin').map(m=>`<option value="${m.email}">${m.name||m.email}</option>`).join('');
}
function populateReminderMemberSelect(){
  const el=document.getElementById('remMember');if(!el)return;
  el.innerHTML='<option value="all">All Members</option>'+allMembers.map(m=>`<option value="${m.email}">${m.name||m.email}</option>`).join('');
}

// ═══════════════════════════════════════════════════════
//  TASKS MODULE
// ═══════════════════════════════════════════════════════

function subscribeTasks(){
  onSnapshot(collection(db,'tasks'),snap=>{
    const raw=[];snap.forEach(c=>raw.push({id:c.id,...c.data()}));
    if(currentRole===ROLES.MEMBER) allTasks=raw.filter(t=>t.assigneeEmail===currentUser.email);
    else if(currentRole===ROLES.LEADER) allTasks=raw.filter(t=>t.teamId===currentTeamId||t.createdBy===currentUser.email);
    else allTasks=raw;
    renderAllTasksList();renderMyTasks();renderRecentTasks();updateTaskBadge();renderDashboard();renderMyProgress();
  });
}

function renderMyTasks(){
  const el=document.getElementById('myTasksList');if(!el)return;
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
        ${t.clientName?`<span class="tag">🏢 ${t.clientName}</span>`:''}
      </div>
    </div>
    <div class="task-actions"><button class="btn-sm btn-update" onclick="openTaskUpdate('${t.id}')">💬 Update</button></div>
  </div>`;
}
function renderAllTasksList(filter){
  if(filter)tasksFilter=filter;
  const el=document.getElementById('allTasksList');if(!el)return;
  const now=new Date();let tasks=allTasks;
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
        ${t.clientName?`<span class="tag">🏢 ${t.clientName}</span>`:''}
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
  const el=document.getElementById('recentTasksList');if(!el)return;
  const recent=[...allTasks].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  if(!recent.length){el.innerHTML=emptyState('📋','No tasks yet');return;}
  el.innerHTML=recent.map(t=>`<div class="task-item compact"><div class="task-status-pill">${statusIcon(t.status)}</div><div class="task-body"><div class="task-title">${t.title}</div><div class="task-meta"><span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span><span class="tag">👤 ${t.assigneeName||'—'}</span></div></div></div>`).join('');
}
function statusIcon(s){return s==='done'?'✅':s==='inprogress'?'🔄':s==='review'?'👁':'⏳';}

window.createTask=async()=>{
  const title=document.getElementById('taskTitle')?.value.trim();
  const desc=document.getElementById('taskDesc')?.value.trim();
  const email=document.getElementById('taskAssignee')?.value;
  const priority=document.getElementById('taskPriority')?.value||'medium';
  const dueDate=document.getElementById('taskDue')?.value;
  const clientId=document.getElementById('taskClient')?.value;
  if(!title)return toast('Task title required',true);
  if(!email)return toast('Select assignee',true);
  const member=allMembers.find(m=>m.email===email)||{email,name:email};
  const cSelect=document.getElementById('taskClient');
  const clientName=clientId&&cSelect?cSelect.options[cSelect.selectedIndex]?.text||'':'';
  try{
    await addDoc(collection(db,'tasks'),{title,desc:desc||'',assigneeEmail:member.email,assigneeName:member.name||member.email,priority,dueDate:dueDate||'',status:'pending',clientId:clientId||'',clientName:clientId?clientName:'',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,createdByName:currentUser.displayName||''});
    toast('✅ Task assigned!');
    ['taskTitle','taskDesc','taskDue'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  }catch(e){toast('Error: '+e.message,true);}
};
window.resetTaskForm=()=>{
  ['taskTitle','taskDesc','taskDue'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const ta=document.getElementById('taskAssignee');if(ta)ta.value='';
  const tc=document.getElementById('taskClient');if(tc)tc.value='';
};
window.deleteTask=async(id)=>{if(!confirm('Delete task?'))return;await deleteDoc(doc(db,'tasks',id));toast('Task deleted');};
window.cycleTaskStatus=async(id,current)=>{
  const order=['pending','inprogress','review','done'];
  const next=order[(order.indexOf(current)+1)%order.length];
  await updateDoc(doc(db,'tasks',id),{status:next,updatedAt:Date.now()});
  toast(`Status → ${next}`);
};
function updateTaskBadge(){
  const p=allTasks.filter(t=>t.status!=='done').length;
  ['taskBadge','myTaskBadge'].forEach(id=>{const b=document.getElementById(id);if(b)b.textContent=p;});
}
window.openTaskUpdate=async(taskId)=>{
  currentTaskId=taskId;
  const task=allTasks.find(t=>t.id===taskId);if(!task)return;
  document.getElementById('taskUpdateTitle').textContent=task.title;
  document.getElementById('taskUpdateStatus').value=task.status||'pending';
  document.getElementById('taskUpdateAssignee').textContent=task.assigneeName||task.assigneeEmail||'—';
  document.getElementById('taskUpdateDue').textContent=task.dueDate||'No due date';
  loadTaskChat(taskId);openModal('taskUpdateModal');
};
window.updateTaskStatus=async()=>{
  if(!currentTaskId)return;
  await updateDoc(doc(db,'tasks',currentTaskId),{status:document.getElementById('taskUpdateStatus').value,updatedAt:Date.now()});
};
window.sendTaskChat=async()=>{
  if(!currentTaskId)return;
  const input=document.getElementById('taskChatInput');
  const text=input.value.trim();if(!text)return;
  await updateDoc(doc(db,'tasks',currentTaskId),{status:document.getElementById('taskUpdateStatus').value,updatedAt:Date.now()});
  await addDoc(collection(db,'tasks',currentTaskId,'chats'),{text,by:currentUser.email,byName:currentUser.displayName||currentUser.email,type:'message',timestamp:Date.now()});
  input.value='';
};
window.taskChatKeyDown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTaskChat();}};
function loadTaskChat(taskId){
  const el=document.getElementById('taskChatMessages');if(!el)return;
  el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Loading...</div>';
  if(_unsubTaskChat){_unsubTaskChat();_unsubTaskChat=null;}
  _unsubTaskChat=onSnapshot(query(collection(db,'tasks',taskId,'chats'),orderBy('timestamp','asc')),snap=>{
    let msgs=[];snap.forEach(c=>msgs.push({id:c.id,...c.data()}));
    if(!msgs.length){el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">No messages yet.</div>';return;}
    el.innerHTML=msgs.map(m=>{const me=m.by===currentUser.email;return`<div class="task-chat-msg${me?' mine':''}"><div class="chat-msg-meta">${m.byName||m.by} · ${timeAgo(m.timestamp)}</div><div class="chat-bubble${m.type==='update'?' bubble-update':''}">${m.type==='update'?'📊 ':''}${m.text}</div></div>`;}).join('');
    el.scrollTop=el.scrollHeight;
  });
}

// ═══════════════════════════════════════════════════════
//  CLIENTS MODULE
// ═══════════════════════════════════════════════════════

let clientSearch='',clientFilter='all';
function subscribeClients(){
  onSnapshot(collection(db,'clients'),snap=>{
    allClients=[];snap.forEach(c=>allClients.push({id:c.id,...c.data()}));
    renderClientList();populateClientSelect();setEl('statClients',allClients.length);
  });
}
function renderClientList(){
  const el=document.getElementById('clientList');if(!el)return;
  let list=allClients;
  if(clientFilter!=='all')list=list.filter(c=>c.type===clientFilter);
  if(clientSearch){const q=clientSearch.toLowerCase();list=list.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.city||'').toLowerCase().includes(q));}
  if(!list.length){el.innerHTML=emptyState('🏢','No clients found');return;}
  el.innerHTML=list.map(c=>`<div class="client-card" onclick="openClientDetail('${c.id}')">
    <div class="client-avatar">${(c.name||'C')[0].toUpperCase()}</div>
    <div class="client-info"><div class="client-name">${c.name}</div><div class="client-sub">${c.phone||''} ${c.city?'· '+c.city:''}</div>
    <div class="client-tags"><span class="tag">${c.type||'retail'}</span>${(c.outstanding||0)>0?`<span class="tag tag-danger">₹${Number(c.outstanding).toLocaleString('en-IN')} due</span>`:''}${(c.outstanding||0)===0&&c.totalPaid?`<span class="tag tag-success">Cleared</span>`:''}</div></div>
    <div class="client-arrow">›</div>
  </div>`).join('');
}
window.filterClients=(f)=>{clientFilter=f;renderClientList();};
window.searchClients=(q)=>{clientSearch=q;renderClientList();};
window.addClient=async()=>{
  const name=document.getElementById('cName')?.value.trim();const phone=document.getElementById('cPhone')?.value.trim();
  const email=document.getElementById('cEmail')?.value.trim();const type=document.getElementById('cType')?.value;
  const city=document.getElementById('cCity')?.value.trim();const gst=document.getElementById('cGst')?.value.trim();
  const address=document.getElementById('cAddress')?.value.trim();const notes=document.getElementById('cNotes')?.value.trim();
  if(!name)return toast('Client name required',true);if(!phone)return toast('Phone required',true);
  try{
    await addDoc(collection(db,'clients'),{name,phone,email:email||'',type:type||'retail',city:city||'',gst:gst||'',address:address||'',notes:notes||'',outstanding:0,totalPaid:0,totalBilled:0,teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email});
    toast('✅ Client added!');closeModal('addClientModal');
    ['cName','cPhone','cEmail','cCity','cGst','cAddress','cNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  }catch(e){toast('Error: '+e.message,true);}
};
window.openClientDetail=async(clientId)=>{
  viewingClientId=clientId;const client=allClients.find(c=>c.id===clientId);if(!client)return;
  const av=document.getElementById('cdAvatar');if(av)av.textContent=(client.name||'C')[0].toUpperCase();
  document.getElementById('cdName').textContent=client.name;
  const sub=document.getElementById('cdSubInfo');if(sub)sub.textContent=`${client.phone||'—'} ${client.city?'· '+client.city:''}`;
  document.getElementById('cdOutstanding').textContent='₹'+Number(client.outstanding||0).toLocaleString('en-IN');
  document.getElementById('cdTotalBilled').textContent='₹'+Number(client.totalBilled||0).toLocaleString('en-IN');
  document.getElementById('cdTotalPaid').textContent='₹'+Number(client.totalPaid||0).toLocaleString('en-IN');
  const today=new Date().toISOString().split('T')[0];
  ['orderDate','payDate'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.value)e.value=today;});
  loadClientOrders(clientId);loadClientPayments(clientId);loadClientContacts(clientId);openModal('clientDetailModal');
};
window.switchClientTab=(name,el)=>{
  ['orders','payments','contacts'].forEach(t=>{document.getElementById('clientTab-'+t).style.display=t===name?'block':'none';});
  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));if(el)el.classList.add('active');
};
window.addOrder=async()=>{
  if(!viewingClientId)return;
  const desc=document.getElementById('orderDesc')?.value.trim();const amount=parseFloat(document.getElementById('orderAmount')?.value)||0;
  const date=document.getElementById('orderDate')?.value;const status=document.getElementById('orderStatus')?.value;
  if(!desc)return toast('Order description required',true);
  try{
    await addDoc(collection(db,'clients',viewingClientId,'orders'),{desc,amount,date:date||new Date().toISOString().split('T')[0],status:status||'pending',createdAt:Date.now(),createdBy:currentUser.email});
    const client=allClients.find(c=>c.id===viewingClientId);
    await updateDoc(doc(db,'clients',viewingClientId),{totalBilled:(client?.totalBilled||0)+amount,outstanding:(client?.outstanding||0)+amount});
    toast('Order added');document.getElementById('orderDesc').value='';document.getElementById('orderAmount').value='';
  }catch(e){toast('Error: '+e.message,true);}
};
function loadClientOrders(clientId){
  const el=document.getElementById('clientOrdersList');if(!el)return;
  onSnapshot(collection(db,'clients',clientId,'orders'),snap=>{
    let orders=[];snap.forEach(c=>orders.push({id:c.id,...c.data()}));
    orders.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!orders.length){el.innerHTML=emptyState('📦','No orders yet');return;}
    el.innerHTML=orders.map(o=>`<div class="order-row"><div class="order-info"><div class="order-desc">${o.desc}</div><div class="order-meta">${o.date||'—'} · <span class="tag status-${o.status||'pending'}">${o.status||'pending'}</span></div></div><div class="order-amount">₹${Number(o.amount||0).toLocaleString('en-IN')}</div></div>`).join('');
  });
}
window.addPayment=async()=>{
  if(!viewingClientId)return;
  const amount=parseFloat(document.getElementById('payAmount')?.value)||0;const mode=document.getElementById('payMode')?.value;
  const refNo=document.getElementById('payRef')?.value.trim();const date=document.getElementById('payDate')?.value;
  if(!amount)return toast('Amount required',true);
  try{
    await addDoc(collection(db,'clients',viewingClientId,'payments'),{amount,mode:mode||'cash',ref:refNo||'',date:date||new Date().toISOString().split('T')[0],createdAt:Date.now(),createdBy:currentUser.email});
    const client=allClients.find(c=>c.id===viewingClientId);
    await updateDoc(doc(db,'clients',viewingClientId),{totalPaid:(client?.totalPaid||0)+amount,outstanding:Math.max(0,(client?.outstanding||0)-amount)});
    toast('✅ Payment recorded');document.getElementById('payAmount').value='';document.getElementById('payRef').value='';
    document.getElementById('cdOutstanding').textContent='₹'+Math.max(0,(client?.outstanding||0)-amount).toLocaleString('en-IN');
  }catch(e){toast('Error: '+e.message,true);}
};
function loadClientPayments(clientId){
  const el=document.getElementById('clientPaymentsList');if(!el)return;
  onSnapshot(collection(db,'clients',clientId,'payments'),snap=>{
    let pays=[];snap.forEach(c=>pays.push({id:c.id,...c.data()}));pays.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!pays.length){el.innerHTML=emptyState('💰','No payments yet');return;}
    el.innerHTML=pays.map(p=>`<div class="payment-row"><div class="pay-icon">💰</div><div class="pay-info"><div class="pay-mode">${p.mode||'cash'} ${p.ref?'· '+p.ref:''}</div><div class="pay-date">${p.date||'—'}</div></div><div class="pay-amount" style="color:var(--accent)">+₹${Number(p.amount||0).toLocaleString('en-IN')}</div></div>`).join('');
  });
}
window.addContact=async()=>{
  if(!viewingClientId)return;
  const cName=document.getElementById('contactName')?.value.trim();const cPhone=document.getElementById('contactPhone')?.value.trim();const cRole=document.getElementById('contactRole')?.value.trim();
  if(!cName||!cPhone)return toast('Name and phone required',true);
  try{await addDoc(collection(db,'clients',viewingClientId,'contacts'),{name:cName,phone:cPhone,role:cRole||'',createdAt:Date.now()});toast('Contact added');['contactName','contactPhone','contactRole'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});}catch(e){toast('Error: '+e.message,true);}
};
function loadClientContacts(clientId){
  const el=document.getElementById('clientContactsList');if(!el)return;
  onSnapshot(collection(db,'clients',clientId,'contacts'),snap=>{
    let contacts=[];snap.forEach(c=>contacts.push({id:c.id,...c.data()}));
    if(!contacts.length){el.innerHTML=emptyState('📞','No contacts yet');return;}
    el.innerHTML=contacts.map(c=>`<div class="contact-row"><div class="contact-avatar">${(c.name||'C')[0]}</div><div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-sub">${c.phone} ${c.role?'· '+c.role:''}</div></div><a href="tel:${c.phone}" class="btn-sm btn-done">📞</a></div>`).join('');
  });
}
function populateClientSelect(){const el=document.getElementById('taskClient');if(!el)return;el.innerHTML='<option value="">No Client</option>'+allClients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');}

// ═══════════════════════════════════════════════════════
//  NOTES MODULE
// ═══════════════════════════════════════════════════════

function subscribeNotes(){
  const ownerKey=safeKey(currentUser.email);
  onSnapshot(query(collection(db,'notes'),where('ownerKey','==',ownerKey)),snap=>{
    allNotes=[];snap.forEach(c=>allNotes.push({id:c.id,...c.data()}));
    allNotes.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    renderNoteList();
  });
}
function renderNoteList(){
  const el=document.getElementById('noteList');if(!el)return;
  const q=(document.getElementById('noteSearch')?.value||'').toLowerCase();
  let notes=allNotes;
  if(q)notes=notes.filter(n=>(n.title||'').toLowerCase().includes(q)||(n.content||'').toLowerCase().includes(q));
  if(!notes.length){el.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">No notes yet</div>';return;}
  el.innerHTML=notes.map(n=>`<div class="note-list-item${activeNoteId===n.id?' active':''}" onclick="openNoteById('${n.id}')" style="border-left:3px solid ${n.color||'var(--surface2)'}"><div class="note-list-title">${n.title||'Untitled'}</div><div class="note-list-preview">${(n.content||'').substring(0,60)}</div><div class="note-list-date">${formatDate(n.updatedAt||n.createdAt)}</div></div>`).join('');
}
window.openNoteById=(id)=>{
  const n=allNotes.find(n=>n.id===id);if(!n)return;
  activeNoteId=id;
  document.getElementById('noteEditorTitle').value=n.title||'';
  document.getElementById('noteEditorContent').value=n.content||'';
  document.getElementById('noteEditorContent').style.background=n.color||'var(--surface)';
  document.getElementById('noteCategory').value=n.category||'';
  document.querySelectorAll('.note-color-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.color===(n.color||'#181c24')));
  const empty=document.getElementById('noteEmptyState');if(empty)empty.style.display='none';
  renderNoteList();
};
window.newNote=async()=>{
  try{const r=await addDoc(collection(db,'notes'),{title:'',content:'',category:'',color:'#181c24',ownerKey:safeKey(currentUser.email),createdAt:Date.now(),updatedAt:Date.now(),createdBy:currentUser.email});activeNoteId=r.id;setTimeout(()=>openNoteById(r.id),300);}catch(e){toast('Error: '+e.message,true);}
};
window.saveNote=async()=>{
  if(!activeNoteId)return;
  const title=document.getElementById('noteEditorTitle')?.value.trim()||'Untitled';
  const content=document.getElementById('noteEditorContent')?.value||'';
  const category=document.getElementById('noteCategory')?.value||'';
  const color=document.querySelector('.note-color-btn.active')?.dataset.color||'#181c24';
  try{await updateDoc(doc(db,'notes',activeNoteId),{title,content,category,color,updatedAt:Date.now()});}catch(e){}
};
window.deleteCurrentNote=async()=>{
  if(!activeNoteId)return;if(!confirm('Delete this note?'))return;
  await deleteDoc(doc(db,'notes',activeNoteId));activeNoteId=null;
  document.getElementById('noteEditorTitle').value='';document.getElementById('noteEditorContent').value='';
  const empty=document.getElementById('noteEmptyState');if(empty)empty.style.display='flex';toast('Note deleted');
};
window.setNoteColor=(color)=>{
  document.querySelectorAll('.note-color-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.color===color));
  const c=document.getElementById('noteEditorContent');if(c)c.style.background=color;noteAutoSave();
};
let _noteTimer;
window.noteAutoSave=()=>{clearTimeout(_noteTimer);_noteTimer=setTimeout(saveNote,1500);};
window.renderNoteList=renderNoteList;

// ═══════════════════════════════════════════════════════
//  REMINDERS MODULE
// ═══════════════════════════════════════════════════════

function subscribeReminders(){
  onSnapshot(collection(db,'reminders'),snap=>{
    const raw=[];snap.forEach(c=>raw.push({id:c.id,...c.data()}));
    if(currentRole===ROLES.ADMIN)allReminders=raw;
    else if(currentRole===ROLES.LEADER)allReminders=raw.filter(r=>r.teamId===currentTeamId);
    else allReminders=raw.filter(r=>r.forEmail===currentUser.email||(r.forEmail==='all'&&r.teamId===currentTeamId));
    renderReminders();renderMyReminders();renderDashReminders();updateReminderBadge();
  });
}
function renderReminders(){
  const el=document.getElementById('remindersList');if(!el)return;
  if(!allReminders.length){el.innerHTML=emptyState('🔔','No reminders set');return;}
  const now=Date.now();
  el.innerHTML=allReminders.map(r=>{const ov=r.time<now&&r.status!=='done';return`<div class="reminder-item"><div class="reminder-icon">${ov?'⚠️':r.status==='done'?'✅':'🔔'}</div><div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time${ov?' overdue':''}">${formatDateTime(r.time)} ${r.forEmail&&r.forEmail!=='all'?'· '+r.forEmail:r.forEmail==='all'?'· All':''}</div></div><div style="display:flex;gap:6px">${r.status!=='done'?`<button class="btn-sm btn-done" onclick="doneReminder('${r.id}')">✅</button>`:''}<button class="btn-sm btn-del" onclick="deleteReminder('${r.id}')">🗑</button></div></div>`;}).join('');
}
function renderMyReminders(){
  const el=document.getElementById('myRemindersList');if(!el)return;
  if(!allReminders.length){el.innerHTML=emptyState('🔔','No reminders');return;}
  const now=Date.now();
  el.innerHTML=allReminders.map(r=>{const ov=r.time<now&&r.status!=='done';return`<div class="reminder-item"><div class="reminder-icon">${ov?'⚠️':r.status==='done'?'✅':'🔔'}</div><div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time${ov?' overdue':''}">${formatDateTime(r.time)}</div></div></div>`;}).join('');
}
function renderDashReminders(){
  const el=document.getElementById('dashReminderList');if(!el)return;
  const upcoming=allReminders.filter(r=>r.status!=='done').slice(0,4);
  if(!upcoming.length){el.innerHTML=emptyState('🔔','No upcoming reminders');return;}
  el.innerHTML=upcoming.map(r=>`<div class="reminder-item"><div class="reminder-icon">🔔</div><div class="reminder-body"><div class="reminder-title">${r.title}</div><div class="reminder-time">${formatDateTime(r.time)}</div></div></div>`).join('');
}
window.createReminder=async()=>{
  const title=document.getElementById('remTitle')?.value.trim();const time=document.getElementById('remTime')?.value;const forEmail=document.getElementById('remMember')?.value||'all';
  if(!title||!time)return toast('Fill all fields',true);
  try{await addDoc(collection(db,'reminders'),{title,time:new Date(time).getTime(),forEmail,status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email});toast('🔔 Reminder set!');document.getElementById('remTitle').value='';document.getElementById('remTime').value='';}catch(e){toast('Error: '+e.message,true);}
};
window.doneReminder=async(id)=>{await updateDoc(doc(db,'reminders',id),{status:'done'});toast('Done!');};
window.deleteReminder=async(id)=>{await deleteDoc(doc(db,'reminders',id));toast('Removed');};
function updateReminderBadge(){const p=allReminders.filter(r=>r.status!=='done').length;['reminderBadge','myReminderBadge'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=p;});}
function checkReminders(){
  const now=Date.now();
  allReminders.forEach(r=>{if(r.status==='pending'&&r.time<=now&&r.time>now-70000){toast('🔔 Reminder: '+r.title);if(Notification.permission==='granted')new Notification('TPS Reminder',{body:r.title});}});
}

// ═══════════════════════════════════════════════════════
//  ADMIN MODULE
// ═══════════════════════════════════════════════════════

let adminTeams=[],adminUsers=[];
function initAdminModule(){
  let latestUsers=null,latestRoles=null;
  function merge(){
    if(!latestUsers)return;adminUsers=[];
    latestUsers.forEach(c=>{adminUsers.push({id:c.id,...c.data(),role:latestRoles?.[c.id]?.role||'member'});});
    renderAdminUserList();
  }
  onSnapshot(collection(db,'users'),snap=>{latestUsers=snap;merge();});
  onSnapshot(collection(db,'roles'),snap=>{latestRoles={};snap.forEach(c=>{latestRoles[c.id]=c.data();});merge();});
  onSnapshot(collection(db,'teams'),snap=>{adminTeams=[];snap.forEach(c=>adminTeams.push({id:c.id,...c.data()}));renderAdminTeamList();populateAdminTeamSelect();});
}

window.adminCreateTeam=async()=>{
  const name=document.getElementById('newTeamName')?.value.trim();
  const email=document.getElementById('newTeamLeader')?.value.trim().toLowerCase();
  if(!name)return toast('Team name required',true);
  if(!email||!email.includes('@'))return toast('Valid leader email required',true);
  try{
    const k=safeKey(email);
    const teamRef=await addDoc(collection(db,'teams'),{name,leaderEmail:email,createdAt:Date.now(),members:{[k]:{email,role:'leader',addedAt:Date.now()}}});
    const teamId=teamRef.id;
    await setDoc(doc(db,'roles',k),{role:ROLES.LEADER,email,teamId,updatedAt:Date.now()});
    const us=await getDoc(doc(db,'users',k));
    if(!us.exists())await setDoc(doc(db,'users',k),{name:email.split('@')[0],email,photo:'',role:'leader',teamId,createdAt:Date.now()});
    else await updateDoc(doc(db,'users',k),{role:'leader',teamId,updatedAt:Date.now()});
    toast(`✅ Team "${name}" created! Leader: ${email}`);
    ['newTeamName','newTeamLeader'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  }catch(e){console.error(e);toast('❌ Error: '+e.message,true);}
};

window.adminAddMember=async()=>{
  const email=document.getElementById('newMemberEmailAdmin')?.value.trim().toLowerCase();
  const teamId=document.getElementById('memberTeamSelect')?.value;
  if(!email||!email.includes('@'))return toast('Valid email required',true);
  if(!teamId)return toast('Select a team first',true);
  try{
    const k=safeKey(email);
    await setDoc(doc(db,'roles',k),{role:ROLES.MEMBER,email,teamId,updatedAt:Date.now()});
    await updateDoc(doc(db,'teams',teamId),{[`members.${k}`]:{email,role:'member',addedAt:Date.now()}});
    const us=await getDoc(doc(db,'users',k));
    if(!us.exists())await setDoc(doc(db,'users',k),{name:email.split('@')[0],email,photo:'',role:'member',teamId,createdAt:Date.now()});
    else await updateDoc(doc(db,'users',k),{role:'member',teamId,updatedAt:Date.now()});
    toast(`✅ ${email} added as member`);document.getElementById('newMemberEmailAdmin').value='';
  }catch(e){toast('❌ Error: '+e.message,true);}
};

window.adminChangeRole=async(email,role)=>{await updateDoc(doc(db,'roles',safeKey(email)),{role,updatedAt:Date.now()});toast(`Role → ${role}`);};
window.adminDeleteTeam=async(id,name)=>{if(!confirm(`Delete team "${name}"?`))return;await deleteDoc(doc(db,'teams',id));toast('Team deleted');};

// ── Admin: Reset any user's PIN ──
window.adminResetUserPIN=async(email)=>{
  if(!confirm(`"${email}" ka PIN reset karo?\nWe unhein naya PIN set karna hoga.`))return;
  try{
    await deleteDoc(doc(db,'userPins',safeKey(email)));
    toast(`✅ PIN reset for ${email}`);
  }catch(e){toast('Error: '+e.message,true);}
};

function renderAdminUserList(){
  const el=document.getElementById('adminUserList');if(!el)return;
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
  const el=document.getElementById('adminTeamList');if(!el)return;
  if(!adminTeams.length){el.innerHTML=emptyState('🏢','No teams yet');return;}
  el.innerHTML=adminTeams.map(team=>{
    const members=team.members?Object.entries(team.members):[];
    return`<div class="admin-team-card"><div class="admin-team-header"><div><div class="admin-team-name">🏢 ${team.name}</div><div class="admin-team-leader">Leader: ${team.leaderEmail||'—'}</div></div><button class="btn-sm btn-del" onclick="adminDeleteTeam('${team.id}','${team.name}')">🗑</button></div><div class="team-members-wrap">${members.map(([k,m])=>`<span class="team-member-chip">${m.email}</span>`).join('')||'<span style="color:var(--muted);font-size:12px">No members</span>'}</div></div>`;
  }).join('');
}
function populateAdminTeamSelect(){const el=document.getElementById('memberTeamSelect');if(!el)return;el.innerHTML='<option value="">Select Team...</option>'+adminTeams.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════

function renderDashboard(){
  const now=Date.now();let total=0,done=0,progress=0,overdue=0;
  allTasks.forEach(t=>{total++;if(t.status==='done')done++;else if(t.status==='inprogress')progress++;if(t.status!=='done'&&t.dueDate&&new Date(t.dueDate).getTime()<now)overdue++;});
  setEl('statTotal',total);setEl('statDone',done);setEl('statProgress',progress);setEl('statOverdue',overdue);
}
function renderMyProgress(){
  const total=allTasks.length,done=allTasks.filter(t=>t.status==='done').length,pct=total?Math.round((done/total)*100):0;
  setEl('myStatTotal',total);setEl('myStatDone',done);setEl('myStatPending',total-done);setEl('myProgressPct',pct+'%');
  const fill=document.getElementById('myProgressFill');if(fill)fill.style.width=pct+'%';
}

// ═══════════════════════════════════════════════════════
//  AI FLOAT — No separate PIN needed (app PIN handles security)
// ═══════════════════════════════════════════════════════

function initAIFloat(){ const b=document.getElementById('aiFloatBtn');if(b)b.style.display='flex'; }
window.openAIFloat=()=>openAIChat();
window.closeAIFloat=()=>{document.getElementById('aiFloatChat').classList.remove('open');document.getElementById('aiFloatBtn').style.display='flex';};
function openAIChat(){
  const chat=document.getElementById('aiFloatChat'),btn=document.getElementById('aiFloatBtn');
  chat.classList.add('open');btn.style.display='none';
  const msgs=document.getElementById('aiFloatMessages');
  if(!msgs.children.length)addAIMsg(getWelcomeMsg(),false);
}
function getWelcomeMsg(){return`<strong>TPS AI Assistant</strong> — <span style="color:var(--accent)">Wisefox Solution</span> 🦊<br/><br/>Main kya kar sakta hoon:<br/>• 📝 <strong>Note:</strong> "Note: Client call Friday 4pm"<br/>• 📋 <strong>Task:</strong> "Rahul ko task do, due 30 June, high priority"<br/>• 🔔 <strong>Reminder:</strong> "Kal 9 baje meeting reminder"<br/>• 📊 <strong>Status:</strong> "Team ka status dikhao"<br/><br/>💡 Hindi, English, Hinglish — sab samajhta hoon!`;}
window.sendAIChat=async()=>{const input=document.getElementById('aiFloatInput');const msg=input.value.trim();if(!msg)return;input.value='';addAIMsg(msg,true);showAITyping();setTimeout(async()=>{const res=await processAI(msg);removeAITyping();addAIMsg(res,false);},600);};
window.aiFloatKeyDown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAIChat();}};
function addAIMsg(text,isUser){const el=document.getElementById('aiFloatMessages');const div=document.createElement('div');div.className='float-msg'+(isUser?' user':'');div.innerHTML=`<div class="float-bubble">${text}</div>`;el.appendChild(div);el.scrollTop=el.scrollHeight;}
let typingEl=null;
function showAITyping(){const el=document.getElementById('aiFloatMessages');typingEl=document.createElement('div');typingEl.className='float-msg';typingEl.innerHTML='<div class="float-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';el.appendChild(typingEl);el.scrollTop=el.scrollHeight;}
function removeAITyping(){if(typingEl){typingEl.remove();typingEl=null;}}
async function processAI(msg){const key=await getApiKey();if(key)return callOpenAI(msg,key);return localAI(msg);}
async function getApiKey(){
  if(cachedApiKey)return cachedApiKey;
  try{const s=await getDoc(doc(db,'settings','config'));if(s.exists()&&s.data().openaiApiKey){cachedApiKey=s.data().openaiApiKey;return cachedApiKey;}}catch(e){}
  return null;
}
async function callOpenAI(msg,apiKey){
  const ctx=`You are TPS AI Assistant. Team: ${allMembers.map(m=>m.name||m.email).join(',')||'None'} Tasks: ${allTasks.length} Clients: ${allClients.length} Today: ${new Date().toISOString().split('T')[0]}\nFor actions: {"action":"note","content":"..."} {"action":"task","title":"...","assigneeName":"...","priority":"high/medium/low","dueDate":"YYYY-MM-DD"} {"action":"reminder","title":"...","hoursFromNow":1}\nFor general: clean HTML. Language: Hindi/English/Hinglish.`;
  try{
    const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'gpt-4o',max_tokens:600,temperature:0.4,messages:[{role:'system',content:ctx},{role:'user',content:msg}]})});
    if(!res.ok)throw new Error('API error');
    const data=await res.json();const text=(data.choices?.[0]?.message?.content||'').trim();
    try{const match=text.match(/\{[\s\S]*\}/);if(match){const a=JSON.parse(match[0]);if(a.action)return execAIAction(a,msg);}}catch(e){}
    return text;
  }catch(e){return localAI(msg);}
}
async function execAIAction(a,orig){
  if(a.action==='note'){const content=a.content||orig;await addDoc(collection(db,'notes'),{content,title:content.substring(0,30),category:'',color:'#181c24',ownerKey:safeKey(currentUser.email),createdAt:Date.now(),updatedAt:Date.now(),createdBy:currentUser.email});return`✅ <strong>Note saved!</strong><br/>"${content}"`;}
  if(a.action==='task'){const m=allMembers.find(m=>(m.name||'').toLowerCase().includes((a.assigneeName||'').toLowerCase())||m.email.includes((a.assigneeName||'').toLowerCase()));if(!m)return`❌ Member nahi mila: "${a.assigneeName}"<br/>Available: ${allMembers.map(m=>m.name||m.email).join(',')||'No members'}`;await addDoc(collection(db,'tasks'),{title:a.title,desc:a.description||'',assigneeEmail:m.email,assigneeName:m.name||m.email,priority:a.priority||'medium',dueDate:a.dueDate||'',status:'pending',teamId:currentTeamId||'',createdAt:Date.now(),createdBy:currentUser.email,source:'ai'});return`✅ <strong>Task!</strong> 📋 ${a.title} 👤 ${m.name||m.email}`;}
  if(a.action==='reminder'){const t=Date.now()+((parseFloat(a.hoursFromNow)||1)*3600000);await addDoc(collection(db,'reminders'),{title:a.title,time:t,forEmail:'all',status:'pending',createdAt:Date.now(),createdBy:currentUser.email});return`✅ <strong>Reminder!</strong> 🔔 "${a.title}" ⏰ ${new Date(t).toLocaleString()}`;}
  return'🤔 Unknown action';
}
function localAI(msg){const l=msg.toLowerCase();if(l.includes('status')||l.includes('report')||l.includes('kitne')){const done=allTasks.filter(t=>t.status==='done').length;return`📊 <strong>Team Status</strong><br/>Total: ${allTasks.length} | ✅ Done: ${done} | 🔄 Pending: ${allTasks.length-done}<br/>Clients: ${allClients.length} | Members: ${allMembers.length}`;}return`🤔 Samajh nahi aaya: "${msg.substring(0,50)}"<br/><small>Settings → OpenAI API Key add karo for full AI!</small>`;}

// ── API Key & PIN Settings ──
async function loadApiKeyStatus(){const key=await getApiKey();const el=document.getElementById('apiKeyStatus');if(!el)return;if(key){el.textContent='✅ Active';el.style.background='rgba(0,229,160,0.15)';el.style.color='var(--accent)';}else{el.textContent='Not Set';el.style.background='rgba(255,107,107,0.15)';el.style.color='#ff6b6b';}}
window.saveApiKey=async()=>{const key=document.getElementById('apiKeyInput')?.value.trim();if(!key)return toast('API Key empty',true);if(!key.startsWith('sk-'))return toast('Invalid key',true);await setDoc(doc(db,'settings','config'),{openaiApiKey:key},{merge:true});cachedApiKey=key;loadApiKeyStatus();toast('✅ API Key saved!');document.getElementById('apiKeyInput').value='';};
window.clearApiKey=async()=>{if(!confirm('Remove API Key?'))return;await updateDoc(doc(db,'settings','config'),{openaiApiKey:''});cachedApiKey=null;loadApiKeyStatus();toast('API Key removed');};
window.toggleApiKeyVisibility=()=>{const inp=document.getElementById('apiKeyInput');inp.type=inp.type==='password'?'text':'password';};

// ── Change own PIN from Settings ──
window.changePIN=async()=>{
  const oldPin=document.getElementById('changePinOld')?.value.trim();
  const newPin=document.getElementById('changePinNew')?.value.trim();
  if(!oldPin||!newPin)return toast('Fill all fields',true);
  if(newPin.length!==4||!/^\d+$/.test(newPin))return toast('PIN must be exactly 4 digits',true);
  try{
    const k=safeKey(currentUser.email);
    const snap=await getDoc(doc(db,'userPins',k));
    if(!snap.exists())return toast('No PIN found',true);
   const validOld=(await hashPIN(oldPin))===snap.data().pinHash;
    if(!validOld)return toast('❌ Wrong current PIN',true);
    const now=Date.now();
    await setDoc(doc(db,'userPins',k),{pinHash:await hashPIN(newPin),email:currentUser.email,setAt:now,expiresAt:now+(PIN_EXPIRY_DAYS*86400000)});
    toast('✅ PIN changed!');
    ['changePinOld','changePinNew'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  }catch(e){toast('Error: '+e.message,true);}
};
