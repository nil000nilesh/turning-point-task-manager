// ══════════════════════════════════════════
//  TPS Client Desk — Floating AI Assistant
//  with PIN System (like CaseDesk)
// ══════════════════════════════════════════
import { toast } from './ui.js';

let _db, _ref, _get, _set;
let _currentUser;
let allTasks=[], allMembers=[];
let cachedApiKey=null;

export function initAI(db, dbFns, user) {
  _db=db; _ref=dbFns.ref; _get=dbFns.get; _set=dbFns.set;
  _currentUser=user;
  renderFloatingBtn();
  checkPINSetup();
}

export function updateAIContext(tasks, members) {
  allTasks=tasks; allMembers=members;
}

// ── PIN System ──
const PIN_KEY = 'tps_ai_pin';
const PIN_HASH_KEY = 'tps_ai_pin_hash';

function getPINHash() { return localStorage.getItem(PIN_HASH_KEY); }
async function hashPIN(pin) {
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pin+'tps_salt_2025'));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function checkPINSetup() {
  if(!getPINHash()) {
    document.getElementById('aiPinSetupPanel').style.display='flex';
  }
}

window.setupAIPIN = async () => {
  const pin=document.getElementById('aiPinInput').value.trim();
  const confirm=document.getElementById('aiPinConfirm').value.trim();
  if(pin.length<4) return toast('PIN must be at least 4 digits',true);
  if(pin!==confirm) return toast('PINs do not match',true);
  const h=await hashPIN(pin);
  localStorage.setItem(PIN_HASH_KEY,h);
  document.getElementById('aiPinSetupPanel').style.display='none';
  document.getElementById('aiPinInput').value='';
  document.getElementById('aiPinConfirm').value='';
  toast('✅ AI PIN set! Remember it.');
};

window.openAIFloat = async () => {
  const pinSet=getPINHash();
  if(!pinSet) {
    // Show setup first
    document.getElementById('aiPinSetupPanel').style.display='flex';
    return;
  }
  // Show PIN verify
  document.getElementById('aiPinVerifyPanel').style.display='flex';
  document.getElementById('aiPinVerifyInput').value='';
  setTimeout(()=>document.getElementById('aiPinVerifyInput')?.focus(),100);
};

window.verifyAIPIN = async () => {
  const pin=document.getElementById('aiPinVerifyInput').value.trim();
  const h=await hashPIN(pin);
  if(h===getPINHash()) {
    document.getElementById('aiPinVerifyPanel').style.display='none';
    openAIChat();
  } else {
    toast('❌ Wrong PIN',true);
    document.getElementById('aiPinVerifyInput').value='';
  }
};
window.aiPinKeyDown=(e)=>{if(e.key==='Enter') verifyAIPIN();};
window.setupPinKeyDown=(e)=>{if(e.key==='Enter'&&document.getElementById('aiPinConfirm')===document.activeElement) setupAIPIN();};

window.resetAIPIN = () => {
  if(!confirm('Reset AI PIN? You will need to set a new one.')) return;
  localStorage.removeItem(PIN_HASH_KEY);
  document.getElementById('aiPinVerifyPanel').style.display='none';
  checkPINSetup();
};

function openAIChat() {
  document.getElementById('aiFloatChat').classList.add('open');
  document.getElementById('aiFloatBtn').style.display='none';
  if(!document.getElementById('aiFloatMessages').children.length ||
     document.getElementById('aiFloatMessages').children.length===0) {
    addAIMsg(getWelcomeMsg(),false);
  }
}

window.closeAIFloat = () => {
  document.getElementById('aiFloatChat').classList.remove('open');
  document.getElementById('aiFloatBtn').style.display='flex';
};

function getWelcomeMsg() {
  return `<strong>TPS AI Assistant</strong> — Powered by <span style="color:var(--accent)">Wisefox Solution</span> 🦊<br/><br/>
Main kya kar sakta hoon:<br/>
• 📝 <strong style="color:var(--accent)">Note banao:</strong> "Note karo: Client call Friday 4pm"<br/>
• 📋 <strong style="color:var(--accent)">Task assign karo:</strong> "Rahul ko logo design task do, due 30 June, high priority"<br/>
• 🔔 <strong style="color:var(--accent)">Reminder set karo:</strong> "Kal subah 9 baje standup ka reminder do"<br/>
• 📊 <strong style="color:var(--accent)">Status dekho:</strong> "Team ka status dikhao"<br/><br/>
💡 Hindi, English, Hinglish — sab samajhta hoon!`;
}

window.sendAIChat = async () => {
  const input=document.getElementById('aiFloatInput');
  const msg=input.value.trim(); if(!msg) return;
  input.value='';
  addAIMsg(msg,true);
  showAITyping();
  setTimeout(async()=>{
    const res=await processAI(msg);
    removeAITyping();
    addAIMsg(res,false);
  },700);
};
window.aiFloatKeyDown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAIChat();}};

function addAIMsg(text,isUser) {
  const el=document.getElementById('aiFloatMessages');
  const div=document.createElement('div');
  div.className='float-msg'+(isUser?' user':'');
  div.innerHTML=`<div class="float-bubble">${text}</div>`;
  el.appendChild(div);
  el.scrollTop=el.scrollHeight;
}

let typingEl=null;
function showAITyping() {
  const el=document.getElementById('aiFloatMessages');
  typingEl=document.createElement('div');
  typingEl.className='float-msg';
  typingEl.innerHTML='<div class="float-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
  el.appendChild(typingEl); el.scrollTop=el.scrollHeight;
}
function removeAITyping(){if(typingEl){typingEl.remove();typingEl=null;}}

async function processAI(msg) {
  const key=await getApiKey();
  if(key) return callOpenAI(msg,key);
  return localAI(msg);
}

async function getApiKey() {
  if(cachedApiKey) return cachedApiKey;
  try {
    const snap=await _get(_ref(_db,'settings/openaiApiKey'));
    if(snap.exists()){cachedApiKey=snap.val();return cachedApiKey;}
  } catch(e){}
  return null;
}

async function callOpenAI(msg,apiKey) {
  const context=`You are TPS AI Assistant for Turning Point Solution — Client Desk.
Team: ${allMembers.map(m=>`${m.name||m.email}`).join(', ')||'No members'}
Tasks — Total:${allTasks.length} Done:${allTasks.filter(t=>t.status==='done').length} Pending:${allTasks.filter(t=>t.status==='pending').length}
Today: ${new Date().toISOString().split('T')[0]}
Respond with JSON for actions: {"action":"note","content":"..."} | {"action":"task","title":"...","assigneeName":"...","priority":"high/medium/low","dueDate":"YYYY-MM-DD"} | {"action":"reminder","title":"...","hoursFromNow":1}
For general/status questions respond in clean HTML. Reply in user's language.`;
  try {
    const res=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'gpt-4o',max_tokens:600,temperature:0.4,
        messages:[{role:'system',content:context},{role:'user',content:msg}]})
    });
    if(!res.ok) throw new Error('API error');
    const data=await res.json();
    const text=(data.choices?.[0]?.message?.content||'').trim();
    const match=text.match(/\{[\s\S]*?\}/);
    if(match){try{const a=JSON.parse(match[0]);if(a.action) return await execAIAction(a,msg);}catch(e){}}
    return text;
  } catch(e) { return localAI(msg); }
}

async function execAIAction(a,orig) {
  const {push,ref,set:fset}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
  if(a.action==='note') {
    const content=a.content||orig;
    await push(ref(_db,`notes/${_currentUser.email.replace(/\./g,'_')}`),{content,title:content.substring(0,30),category:'',color:'#181c24',createdAt:Date.now(),updatedAt:Date.now(),createdBy:_currentUser.email});
    return `✅ <strong>Note saved!</strong><br/>"${content}"<br/>📝 Notes mein dekho.`;
  }
  if(a.action==='task') {
    const m=allMembers.find(m=>m.name?.toLowerCase().includes((a.assigneeName||'').toLowerCase())||m.email.includes((a.assigneeName||'').toLowerCase()));
    if(!m) return `❌ Member nahi mila: "${a.assigneeName}"<br/>Available: ${allMembers.map(m=>m.name||m.email).join(', ')||'No members'}`;
    await push(ref(_db,'tasks'),{title:a.title,desc:a.description||'',assigneeEmail:m.email,assigneeName:m.name||m.email,priority:a.priority||'medium',dueDate:a.dueDate||'',status:'pending',createdAt:Date.now(),createdBy:_currentUser.email,source:'ai'});
    return `✅ <strong>Task assigned!</strong><br/>📋 ${a.title}<br/>👤 ${m.name||m.email}<br/>📅 ${a.dueDate||'No date'}<br/>🎯 ${a.priority||'medium'}`;
  }
  if(a.action==='reminder') {
    const t=Date.now()+((parseFloat(a.hoursFromNow)||1)*3600000);
    await push(ref(_db,'reminders'),{title:a.title,time:t,forEmail:'all',status:'pending',createdAt:Date.now(),createdBy:_currentUser.email});
    return `✅ <strong>Reminder set!</strong><br/>🔔 "${a.title}"<br/>⏰ ${new Date(t).toLocaleString()}`;
  }
  return '🤔 Unknown action';
}

function localAI(msg) {
  const l=msg.toLowerCase();
  if(l.includes('status')||l.includes('report')||l.includes('kitne')) {
    const done=allTasks.filter(t=>t.status==='done').length;
    return `📊 <strong>Team Status</strong><br/>Total: ${allTasks.length} | ✅ Done: ${done} | 🔄 Pending: ${allTasks.length-done}<br/>Rate: ${allTasks.length?Math.round(done/allTasks.length*100):0}%`;
  }
  if(l.includes('help')||l.includes('kya')) {
    return `🤖 <strong>Commands:</strong><br/>• "Status dikhao"<br/>• "Note: [text]"<br/>• "Assign task '[name]' to [member]"<br/>• "Remind about [topic]"<br/><br/><small style="color:var(--muted)">Settings mein OpenAI API Key add karo for GPT-4!</small>`;
  }
  return `🤔 "${msg.substring(0,50)}"<br/>Say <strong>"help"</strong> for commands.<br/><small style="color:var(--muted)">Settings → API Key add karo for full AI!</small>`;
}

function renderFloatingBtn() {
  // Already in HTML, just ensure event
  const btn=document.getElementById('aiFloatBtn');
  if(btn) btn.addEventListener('click', openAIFloat);
}

// ── API Key Management (Settings) ──
export async function loadApiKeyStatus() {
  const key=await getApiKey();
  const el=document.getElementById('apiKeyStatus'); if(!el) return;
  if(key){el.textContent='✅ GPT-4o Active';el.style.background='rgba(0,229,160,0.15)';el.style.color='var(--accent)';}
  else{el.textContent='Not Set';el.style.background='rgba(255,107,107,0.15)';el.style.color='var(--accent3)';}
}

window.saveApiKey = async () => {
  const key=document.getElementById('apiKeyInput')?.value.trim();
  if(!key) return toast('API Key empty',true);
  if(!key.startsWith('sk-')) return toast('Invalid — must start with sk-',true);
  await _set(_ref(_db,'settings/openaiApiKey'),key);
  cachedApiKey=key;
  loadApiKeyStatus();
  toast('✅ API Key saved!');
  document.getElementById('apiKeyInput').value='';
};

window.clearApiKey = async () => {
  if(!confirm('Remove API Key?')) return;
  const {remove}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
  await remove(_ref(_db,'settings/openaiApiKey'));
  cachedApiKey=null;
  loadApiKeyStatus();
  toast('API Key removed');
};

window.toggleApiKeyVisibility = () => {
  const inp=document.getElementById('apiKeyInput');
  inp.type=inp.type==='password'?'text':'password';
};

window.changePIN = async () => {
  const oldPin=document.getElementById('changePinOld')?.value.trim();
  const newPin=document.getElementById('changePinNew')?.value.trim();
  if(!oldPin||!newPin) return toast('Fill all fields',true);
  if(newPin.length<4) return toast('PIN min 4 digits',true);
  const oldH=await hashPIN(oldPin);
  if(oldH!==getPINHash()) return toast('❌ Wrong current PIN',true);
  localStorage.setItem(PIN_HASH_KEY,await hashPIN(newPin));
  toast('✅ PIN changed!');
  ['changePinOld','changePinNew'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
};
