// ══════════════════════════════════════════
//  TPS Client Desk — Clients Module
//  (Like CaseDesk but for TPS firm)
// ══════════════════════════════════════════
import { toast, emptyState, formatDate, openModal, closeModal, safeKey } from './ui.js';

let _db, _ref, _get, _set, _push, _onValue, _update, _remove;
let _currentUser, _currentTeamId;
export let allClients=[];
let viewingClientId=null;

export function initClients(db, dbFns, user, teamId) {
  _db=db; _ref=dbFns.ref; _get=dbFns.get; _set=dbFns.set;
  _push=dbFns.push; _onValue=dbFns.onValue; _update=dbFns.update; _remove=dbFns.remove;
  _currentUser=user; _currentTeamId=teamId;
  _onValue(_ref(_db,'clients'), snap=>{
    allClients=[];
    if(snap.exists()) snap.forEach(c=>allClients.push({id:c.key,...c.val()}));
    renderClientList();
    populateClientSelects();
  });
}

// ── Client List ──
let clientSearch='', clientFilter='all';
window.filterClients = (f)=>{clientFilter=f;renderClientList();};
window.searchClients = (q)=>{clientSearch=q;renderClientList();};

export function renderClientList() {
  const el=document.getElementById('clientList'); if(!el) return;
  let list=allClients;
  if(clientFilter!=='all') list=list.filter(c=>c.type===clientFilter);
  if(clientSearch) {
    const q=clientSearch.toLowerCase();
    list=list.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.city||'').toLowerCase().includes(q));
  }
  if(!list.length){el.innerHTML=emptyState('🏢','No clients found');return;}
  el.innerHTML=list.map(c=>`<div class="client-card" onclick="openClientDetail('${c.id}')">
    <div class="client-avatar">${(c.name||'C')[0].toUpperCase()}</div>
    <div class="client-info">
      <div class="client-name">${c.name}</div>
      <div class="client-sub">${c.phone||''} ${c.city?'· '+c.city:''}</div>
      <div class="client-tags">
        <span class="tag">${c.type||'client'}</span>
        ${c.outstanding>0?`<span class="tag tag-danger">₹${Number(c.outstanding).toLocaleString('en-IN')} due</span>`:''}
        ${c.outstanding===0&&c.totalPaid?`<span class="tag tag-success">Cleared</span>`:''}
      </div>
    </div>
    <div class="client-arrow">›</div>
  </div>`).join('');
}

// ── Add Client ──
window.addClient = async () => {
  const name=document.getElementById('cName').value.trim();
  const phone=document.getElementById('cPhone').value.trim();
  const email=document.getElementById('cEmail').value.trim();
  const type=document.getElementById('cType').value;
  const city=document.getElementById('cCity').value.trim();
  const address=document.getElementById('cAddress').value.trim();
  const notes=document.getElementById('cNotes').value.trim();
  if(!name) return toast('Client name required',true);
  if(!phone) return toast('Phone required',true);
  await _push(_ref(_db,'clients'),{
    name,phone,email:email||'',type:type||'retail',city:city||'',
    address:address||'',notes:notes||'',outstanding:0,totalPaid:0,totalBilled:0,
    teamId:_currentTeamId||'',createdAt:Date.now(),createdBy:_currentUser.email
  });
  toast('✅ Client added!');
  closeModal('addClientModal');
  ['cName','cPhone','cEmail','cCity','cAddress','cNotes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
};

// ── Client Detail ──
window.openClientDetail = async (clientId) => {
  viewingClientId=clientId;
  const client=allClients.find(c=>c.id===clientId); if(!client) return;
  document.getElementById('cdName').textContent=client.name;
  document.getElementById('cdPhone').textContent=client.phone||'—';
  document.getElementById('cdEmail').textContent=client.email||'—';
  document.getElementById('cdCity').textContent=client.city||'—';
  document.getElementById('cdAddress').textContent=client.address||'—';
  document.getElementById('cdType').textContent=client.type||'retail';
  document.getElementById('cdNotes').textContent=client.notes||'—';
  document.getElementById('cdOutstanding').textContent='₹'+Number(client.outstanding||0).toLocaleString('en-IN');
  document.getElementById('cdTotalBilled').textContent='₹'+Number(client.totalBilled||0).toLocaleString('en-IN');
  document.getElementById('cdTotalPaid').textContent='₹'+Number(client.totalPaid||0).toLocaleString('en-IN');
  loadClientOrders(clientId);
  loadClientPayments(clientId);
  loadClientContacts(clientId);
  openModal('clientDetailModal');
};

// ── Orders ──
window.addOrder = async () => {
  if(!viewingClientId) return;
  const desc=document.getElementById('orderDesc').value.trim();
  const amount=parseFloat(document.getElementById('orderAmount').value)||0;
  const date=document.getElementById('orderDate').value;
  const status=document.getElementById('orderStatus').value;
  if(!desc) return toast('Order description required',true);
  await _push(_ref(_db,`clientOrders/${viewingClientId}`),{
    desc,amount,date:date||new Date().toISOString().split('T')[0],
    status:status||'pending',createdAt:Date.now(),createdBy:_currentUser.email
  });
  // Update outstanding
  const client=allClients.find(c=>c.id===viewingClientId);
  await _update(_ref(_db,`clients/${viewingClientId}`),{
    totalBilled:(client?.totalBilled||0)+amount,
    outstanding:(client?.outstanding||0)+amount
  });
  toast('Order added');
  document.getElementById('orderDesc').value='';
  document.getElementById('orderAmount').value='';
};

function loadClientOrders(clientId) {
  const el=document.getElementById('clientOrdersList'); if(!el) return;
  _onValue(_ref(_db,`clientOrders/${clientId}`),snap=>{
    let orders=[];
    if(snap.exists()) snap.forEach(c=>orders.push({id:c.key,...c.val()}));
    if(!orders.length){el.innerHTML=emptyState('📦','No orders yet');return;}
    el.innerHTML=orders.reverse().map(o=>`<div class="order-row">
      <div class="order-info">
        <div class="order-desc">${o.desc}</div>
        <div class="order-meta">${o.date||'—'} · <span class="tag status-${o.status||'pending'}">${o.status||'pending'}</span></div>
      </div>
      <div class="order-amount">₹${Number(o.amount||0).toLocaleString('en-IN')}</div>
    </div>`).join('');
  });
}

// ── Payments ──
window.addPayment = async () => {
  if(!viewingClientId) return;
  const amount=parseFloat(document.getElementById('payAmount').value)||0;
  const mode=document.getElementById('payMode').value;
  const ref2=document.getElementById('payRef').value.trim();
  const date=document.getElementById('payDate').value;
  if(!amount) return toast('Amount required',true);
  await _push(_ref(_db,`clientPayments/${viewingClientId}`),{
    amount,mode:mode||'cash',ref:ref2||'',date:date||new Date().toISOString().split('T')[0],
    createdAt:Date.now(),createdBy:_currentUser.email
  });
  const client=allClients.find(c=>c.id===viewingClientId);
  await _update(_ref(_db,`clients/${viewingClientId}`),{
    totalPaid:(client?.totalPaid||0)+amount,
    outstanding:Math.max(0,(client?.outstanding||0)-amount)
  });
  toast('✅ Payment recorded');
  document.getElementById('payAmount').value='';
  document.getElementById('payRef').value='';
};

function loadClientPayments(clientId) {
  const el=document.getElementById('clientPaymentsList'); if(!el) return;
  _onValue(_ref(_db,`clientPayments/${clientId}`),snap=>{
    let pays=[];
    if(snap.exists()) snap.forEach(c=>pays.push({id:c.key,...c.val()}));
    if(!pays.length){el.innerHTML=emptyState('💰','No payments yet');return;}
    el.innerHTML=pays.reverse().map(p=>`<div class="payment-row">
      <div class="pay-icon">💰</div>
      <div class="pay-info"><div class="pay-mode">${p.mode||'cash'} ${p.ref?'· '+p.ref:''}</div><div class="pay-date">${p.date||'—'}</div></div>
      <div class="pay-amount" style="color:var(--accent)">+₹${Number(p.amount||0).toLocaleString('en-IN')}</div>
    </div>`).join('');
  });
}

// ── Contacts ──
window.addContact = async () => {
  if(!viewingClientId) return;
  const cName=document.getElementById('contactName').value.trim();
  const cPhone=document.getElementById('contactPhone').value.trim();
  const cRole=document.getElementById('contactRole').value.trim();
  if(!cName||!cPhone) return toast('Name and phone required',true);
  await _push(_ref(_db,`clientContacts/${viewingClientId}`),{name:cName,phone:cPhone,role:cRole||'',createdAt:Date.now()});
  toast('Contact added');
  document.getElementById('contactName').value='';
  document.getElementById('contactPhone').value='';
  document.getElementById('contactRole').value='';
};

function loadClientContacts(clientId) {
  const el=document.getElementById('clientContactsList'); if(!el) return;
  _onValue(_ref(_db,`clientContacts/${clientId}`),snap=>{
    let contacts=[];
    if(snap.exists()) snap.forEach(c=>contacts.push({id:c.key,...c.val()}));
    if(!contacts.length){el.innerHTML=emptyState('📞','No contacts yet');return;}
    el.innerHTML=contacts.map(c=>`<div class="contact-row">
      <div class="contact-avatar">${(c.name||'C')[0]}</div>
      <div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-sub">${c.phone} ${c.role?'· '+c.role:''}</div></div>
      <a href="tel:${c.phone}" class="btn-sm btn-done">📞</a>
    </div>`).join('');
  });
}

export function populateClientSelects() {
  ['taskClient'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML='<option value="">No Client</option>'+
      allClients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  });
}
