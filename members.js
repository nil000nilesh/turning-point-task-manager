// ══════════════════════════════════════════
//  TPS Client Desk — Members Module
// ══════════════════════════════════════════
import { toast, emptyState, safeKey } from './ui.js';

let _db, _ref, _get, _set, _push, _onValue, _update, _remove;
let _currentUser, _currentTeamId;
export let allMembers=[];

export function initMembers(db, dbFns, user, teamId) {
  _db=db; _ref=dbFns.ref; _get=dbFns.get; _set=dbFns.set;
  _push=dbFns.push; _onValue=dbFns.onValue; _update=dbFns.update; _remove=dbFns.remove;
  _currentUser=user; _currentTeamId=teamId;
  subscribeMembers();
}

function subscribeMembers() {
  // For leader: load members of their team
  // We combine users + roles to show team members
  _onValue(_ref(_db,'users'), snap=>{
    _onValue(_ref(_db,'roles'), rolesSnap=>{
      const roles={};
      if(rolesSnap.exists()) rolesSnap.forEach(c=>{roles[c.key]={...c.val()};});
      allMembers=[];
      if(snap.exists()) snap.forEach(c=>{
        const u={id:c.key,...c.val()};
        const roleData=roles[c.key]||{};
        u.role=roleData.role||'member';
        u.teamId=roleData.teamId||'';
        // Leader sees their team members
        if(_currentTeamId) {
          if(roleData.teamId===_currentTeamId) allMembers.push(u);
        } else {
          allMembers.push(u);
        }
      });
      renderMembers();
      document.dispatchEvent(new CustomEvent('membersUpdated',{detail:allMembers}));
    });
  });
}

export function renderMembers() {
  const el=document.getElementById('memberGrid'); if(!el) return;
  if(!allMembers.length){el.innerHTML=emptyState('👥','No team members yet');return;}
  el.innerHTML=allMembers.map(m=>`<div class="member-card">
    <div class="member-avatar-lg">${m.photo?`<img src="${m.photo}"/>`:((m.name||'?')[0])}</div>
    <div class="member-name">${m.name||'—'}</div>
    <div class="member-email">${m.email}</div>
    <span class="tag" style="margin:6px 0">${m.role||'member'}</span>
    <div class="member-actions" style="margin-top:8px">
      <a href="tel:${m.phone||''}" class="btn-sm btn-done" style="${m.phone?'':'opacity:0.3;pointer-events:none'}">📞</a>
    </div>
  </div>`).join('');
}

// Leader can add members (creates a placeholder / invite)
window.inviteMember = async () => {
  const email=document.getElementById('inviteEmail')?.value.trim().toLowerCase();
  const name=document.getElementById('inviteName')?.value.trim();
  if(!email||!email.includes('@')) return toast('Valid email required',true);
  const k=safeKey(email);
  // Pre-create user entry so they appear in members list
  const snap=await _get(_ref(_db,`users/${k}`));
  if(!snap.exists()) {
    await _set(_ref(_db,`users/${k}`),{email,name:name||email.split('@')[0],photo:'',createdAt:Date.now()});
  }
  // Set role
  await _set(_ref(_db,`roles/${k}`),{role:'member',email,teamId:_currentTeamId||'',updatedAt:Date.now()});
  if(_currentTeamId) {
    await _set(_ref(_db,`teams/${_currentTeamId}/members/${k}`),{email,addedAt:Date.now()});
  }
  toast(`✅ ${email} added as member`);
  if(document.getElementById('inviteEmail')) document.getElementById('inviteEmail').value='';
  if(document.getElementById('inviteName')) document.getElementById('inviteName').value='';
};
