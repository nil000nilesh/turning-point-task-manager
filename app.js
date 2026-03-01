// ══════════════════════════════════════════
//  TPS Client Desk — Main App Entry
//  Powered by Wisefox Solution
// ══════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import { firebaseConfig, ROLES, ADMIN_EMAIL } from './config.js';
import { showScreen, showView, toast } from './ui.js';
import { initAuth, loginWithGoogle as _login, logout as _logout, resolveRole, resolveTeam, registerUser, currentUser as _cu } from './auth.js';
import { initAdmin } from './admin.js';
import { initTasks, allTasks, renderMyTasks, renderAllTasksList, renderRecentTasks, updateMembers } from './tasks.js';
import { initClients, allClients, renderClientList, populateClientSelects } from './clients.js';
import { initNotes } from './notes.js';
import { initReminders, populateReminderMemberSelect, allReminders } from './reminders.js';
import { initMembers, allMembers, renderMembers } from './members.js';
import { initAI, updateAIContext, loadApiKeyStatus } from './ai-float.js';
import { renderDashboard, renderMyProgress } from './dashboard.js';

// ── Firebase init ──
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getDatabase(app);
const provider=new GoogleAuthProvider();
const dbFns={ref,set,get,push,onValue,update,remove};

let currentUser=null, currentRole=ROLES.MEMBER, currentTeamId=null;

// ── Auth state ──
onAuthStateChanged(auth, async user => {
  if(user) {
    currentUser=user;
    currentRole=await resolveRole(user);
    currentTeamId=await resolveTeam(user);
    await registerUser(user);
    await initApp();
  } else {
    showScreen('login');
  }
});

async function initApp() {
  showScreen('app');
  setupSidebar();

  if(currentRole===ROLES.ADMIN) {
    document.getElementById('adminNav').style.display='block';
    document.getElementById('leaderNav').style.display='block';
    document.getElementById('sidebarRole').textContent='⚡ Admin';
    document.getElementById('sidebarRole').classList.add('admin');
    initModulesLeader();
    initAdmin(db, dbFns);
    showView('dashboard');
  } else if(currentRole===ROLES.LEADER) {
    document.getElementById('leaderNav').style.display='block';
    document.getElementById('sidebarRole').textContent='👑 Leader';
    initModulesLeader();
    showView('dashboard');
  } else {
    document.getElementById('memberNav').style.display='block';
    document.getElementById('sidebarRole').textContent='🧑‍💼 Staff';
    document.getElementById('sidebarRole').classList.add('member');
    initModulesMember();
    showView('my-tasks');
  }

  // Init auth module
  initAuth(auth, db, provider, dbFns);
}

function initModulesLeader() {
  initTasks(db, dbFns, currentUser, currentRole, currentTeamId);
  initClients(db, dbFns, currentUser, currentTeamId);
  initNotes(db, dbFns, currentUser);
  initReminders(db, dbFns, currentUser, currentRole, currentTeamId);
  initMembers(db, dbFns, currentUser, currentTeamId);
  initAI(db, dbFns, currentUser);

  // Cross-module wiring
  document.addEventListener('membersUpdated', e => {
    const members=e.detail;
    updateMembers(members);
    populateReminderMemberSelect(members);
    populateClientSelects();
    updateAIContext(allTasks, members);
  });
  document.addEventListener('tasksUpdated', () => {
    renderDashboard(allTasks, allMembers, allClients, currentUser);
    updateAIContext(allTasks, allMembers);
  });
  document.addEventListener('viewChanged', e => {
    if(e.detail==='settings') loadApiKeyStatus();
    if(e.detail==='dashboard') renderDashboard(allTasks, allMembers, allClients, currentUser);
  });
}

function initModulesMember() {
  initTasks(db, dbFns, currentUser, currentRole, currentTeamId);
  initReminders(db, dbFns, currentUser, currentRole, currentTeamId);
  initAI(db, dbFns, currentUser);
  document.addEventListener('tasksUpdated',()=>renderMyProgress(allTasks, currentUser));
}

function setupSidebar() {
  const av=document.getElementById('sidebarAvatar');
  if(currentUser.photoURL) av.innerHTML=`<img src="${currentUser.photoURL}"/>`;
  else av.textContent=(currentUser.displayName||'U')[0].toUpperCase();
  document.getElementById('sidebarName').textContent=currentUser.displayName||currentUser.email;
  // Notify permission
  if(Notification.permission==='default') Notification.requestPermission();
}

// ── Expose globals ──
window.loginWithGoogle = ()=>_login();
window.logout = ()=>_logout();
