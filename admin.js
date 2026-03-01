// ══════════════════════════════════════════
//  TPS Client Desk — Admin Panel
// ══════════════════════════════════════════
import { toast, emptyState, safeKey } from './ui.js';
import { ROLES } from './config.js';

let _db, _ref, _get, _set, _push, _onValue, _update, _remove;
export function initAdmin(db, dbFns) {
  _db=db; _ref=dbFns.ref; _get=dbFns.get; _set=dbFns.set;
  _push=dbFns.push; _onValue=dbFns.onValue; _update=dbFns.update; _remove=dbFns.remove;
  loadAdminData();
}

let allUsers=[], allTeams=[];

function loadAdminData() {
  _onValue(_ref(_db,'users'), snap => {
    allUsers=[];
    if(snap.exists()) snap.forEach(c => allUsers.push({id:c.key,...c.val()}));
    renderUserList(); populateLeaderSelect(); populateMemberTeamSelect();
  });
  _onValue(_ref(_db,'teams'), snap => {
    allTeams=[];
    if(snap.exists()) snap.forEach(c => allTeams.push({id:c.key,...c.val()}));
    renderTeamList(); populateMemberTeamSelect();
  });
}

window.adminCreateTeam = async () => {
  const name=document.getElementById('newTeamName').value.trim();
  const leaderEmail=document.getElementById('newTeamLeader').value.trim().toLowerCase();
  if(!name) return toast('Team name required',true);
  if(!leaderEmail||!leaderEmail.includes('@')) return toast('Valid leader email required',true);
  const k=safeKey(leaderEmail);
  await _set(_ref(_db,`roles/${k}`),{role:ROLES.LEADER,email:leaderEmail,updatedAt:Date.now()});
  await _push(_ref(_db,'teams'),{name,leaderEmail,createdAt:Date.now(),members:{}});
  toast(`✅ Team "${name}" created! ${leaderEmail} is now a Leader.`);
  document.getElementById('newTeamName').value='';
  document.getElementById('newTeamLeader').value='';
};

window.adminAddMember = async () => {
  const email=document.getElementById('newMemberEmailAdmin').value.trim().toLowerCase();
  const teamId=document.getElementById('memberTeamSelect').value;
  if(!email||!email.includes('@')) return toast('Valid email required',true);
  if(!teamId) return toast('Select a team',true);
  const k=safeKey(email);
  await _set(_ref(_db,`roles/${k}`),{role:ROLES.MEMBER,email,teamId,updatedAt:Date.now()});
  await _set(_ref(_db,`teams/${teamId}/members/${k}`),{email,addedAt:Date.now()});
  toast(`✅ ${email} added to team`);
  document.getElementById('newMemberEmailAdmin').value='';
};

window.adminChangeRole = async (email, role) => {
  await _update(_ref(_db,`roles/${safeKey(email)}`),{role,updatedAt:Date.now()});
  toast(`Role → ${role}`);
};

window.adminRemoveFromTeam = async (teamId, mKey) => {
  if(!confirm('Remove member?')) return;
  await _remove(_ref(_db,`teams/${teamId}/members/${mKey}`));
  toast('Removed');
};

window.adminDeleteTeam = async (id, name) => {
  if(!confirm(`Delete team "${name}"?`)) return;
  await _remove(_ref(_db,`teams/${id}`));
  toast('Team deleted');
};

function renderUserList() {
  const el=document.getElementById('adminUserList'); if(!el) return;
  if(!allUsers.length){el.innerHTML=emptyState('👥','No users yet');return;}
  el.innerHTML=allUsers.map(u=>`<div class="admin-user-row">
    <div class="user-avatar-sm">${u.photo?`<img src="${u.photo}"/>`:(u.name||'U')[0]}</div>
    <div class="admin-user-info"><div class="admin-user-name">${u.name||'—'}</div><div class="admin-user-email">${u.email}</div></div>
    <select class="form-control" style="width:110px;padding:6px 8px" onchange="adminChangeRole('${u.email}',this.value)">
      <option value="member" ${(u.role==='member'||!u.role)?'selected':''}>Member</option>
      <option value="leader" ${u.role==='leader'?'selected':''}>Leader</option>
      <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
    </select></div>`).join('');
}

function renderTeamList() {
  const el=document.getElementById('adminTeamList'); if(!el) return;
  if(!allTeams.length){el.innerHTML=emptyState('🏢','No teams yet');return;}
  el.innerHTML=allTeams.map(team=>{
    const members=team.members?Object.entries(team.members):[];
    return `<div class="admin-team-card">
      <div class="admin-team-header">
        <div><div class="admin-team-name">🏢 ${team.name}</div><div class="admin-team-leader">Leader: ${team.leaderEmail||'—'}</div></div>
        <button class="btn-sm btn-del" onclick="adminDeleteTeam('${team.id}','${team.name}')">🗑</button>
      </div>
      <div class="team-members-wrap">${members.map(([k,m])=>`<span class="team-member-chip">${m.email} <span onclick="adminRemoveFromTeam('${team.id}','${k}')" style="cursor:pointer;opacity:0.6">✕</span></span>`).join('')||'<span style="color:var(--muted);font-size:12px">No members</span>'}</div>
    </div>`;
  }).join('');
}

function populateLeaderSelect() {
  const el=document.getElementById('newTeamLeader'); if(!el||el.tagName!=='INPUT') return;
}

function populateMemberTeamSelect() {
  const el=document.getElementById('memberTeamSelect'); if(!el) return;
  el.innerHTML='<option value="">Select Team...</option>'+allTeams.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
}
