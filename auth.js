// ══════════════════════════════════════════
//  TPS Client Desk — Authentication
// ══════════════════════════════════════════
import { ADMIN_EMAIL, ROLES } from './config.js';
import { toast, showScreen, safeKey } from './ui.js';

export let currentUser = null;
export let currentRole = ROLES.MEMBER;
export let currentTeamId = null;

let _auth, _db, _provider, _ref, _get, _set;

export function initAuth(auth, db, provider, dbFns) {
  _auth = auth; _db = db; _provider = provider;
  _ref = dbFns.ref; _get = dbFns.get; _set = dbFns.set;
}

export async function loginWithGoogle() {
  try {
    const { signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
    await signInWithPopup(_auth, _provider);
  } catch(e) { toast('Login failed: ' + e.message, true); }
}
window.loginWithGoogle = loginWithGoogle;

export async function logout() {
  const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  await signOut(_auth);
  currentUser = null;
  showScreen('login');
}
window.logout = logout;

export async function resolveRole(user) {
  if (user.email === ADMIN_EMAIL) return ROLES.ADMIN;
  const snap = await _get(_ref(_db, `roles/${safeKey(user.email)}`));
  if (snap.exists()) return snap.val().role || ROLES.MEMBER;
  return ROLES.MEMBER;
}

export async function resolveTeam(user) {
  const snap = await _get(_ref(_db, 'teams'));
  if (!snap.exists()) return null;
  let teamId = null;
  snap.forEach(child => {
    const t = child.val();
    if (t.leaderEmail === user.email) teamId = child.key;
    if (t.members && t.members[safeKey(user.email)]) teamId = child.key;
  });
  return teamId;
}

export async function registerUser(user) {
  const key = safeKey(user.email);
  const snap = await _get(_ref(_db, `users/${key}`));
  const data = {
    name: user.displayName || user.email.split('@')[0],
    email: user.email,
    photo: user.photoURL || '',
    lastSeen: Date.now()
  };
  if (!snap.exists()) data.createdAt = Date.now();
  await _set(_ref(_db, `users/${key}`), snap.exists() ? { ...snap.val(), ...data } : data);
}
