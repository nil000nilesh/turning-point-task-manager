// ══════════════════════════════════════════
//  TPS Client Desk — Dashboard
// ══════════════════════════════════════════

export function renderDashboard(allTasks, allMembers, allClients, currentUser) {
  const now=Date.now();
  let total=allTasks.length, done=0, progress=0, overdue=0;
  allTasks.forEach(t=>{
    if(t.status==='done') done++;
    else if(t.status==='inprogress') progress++;
    if(t.status!=='done'&&t.dueDate&&new Date(t.dueDate).getTime()<now) overdue++;
  });
  setEl('statTotal',total);
  setEl('statDone',done);
  setEl('statProgress',progress);
  setEl('statOverdue',overdue);
  setEl('statClients',allClients.length);
  setEl('statMembers',allMembers.length);
  setEl('dashName',(currentUser.displayName||'Leader').split(' ')[0]);

  // Completion rate
  const rate=total?Math.round((done/total)*100):0;
  const rateEl=document.getElementById('dashCompletionRate');
  if(rateEl) rateEl.textContent=rate+'%';
  const rateFill=document.getElementById('dashCompletionFill');
  if(rateFill) rateFill.style.width=rate+'%';

  // Outstanding amount
  const outstanding=document.getElementById('statOutstanding');
  if(outstanding) {
    // Will be updated from clients module
  }
}

function setEl(id,val) {
  const el=document.getElementById(id); if(el) el.textContent=val;
}

export function renderMyProgress(allTasks, currentUser) {
  const total=allTasks.length;
  const done=allTasks.filter(t=>t.status==='done').length;
  const pending=total-done;
  const pct=total?Math.round((done/total)*100):0;
  setEl('myStatTotal',total); setEl('myStatDone',done); setEl('myStatPending',pending);
  setEl('myProgressPct',pct+'%');
  const fill=document.getElementById('myProgressFill');
  if(fill) fill.style.width=pct+'%';
}
