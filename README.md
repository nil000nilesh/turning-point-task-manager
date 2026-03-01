# 🎯 TPS Client Desk — Powered by Wisefox Solution

**Turning Point Solution** ke liye banaya gaya Smart Team & Client Management System.

## 📁 File Structure

```
tps-desk/
├── index.html              ← Main HTML (single page app)
├── css/
│   └── styles.css          ← All styles
├── js/
│   ├── config.js           ← Firebase config & constants
│   ├── ui.js               ← Toast, modal, view helpers
│   ├── auth.js             ← Google Auth, role resolution
│   ├── app.js              ← Main app orchestrator (entry point)
│   ├── admin.js            ← Admin panel (teams, roles)
│   ├── tasks.js            ← Task management + task chat
│   ├── clients.js          ← Client, orders, payments, contacts
│   ├── notes.js            ← Notebook (CaseDesk-style)
│   ├── reminders.js        ← Reminders
│   ├── members.js          ← Team members
│   ├── ai-float.js         ← Floating AI + PIN system
│   └── dashboard.js        ← Dashboard stats
└── README.md
```

## 👤 Role System

| Role   | Access |
|--------|--------|
| **Admin** (nil000nilesh@gmail.com) | Admin Panel + Full Leader access |
| **Leader** | Dashboard, Tasks, Clients, Notes, Reminders, Members, AI |
| **Staff/Member** | My Tasks + Reminders only (with Task Chat) |

## 🔑 Setup

1. GitHub pe upload karo
2. Vercel/Netlify pe deploy karo
3. Firebase Console → Authentication → Google enable karo
4. Firebase Database rules set karo
5. Settings mein OpenAI API Key add karo (optional - for GPT-4o)

## ✨ Features

- 🤖 **Floating AI Assistant** with PIN protection
- 🏢 **Client Management** - orders, payments, contacts
- 📓 **Notebook** - colored notes like CaseDesk
- 💬 **Task Chat** - staff task pe notes aur chat kar sakta hai
- 👥 **Team Management** - admin creates teams & leaders
- 🔔 **Smart Reminders** with browser notifications
- ⚡ **Admin Panel** - teams & roles management

## 🔥 Firebase Database Rules (recommended)
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

---
*Powered by Wisefox Solution* 🦊
