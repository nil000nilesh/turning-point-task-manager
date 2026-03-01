// ══════════════════════════════════════════════
//  TPS Client Desk — Firebase Config & Constants
//  Powered by Wisefox Solution
// ══════════════════════════════════════════════

export const firebaseConfig = {
  apiKey: "AIzaSyAP6xYAgWtU8hyuJP2nximxRZRIJnwNgG0",
  authDomain: "turning-point-task-manager.firebaseapp.com",
  databaseURL: "https://turning-point-task-manager-default-rtdb.firebaseio.com",
  projectId: "turning-point-task-manager",
  storageBucket: "turning-point-task-manager.firebasestorage.app",
  messagingSenderId: "922397311479",
  appId: "1:922397311479:web:0c4ed59ee86331261daef2",
  measurementId: "G-BX36LQ0T1J"
};

// Role hierarchy
export const ROLES = {
  ADMIN: 'admin',
  LEADER: 'leader',
  MEMBER: 'member'
};

// Admin email — always has admin access
export const ADMIN_EMAIL = "nil000nilesh@gmail.com";

// App info
export const APP_VERSION = "v2.0.0";
export const APP_NAME = "TPS Client Desk";
export const POWERED_BY = "Wisefox Solution";

// Note colors for notebook
export const NOTE_COLORS = [
  { name: 'Default', value: '#181c24' },
  { name: 'Mint',    value: '#0a1f1a' },
  { name: 'Blue',    value: '#0a1020' },
  { name: 'Purple',  value: '#130d1f' },
  { name: 'Red',     value: '#1f0d0d' },
  { name: 'Gold',    value: '#1a1608' }
];

// Task priorities
export const PRIORITIES = ['high', 'medium', 'low'];

// Task statuses
export const TASK_STATUSES = ['pending', 'inprogress', 'review', 'done'];
