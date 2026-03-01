// ══════════════════════════════════════════
//  TPS Client Desk — Tasks Module
// ══════════════════════════════════════════
import { toast, emptyState, formatDate, timeAgo, safeKey, openModal, closeModal } from './ui.js';
import { TASK_STATUSES, PRIORITIES } from './config.js';

let _db, _ref, _get, _set, _push, _onValue, _update, _remove;
let _currentUser, _currentRole, _currentTeamId;
export let allTasks=[];
let allMembers=[];

export function initTasks(db, dbFns, user, role, teamId) {
  _db=db; _ref=dbFns.ref; _get=dbFns.get; _set=dbFns.set;
  _push=dbFns.push; _onValue=dbFns.onValue; _update=dbFns.update; _remove=dbFns.remove;
  _currentUser=user; _currentRole=role; _currentTeamId=teamId;
  subscribeTasksMembers();
}

export function updateMembers(members) { allMembers=members; populateAssigneeSelects(); }

function subscribeTasksMembers() {
  // Subscribe tasks scoped to team or all
  _onValue(_ref(_db,'tasks'), snap => {
    const raw=[];
    if(snap.exists()) snap.forEach(c=>raw.push({id:c.key,...c.val()}));
    // Filter: member sees own tasks; leader/admin sees team tasks
    if(_currentRole==='member') {
      allTasks=raw.filter(t=>t.assigneeEmail===_currentUser.email);
    } else if(_currentRole==='leader') {
      allTasks=raw.filter(t=>t.teamId===_currentTeamId||(!t.teamId&&t.createdBy===_currentUser.email));
    } else {
      allTasks=raw; // admin sees all
    }
    renderMyTasks();
    renderAllTasksList('all');
    renderRecentTasks();
    updateTaskBadge();
    document.dispatchEvent(new CustomEvent('tasksUpdated'));
  });
}

// ── Render: My Tasks (member view) ──
export function renderMyTasks() {
  const el=document.getElementById('myTasksList'); if(!el) return;
  if(!allTasks.length){el.innerHTML=emptyState('📋','No tasks assigned yet');return;}
  el.innerHTML=allTasks.map(t=>memberTaskCard(t)).join('');
}

function memberTaskCard(t) {
  const overdue = t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='done';
  return `<div class="task-item ${overdue?'overdue-task':''}">
    <div class="task-status-pill status-${t.status||'pending'}">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title ${t.status==='done'?'done':''}">${t.title}</div>
      ${t.desc?`<div class="task-desc">${t.desc}</div>`:''}
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag status-${t.status||'pending'}">${t.status||'pending'}</span>
        ${t.dueDate?`<span class="tag ${overdue?'tag-danger':''}">📅 ${t.dueDate}</span>`:''}
        ${t.clientName?`<span class="tag">👤 ${t.clientName}</span>`:''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-sm btn-update" onclick="openTaskUpdate('${t.id}')">💬 Update</button>
    </div>
  </div>`;
}

// ── Render: All Tasks (leader/admin view) ──
let currentFilter='all';
export function renderAllTasksList(filter) {
  currentFilter=filter||currentFilter;
  const el=document.getElementById('allTasksList'); if(!el) return;
  let tasks=allTasks;
  if(currentFilter==='pending') tasks=allTasks.filter(t=>t.status==='pending');
  else if(currentFilter==='inprogress') tasks=allTasks.filter(t=>t.status==='inprogress');
  else if(currentFilter==='done') tasks=allTasks.filter(t=>t.status==='done');
  else if(currentFilter==='overdue') tasks=allTasks.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=='done');
  if(!tasks.length){el.innerHTML=emptyState('📋','No tasks found');return;}
  el.innerHTML=tasks.map(t=>leaderTaskCard(t)).join('');
}
window.renderAllTasksList = renderAllTasksList;

function leaderTaskCard(t) {
  return `<div class="task-item">
    <div class="task-status-pill status-${t.status||'pending'}">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title ${t.status==='done'?'done':''}">${t.title}</div>
      ${t.desc?`<div class="task-desc">${t.desc}</div>`:''}
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag status-${t.status||'pending'}">${t.status||'pending'}</span>
        ${t.dueDate?`<span class="tag">📅 ${t.dueDate}</span>`:''}
        <span class="tag">👤 ${t.assigneeName||t.assigneeEmail||'Unassigned'}</span>
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

export function renderRecentTasks() {
  const el=document.getElementById('recentTasksList'); if(!el) return;
  const recent=allTasks.slice(-5).reverse();
  if(!recent.length){el.innerHTML=emptyState('📋','No tasks yet');return;}
  el.innerHTML=recent.map(t=>`<div class="task-item compact">
    <div class="task-status-pill status-${t.status||'pending'}">${statusIcon(t.status)}</div>
    <div class="task-body">
      <div class="task-title">${t.title}</div>
      <div class="task-meta">
        <span class="tag priority-${t.priority||'medium'}">${t.priority||'medium'}</span>
        <span class="tag">👤 ${t.assigneeName||'—'}</span>
      </div>
    </div>
  </div>`).join('');
}

function statusIcon(s) {
  return s==='done'?'✅':s==='inprogress'?'🔄':s==='review'?'👁':'⏳';
}

// ── Create Task ──
window.createTask = async () => {
  const title=document.getElementById('taskTitle')?.value.trim();
  const desc=document.getElementById('taskDesc')?.value.trim();
  const assigneeEmail=document.getElementById('taskAssignee')?.value;
  const priority=document.getElementById('taskPriority')?.value||'medium';
  const dueDate=document.getElementById('taskDue')?.value;
  const clientId=document.getElementById('taskClient')?.value;
  if(!title) return toast('Task title required',true);
  if(!assigneeEmail) return toast('Select assignee',true);
  const member=allMembers.find(m=>m.email===assigneeEmail)||{email:assigneeEmail,name:assigneeEmail};
  const clientName = clientId ? (document.getElementById('taskClient')?.options[document.getElementById('taskClient')?.selectedIndex]?.text||'') : '';
  await _push(_ref(_db,'tasks'),{
    title,desc:desc||'',assigneeEmail:member.email,assigneeName:member.name||member.email,
    priority,dueDate:dueDate||'',status:'pending',clientId:clientId||'',clientName:clientName||'',
    teamId:_currentTeamId||'',createdAt:Date.now(),createdBy:_currentUser.email,createdByName:_currentUser.displayName||''
  });
  toast('✅ Task assigned!');
  document.getElementById('taskTitle').value='';
  document.getElementById('taskDesc').value='';
  document.getElementById('taskDue').value='';
};

window.deleteTask = async (id) => {
  if(!confirm('Delete task?')) return;
  await _remove(_ref(_db,`tasks/${id}`));
  toast('Task deleted');
};

window.cycleTaskStatus = async (id, current) => {
  const order=['pending','inprogress','review','done'];
  const next=order[(order.indexOf(current)+1)%order.length];
  await _update(_ref(_db,`tasks/${id}`),{status:next,updatedAt:Date.now()});
  toast(`Status → ${next}`);
};

// ── Task Update / Chat Modal ──
let currentTaskId=null;
window.openTaskUpdate = async (taskId) => {
  currentTaskId=taskId;
  const task=allTasks.find(t=>t.id===taskId);
  if(!task) return;
  document.getElementById('taskUpdateTitle').textContent=task.title;
  document.getElementById('taskUpdateStatus').value=task.status||'pending';
  document.getElementById('taskUpdateAssignee').textContent=task.assigneeName||task.assigneeEmail||'—';
  document.getElementById('taskUpdateDue').textContent=task.dueDate||'No due date';
  loadTaskChat(taskId);
  openModal('taskUpdateModal');
};

window.saveTaskUpdate = async () => {
  if(!currentTaskId) return;
  const newStatus=document.getElementById('taskUpdateStatus').value;
  const note=document.getElementById('taskUpdateNote').value.trim();
  const updates={status:newStatus,updatedAt:Date.now(),updatedBy:_currentUser.email};
  await _update(_ref(_db,`tasks/${currentTaskId}`),updates);
  if(note) {
    await _push(_ref(_db,`taskChats/${currentTaskId}`),{
      text:note,by:_currentUser.email,byName:_currentUser.displayName||_currentUser.email,
      type:'update',timestamp:Date.now()
    });
    document.getElementById('taskUpdateNote').value='';
  }
  toast('Task updated!');
};

window.sendTaskChat = async () => {
  if(!currentTaskId) return;
  const input=document.getElementById('taskChatInput');
  const text=input.value.trim();
  if(!text) return;
  await _push(_ref(_db,`taskChats/${currentTaskId}`),{
    text,by:_currentUser.email,byName:_currentUser.displayName||_currentUser.email,
    type:'message',timestamp:Date.now()
  });
  input.value='';
};

window.taskChatKeyDown = (e)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTaskChat();} };

function loadTaskChat(taskId) {
  const el=document.getElementById('taskChatMessages');
  if(!el) return;
  el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center">Loading...</div>';
  _onValue(_ref(_db,`taskChats/${taskId}`), snap=>{
    let msgs=[];
    if(snap.exists()) snap.forEach(c=>msgs.push({id:c.key,...c.val()}));
    if(!msgs.length){el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">No messages yet. Start the conversation!</div>';return;}
    el.innerHTML=msgs.map(m=>{
      const isMe=m.by===_currentUser.email;
      return `<div class="task-chat-msg ${isMe?'mine':''}">
        <div class="chat-msg-meta">${m.byName||m.by} · ${timeAgo(m.timestamp)}</div>
        <div class="chat-bubble ${m.type==='update'?'bubble-update':''}">${m.type==='update'?'📊 ':''} ${m.text}</div>
      </div>`;
    }).join('');
    el.scrollTop=el.scrollHeight;
  });
}

function updateTaskBadge() {
  const el=document.getElementById('myTaskBadge');
  if(el) el.textContent=allTasks.filter(t=>t.status!=='done').length;
  const el2=document.getElementById('taskBadge');
  if(el2) el2.textContent=allTasks.filter(t=>t.status!=='done').length;
}

function populateAssigneeSelects() {
  ['taskAssignee'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML='<option value="">Select Member...</option>'+
      allMembers.map(m=>`<option value="${m.email}">${m.name||m.email}</option>`).join('');
  });
}
