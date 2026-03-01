// ══════════════════════════════════════════
//  TPS Client Desk — Notes / Notebook
//  (CaseDesk-style notebook)
// ══════════════════════════════════════════
import { toast, emptyState, formatDate, openModal, closeModal } from './ui.js';
import { NOTE_COLORS } from './config.js';

let _db, _ref, _set, _push, _onValue, _update, _remove;
let _currentUser;
export let allNotes=[];
let activeNoteId=null;
let noteFilter='all';

export function initNotes(db, dbFns, user) {
  _db=db; _ref=dbFns.ref; _set=dbFns.set;
  _push=dbFns.push; _onValue=dbFns.onValue; _update=dbFns.update; _remove=dbFns.remove;
  _currentUser=user;
  _onValue(_ref(_db,`notes/${_currentUser.email.replace(/\./g,'_')}`), snap=>{
    allNotes=[];
    if(snap.exists()) snap.forEach(c=>allNotes.push({id:c.key,...c.val()}));
    allNotes.sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
    renderNoteGrid();
    if(activeNoteId) {
      const n=allNotes.find(n=>n.id===activeNoteId);
      if(n) openNoteEditor(n);
    }
  });
}

window.setNoteFilter = (f)=>{noteFilter=f;renderNoteGrid();};

export function renderNoteGrid() {
  const el=document.getElementById('noteGrid'); if(!el) return;
  let notes=allNotes;
  if(noteFilter!=='all') notes=notes.filter(n=>n.category===noteFilter);
  const searchQ=(document.getElementById('noteSearch')?.value||'').toLowerCase();
  if(searchQ) notes=notes.filter(n=>(n.title||'').toLowerCase().includes(searchQ)||(n.content||'').toLowerCase().includes(searchQ));
  if(!notes.length){el.innerHTML=emptyState('📓','No notes yet. Click + to create.');return;}
  el.innerHTML=notes.map(n=>`<div class="note-card" style="background:${n.color||'var(--surface2)'}" onclick="openNoteEditorById('${n.id}')">
    <div class="note-card-header">
      <div class="note-title-sm">${n.title||'Untitled'}</div>
      <button class="note-del-btn" onclick="event.stopPropagation();deleteNote('${n.id}')">✕</button>
    </div>
    <div class="note-preview">${(n.content||'').substring(0,120)}${(n.content||'').length>120?'…':''}</div>
    <div class="note-footer">
      ${n.category?`<span class="tag">${n.category}</span>`:''}
      <span class="note-date">${formatDate(n.updatedAt||n.createdAt)}</span>
    </div>
  </div>`).join('');
}

window.searchNotes = ()=>renderNoteGrid();

window.openNoteEditorById = (id) => {
  const n=allNotes.find(n=>n.id===id); if(!n) return;
  openNoteEditor(n);
};

function openNoteEditor(note) {
  activeNoteId=note.id;
  document.getElementById('noteEditorTitle').value=note.title||'';
  document.getElementById('noteEditorContent').value=note.content||'';
  document.getElementById('noteEditorCategory').value=note.category||'';
  // Set color buttons
  document.querySelectorAll('.note-color-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.color===(note.color||NOTE_COLORS[0].value));
  });
  document.getElementById('noteEditorPanel').classList.add('open');
}

window.newNote = async () => {
  const ref=await _push(_ref(_db,`notes/${_currentUser.email.replace(/\./g,'_')}`),{
    title:'',content:'',category:'',color:NOTE_COLORS[0].value,
    createdAt:Date.now(),updatedAt:Date.now(),createdBy:_currentUser.email
  });
  // The onValue will trigger and openNoteEditor
  activeNoteId=ref.key;
};

window.saveNote = async () => {
  if(!activeNoteId) return;
  const title=document.getElementById('noteEditorTitle').value.trim();
  const content=document.getElementById('noteEditorContent').value;
  const category=document.getElementById('noteEditorCategory').value;
  const activeColor=document.querySelector('.note-color-btn.active')?.dataset.color||NOTE_COLORS[0].value;
  await _update(_ref(_db,`notes/${_currentUser.email.replace(/\./g,'_')}/${activeNoteId}`),{
    title:title||'Untitled',content,category:category||'',color:activeColor,updatedAt:Date.now()
  });
  toast('Note saved 📝');
};

window.closeNoteEditor = () => {
  saveNote();
  document.getElementById('noteEditorPanel').classList.remove('open');
  activeNoteId=null;
};

window.setNoteColor = (color) => {
  document.querySelectorAll('.note-color-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.color===color));
};

window.deleteNote = async (id) => {
  if(!confirm('Delete note?')) return;
  await _remove(_ref(_db,`notes/${_currentUser.email.replace(/\./g,'_')}/${id}`));
  if(activeNoteId===id) {
    document.getElementById('noteEditorPanel').classList.remove('open');
    activeNoteId=null;
  }
  toast('Note deleted');
};

window.noteAutoSave = () => {
  clearTimeout(window._noteAutoSaveTimer);
  window._noteAutoSaveTimer = setTimeout(saveNote, 2000);
};
