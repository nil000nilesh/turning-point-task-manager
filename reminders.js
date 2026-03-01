// ══════════════════════════════════════════
//  TPS Client Desk — Reminders
// ══════════════════════════════════════════
import { toast, emptyState, formatDateTime } from './ui.js';

let _db, _ref, _push, _onValue, _update, _remove;
let _currentUser, _currentRole, _currentTeamId;
export let allReminders=[];

export function initReminders(db, dbFns, user, role, teamId) {
  _db=db; _ref=dbFns.ref; _push=dbFns.push; _onValue=dbFns.onValue;
  _update=dbFns.update; _remove=dbFns.remove;
  _currentUser=user; _currentRole=role; _currentTeamId=teamId;
  _onValue(_ref(_db,'reminders'), snap=>{
    const raw=[];
    if(snap.exists()) snap.forEach(c=>raw.push({id:c.key,...c.val()}));
    if(_currentRole==='member') {
      allReminders=raw.filter(r=>r.forEmail===_currentUser.email||r.forEmail==='all');
    } else {
      allReminders=raw;
    }
    renderReminders();
    renderMyReminders();
    renderDashReminders();
    updateReminderBadge();
  });
  setInterval(checkReminders, 60000);
}

export let allMembersRef=[];
export function updateMembersRef(m){allMembersRef=m;}

window.createReminder = async () => {
  const title=document.getElementById('remTitle')?.value.trim();
  const time=document.getElementById('remTime')?.value;
  const forEmail=document.getElementById('remMember')?.value||'all';
  if(!title||!time) return toast('Fill all fields',true);
  await _push(_ref(_db,'reminders'),{
    title,time:new Date(time).getTime(),forEmail,status:'pending',
    teamId:_currentTeamId||'',createdAt:Date.now(),createdBy:_currentUser.email
  });
  toast('🔔 Reminder set!');
  document.getElementById('remTitle').value='';
  document.getElementById('remTime').value='';
};

export function renderReminders() {
  const el=document.getElementById('remindersList'); if(!el) return;
  if(!allReminders.length){el.innerHTML=emptyState('🔔','No reminders');return;}
  const now=Date.now();
  el.innerHTML=allReminders.map(r=>{
    const overdue=r.time<now&&r.status!=='done';
    return `<div class="reminder-item">
      <div class="reminder-icon ${overdue?'overdue':r.status==='done'?'done':'pending'}">${overdue?'⚠️':r.status==='done'?'✅':'🔔'}</div>
      <div class="reminder-body">
        <div class="reminder-title">${r.title}</div>
        <div class="reminder-time ${overdue?'overdue':''}">${formatDateTime(r.time)} ${r.forEmail&&r.forEmail!=='all'?'· '+r.forEmail:r.forEmail==='all'?'· All Members':''}</div>
      </div>
      <div style="display:flex;gap:6px">
        ${r.status!=='done'?`<button class="btn-sm btn-done" onclick="doneReminder('${r.id}')">✅</button>`:''}
        <button class="btn-sm btn-del" onclick="deleteReminder('${r.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

export function renderMyReminders() {
  const el=document.getElementById('myRemindersList'); if(!el) return;
  const mine=allReminders.filter(r=>r.forEmail===_currentUser.email||r.forEmail==='all');
  if(!mine.length){el.innerHTML=emptyState('🔔','No reminders for you');return;}
  const now=Date.now();
  el.innerHTML=mine.map(r=>{
    const overdue=r.time<now&&r.status!=='done';
    return `<div class="reminder-item">
      <div class="reminder-icon ${overdue?'overdue':r.status==='done'?'done':'pending'}">${overdue?'⚠️':r.status==='done'?'✅':'🔔'}</div>
      <div class="reminder-body">
        <div class="reminder-title">${r.title}</div>
        <div class="reminder-time ${overdue?'overdue':''}">${formatDateTime(r.time)}</div>
      </div>
    </div>`;
  }).join('');
}

export function renderDashReminders() {
  const el=document.getElementById('dashReminderList'); if(!el) return;
  const upcoming=allReminders.filter(r=>r.status!=='done').slice(0,4);
  if(!upcoming.length){el.innerHTML=emptyState('🔔','No upcoming reminders');return;}
  el.innerHTML=upcoming.map(r=>`<div class="reminder-item compact">
    <div class="reminder-icon pending">🔔</div>
    <div class="reminder-body">
      <div class="reminder-title">${r.title}</div>
      <div class="reminder-time">${formatDateTime(r.time)}</div>
    </div>
  </div>`).join('');
}

window.doneReminder = async (id) => {
  await _update(_ref(_db,`reminders/${id}`),{status:'done'});
  toast('Reminder marked done');
};

window.deleteReminder = async (id) => {
  await _remove(_ref(_db,`reminders/${id}`));
  toast('Reminder removed');
};

function updateReminderBadge() {
  const pending=allReminders.filter(r=>r.status!=='done').length;
  ['reminderBadge','myReminderBadge'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent=pending;
  });
}

function checkReminders() {
  const now=Date.now();
  allReminders.forEach(r=>{
    if(r.status==='pending'&&r.time<=now&&r.time>now-70000) {
      toast('🔔 Reminder: '+r.title);
      if(Notification.permission==='granted') {
        new Notification('TPS Reminder', {body:r.title,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎯</text></svg>'});
      }
    }
  });
}

export function populateReminderMemberSelect(members) {
  const el=document.getElementById('remMember'); if(!el) return;
  el.innerHTML='<option value="all">All Members</option>'+
    members.map(m=>`<option value="${m.email}">${m.name||m.email}</option>`).join('');
}
