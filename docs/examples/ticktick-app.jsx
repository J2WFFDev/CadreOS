import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  bg: "#0f0f11",
  surface: "#18181c",
  surfaceHover: "#22222a",
  border: "#2a2a35",
  borderLight: "#333340",
  text: "#f0eff6",
  textMuted: "#7a7a99",
  textDim: "#4a4a60",
  accent: "#7c6af7",
  accentHover: "#9585ff",
  accentDim: "#7c6af720",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#f59e0b",
  orange: "#f97316",
  blue: "#3b82f6",
  pink: "#ec4899",
};

const PRIORITIES = [
  { level: 0, label: "None",   color: COLORS.textDim,  icon: "○" },
  { level: 1, label: "Low",    color: COLORS.blue,     icon: "▲" },
  { level: 2, label: "Medium", color: COLORS.yellow,   icon: "▲▲" },
  { level: 3, label: "High",   color: COLORS.red,      icon: "▲▲▲" },
];

const LISTS = [
  { id: "inbox",   name: "Inbox",    icon: "📥", color: COLORS.accent },
  { id: "work",    name: "Work",     icon: "💼", color: COLORS.blue },
  { id: "personal",name: "Personal", icon: "🏠", color: COLORS.green },
  { id: "health",  name: "Health",   icon: "💪", color: COLORS.pink },
];

const TAGS = ["focus", "quick", "waiting", "someday", "review"];

const SEED_TASKS = [
  { id:"t1", title:"Review Q2 roadmap doc", listId:"work",    priority:3, completed:false, dueDate:"2026-05-25", tags:["focus"],   createdAt: Date.now()-86400000*3 },
  { id:"t2", title:"Morning run — 5K",       listId:"health",  priority:2, completed:false, dueDate:"2026-05-25", tags:["quick"],   createdAt: Date.now()-86400000*2 },
  { id:"t3", title:"Fix login redirect bug",  listId:"work",    priority:3, completed:false, dueDate:"2026-05-26", tags:["focus"],   createdAt: Date.now()-86400000*2 },
  { id:"t4", title:"Buy groceries",           listId:"personal",priority:1, completed:false, dueDate:"2026-05-26", tags:[],          createdAt: Date.now()-86400000 },
  { id:"t5", title:"Team standup prep",       listId:"work",    priority:2, completed:true,  dueDate:"2026-05-24", tags:["quick"],   createdAt: Date.now()-86400000*5 },
  { id:"t6", title:"Read: Atomic Habits ch4", listId:"personal",priority:1, completed:false, dueDate:"2026-05-28", tags:["someday"], createdAt: Date.now()-86400000 },
  { id:"t7", title:"Schedule dentist appt",   listId:"personal",priority:2, completed:false, dueDate:"2026-05-27", tags:["waiting"], createdAt: Date.now()-86400000*4 },
  { id:"t8", title:"Write unit tests for API",listId:"work",    priority:2, completed:false, dueDate:"2026-05-29", tags:["focus"],   createdAt: Date.now() },
  { id:"t9", title:"Meditate 10 min",         listId:"health",  priority:1, completed:true,  dueDate:"2026-05-25", tags:[],          createdAt: Date.now()-86400000 },
  { id:"t10",title:"Draft blog post outline", listId:"personal",priority:0, completed:false, dueDate:null,         tags:["someday"], createdAt: Date.now() },
];

function parseNLP(input) {
  let remaining = input.trim();
  const result = { title: "", priority: 0, tags: [], dueDate: null };

  const tagRegex = /#(\w+)/g;
  result.tags = [...remaining.matchAll(tagRegex)].map(m => m[1]);
  remaining = remaining.replace(tagRegex, "").trim();

  const priorityPatterns = [
    { re: /\s*!!!|\s*!high|\s*!urgent/i, level: 3 },
    { re: /\s*!!|\s*!med/i,              level: 2 },
    { re: /\s*!|\s*!low/i,               level: 1 },
  ];
  for (const { re, level } of priorityPatterns) {
    if (re.test(remaining)) {
      result.priority = level;
      remaining = remaining.replace(re, "").trim();
      break;
    }
  }

  const datePatterns = [
    { re: /\btoday\b/i,     offset: 0 },
    { re: /\btomorrow\b/i,  offset: 1 },
    { re: /\bnext week\b/i, offset: 7 },
    { re: /\bmonday\b/i,    day: 1 },
    { re: /\btuesday\b/i,   day: 2 },
    { re: /\bwednesday\b/i, day: 3 },
    { re: /\bthursday\b/i,  day: 4 },
    { re: /\bfriday\b/i,    day: 5 },
  ];
  for (const pattern of datePatterns) {
    if (pattern.re.test(remaining)) {
      const d = new Date();
      if (pattern.offset !== undefined) {
        d.setDate(d.getDate() + pattern.offset);
      } else if (pattern.day !== undefined) {
        const cur = d.getDay();
        const diff = ((pattern.day - cur + 7) % 7) || 7;
        d.setDate(d.getDate() + diff);
      }
      result.dueDate = d.toISOString().split("T")[0];
      remaining = remaining.replace(pattern.re, "").trim();
      break;
    }
  }

  result.title = remaining.replace(/\s+/g, " ").trim();
  return result;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().split("T")[0];
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: ${COLORS.bg};
    color: ${COLORS.text};
    height: 100vh;
    overflow: hidden;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }

  .app { display: flex; height: 100vh; }

  /* SIDEBAR */
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: ${COLORS.surface};
    border-right: 1px solid ${COLORS.border};
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }
  .sidebar-logo {
    padding: 20px 16px 16px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.3px;
    color: ${COLORS.text};
    border-bottom: 1px solid ${COLORS.border};
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sidebar-logo span { font-size: 18px; }
  .sidebar-section-label {
    padding: 16px 16px 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: ${COLORS.textDim};
  }
  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 12px;
    margin: 1px 8px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13.5px;
    color: ${COLORS.textMuted};
    transition: all 0.12s;
    border: 1px solid transparent;
  }
  .sidebar-item:hover { background: ${COLORS.surfaceHover}; color: ${COLORS.text}; }
  .sidebar-item.active {
    background: ${COLORS.accentDim};
    color: ${COLORS.accent};
    border-color: ${COLORS.accent}30;
    font-weight: 500;
  }
  .sidebar-item .count {
    margin-left: auto;
    font-size: 11px;
    font-family: 'DM Mono', monospace;
    color: ${COLORS.textDim};
    background: ${COLORS.bg};
    padding: 1px 6px;
    border-radius: 10px;
  }
  .sidebar-item.active .count { color: ${COLORS.accent}; background: ${COLORS.accent}20; }
  .sidebar-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sidebar-bottom {
    margin-top: auto;
    padding: 12px 8px;
    border-top: 1px solid ${COLORS.border};
  }

  /* MAIN */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: ${COLORS.bg};
  }
  .topbar {
    padding: 18px 28px 0;
    flex-shrink: 0;
  }
  .topbar-title {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.5px;
    color: ${COLORS.text};
    margin-bottom: 4px;
  }
  .topbar-meta {
    font-size: 12.5px;
    color: ${COLORS.textMuted};
    margin-bottom: 18px;
  }

  /* QUICK ADD */
  .quickadd-wrap {
    margin: 0 28px 16px;
    flex-shrink: 0;
  }
  .quickadd {
    display: flex;
    align-items: center;
    gap: 10px;
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 10px;
    padding: 10px 14px;
    transition: border-color 0.15s;
  }
  .quickadd:focus-within {
    border-color: ${COLORS.accent};
    box-shadow: 0 0 0 3px ${COLORS.accent}18;
  }
  .quickadd input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 13.5px;
    color: ${COLORS.text};
  }
  .quickadd input::placeholder { color: ${COLORS.textDim}; }
  .quickadd-hint { font-size: 11px; color: ${COLORS.textDim}; white-space: nowrap; }
  .quickadd-btn {
    background: ${COLORS.accent};
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 16px;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.12s, transform 0.1s;
    flex-shrink: 0;
  }
  .quickadd-btn:hover { background: ${COLORS.accentHover}; transform: scale(1.05); }

  /* FILTERS */
  .filters {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 28px 14px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .filter-chip {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid ${COLORS.border};
    color: ${COLORS.textMuted};
    background: none;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.12s;
  }
  .filter-chip:hover { border-color: ${COLORS.borderLight}; color: ${COLORS.text}; }
  .filter-chip.active {
    background: ${COLORS.accent};
    border-color: ${COLORS.accent};
    color: white;
    font-weight: 500;
  }

  /* TASK LIST */
  .tasklist {
    flex: 1;
    overflow-y: auto;
    padding: 0 28px 24px;
  }
  .task-group-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: ${COLORS.textDim};
    padding: 16px 0 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .task-group-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${COLORS.border};
  }
  .task-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 9px;
    margin-bottom: 3px;
    cursor: pointer;
    transition: background 0.1s;
    border: 1px solid transparent;
    position: relative;
  }
  .task-item:hover { background: ${COLORS.surface}; border-color: ${COLORS.border}; }
  .task-item.completed { opacity: 0.45; }
  .task-item.selected { background: ${COLORS.surface}; border-color: ${COLORS.accent}50; }

  .task-check {
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 2px solid ${COLORS.border};
    flex-shrink: 0;
    margin-top: 2px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
    cursor: pointer;
    font-size: 9px;
    color: transparent;
  }
  .task-check:hover { border-color: ${COLORS.accent}; color: ${COLORS.accent}; }
  .task-check.checked {
    background: ${COLORS.accent};
    border-color: ${COLORS.accent};
    color: white;
  }

  .task-body { flex: 1; min-width: 0; }
  .task-title {
    font-size: 13.5px;
    color: ${COLORS.text};
    line-height: 1.4;
    word-break: break-word;
  }
  .task-item.completed .task-title {
    text-decoration: line-through;
    color: ${COLORS.textDim};
  }
  .task-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .task-date {
    font-size: 11px;
    font-family: 'DM Mono', monospace;
    color: ${COLORS.textMuted};
  }
  .task-date.overdue { color: ${COLORS.red}; }
  .task-date.today { color: ${COLORS.accent}; }
  .task-tag {
    font-size: 10.5px;
    color: ${COLORS.textDim};
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    padding: 1px 7px;
    border-radius: 4px;
    font-family: 'DM Mono', monospace;
  }
  .task-priority {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .task-list-badge {
    font-size: 10.5px;
    color: ${COLORS.textDim};
    display: flex; align-items: center; gap: 3px;
  }

  .task-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .task-item:hover .task-actions { opacity: 1; }
  .task-action-btn {
    width: 26px; height: 26px;
    border-radius: 6px;
    border: 1px solid ${COLORS.border};
    background: ${COLORS.bg};
    color: ${COLORS.textMuted};
    font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.1s;
  }
  .task-action-btn:hover { background: ${COLORS.surface}; color: ${COLORS.text}; border-color: ${COLORS.borderLight}; }
  .task-action-btn.del:hover { background: ${COLORS.red}20; color: ${COLORS.red}; border-color: ${COLORS.red}40; }

  /* DETAIL PANEL */
  .detail-panel {
    width: 320px;
    min-width: 320px;
    background: ${COLORS.surface};
    border-left: 1px solid ${COLORS.border};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideIn 0.18s ease;
  }
  @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  .detail-header {
    padding: 18px 18px 14px;
    border-bottom: 1px solid ${COLORS.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .detail-header-title { font-size: 13px; font-weight: 600; color: ${COLORS.textMuted}; letter-spacing: 0.3px; }
  .close-btn {
    width: 28px; height: 28px;
    border-radius: 7px;
    border: 1px solid ${COLORS.border};
    background: none;
    color: ${COLORS.textMuted};
    font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.1s;
  }
  .close-btn:hover { background: ${COLORS.bg}; color: ${COLORS.text}; }
  .detail-body { flex: 1; overflow-y: auto; padding: 18px; }
  .detail-title-input {
    width: 100%;
    background: none;
    border: none;
    outline: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    font-weight: 500;
    color: ${COLORS.text};
    line-height: 1.5;
    resize: none;
    margin-bottom: 16px;
  }
  .detail-field { margin-bottom: 14px; }
  .detail-label {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: ${COLORS.textDim};
    margin-bottom: 6px;
  }
  .detail-select {
    width: 100%;
    background: ${COLORS.bg};
    border: 1px solid ${COLORS.border};
    border-radius: 7px;
    color: ${COLORS.text};
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 7px 10px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.12s;
  }
  .detail-select:focus { border-color: ${COLORS.accent}; }
  .detail-notes {
    width: 100%;
    background: ${COLORS.bg};
    border: 1px solid ${COLORS.border};
    border-radius: 7px;
    color: ${COLORS.text};
    font-family: 'DM Mono', monospace;
    font-size: 12.5px;
    padding: 9px 10px;
    outline: none;
    resize: none;
    line-height: 1.6;
    transition: border-color 0.12s;
  }
  .detail-notes:focus { border-color: ${COLORS.accent}; }
  .detail-date-input {
    width: 100%;
    background: ${COLORS.bg};
    border: 1px solid ${COLORS.border};
    border-radius: 7px;
    color: ${COLORS.text};
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    padding: 7px 10px;
    outline: none;
    transition: border-color 0.12s;
  }
  .detail-date-input:focus { border-color: ${COLORS.accent}; }
  .detail-tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
  .detail-tag {
    padding: 3px 10px;
    border-radius: 5px;
    font-size: 11.5px;
    font-family: 'DM Mono', monospace;
    cursor: pointer;
    border: 1px solid ${COLORS.border};
    color: ${COLORS.textMuted};
    background: none;
    font-family: 'DM Mono', monospace;
    transition: all 0.1s;
  }
  .detail-tag:hover { border-color: ${COLORS.borderLight}; color: ${COLORS.text}; }
  .detail-tag.active { background: ${COLORS.accent}20; border-color: ${COLORS.accent}60; color: ${COLORS.accent}; }
  .detail-footer {
    padding: 14px 18px;
    border-top: 1px solid ${COLORS.border};
    display: flex;
    gap: 8px;
  }
  .save-btn {
    flex: 1;
    background: ${COLORS.accent};
    border: none;
    border-radius: 8px;
    color: white;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    padding: 9px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .save-btn:hover { background: ${COLORS.accentHover}; }
  .del-task-btn {
    background: none;
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    color: ${COLORS.textMuted};
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 9px 14px;
    cursor: pointer;
    transition: all 0.12s;
  }
  .del-task-btn:hover { background: ${COLORS.red}15; border-color: ${COLORS.red}40; color: ${COLORS.red}; }

  /* STATS BAR */
  .stats-bar {
    display: flex;
    gap: 16px;
    padding: 0 28px 16px;
    flex-shrink: 0;
  }
  .stat-card {
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 9px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .stat-value { font-size: 20px; font-weight: 600; font-family: 'DM Mono', monospace; color: ${COLORS.text}; }
  .stat-label { font-size: 11px; color: ${COLORS.textMuted}; }

  /* EMPTY STATE */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: ${COLORS.textDim};
    gap: 8px;
  }
  .empty-icon { font-size: 36px; margin-bottom: 4px; }
  .empty-title { font-size: 15px; font-weight: 500; color: ${COLORS.textMuted}; }
  .empty-sub { font-size: 13px; }

  /* PROGRESS BAR */
  .progress-wrap { padding: 0 28px 14px; flex-shrink: 0; }
  .progress-label { display: flex; justify-content: space-between; font-size: 11.5px; color: ${COLORS.textMuted}; margin-bottom: 5px; }
  .progress-track { height: 4px; background: ${COLORS.border}; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, ${COLORS.accent}, ${COLORS.pink}); border-radius: 4px; transition: width 0.4s ease; }

  /* TOASTS */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 10px;
    padding: 10px 18px;
    font-size: 13px;
    color: ${COLORS.text};
    box-shadow: 0 8px 32px #00000060;
    animation: toastIn 0.2s ease;
    z-index: 100;
    white-space: nowrap;
  }
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

  /* NLP PREVIEW */
  .nlp-preview {
    background: ${COLORS.bg};
    border: 1px solid ${COLORS.accent}40;
    border-top: none;
    border-radius: 0 0 10px 10px;
    padding: 8px 14px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: -2px;
  }
  .nlp-badge {
    font-size: 11px;
    font-family: 'DM Mono', monospace;
    padding: 2px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
`;

export default function TickTickApp() {
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [view, setView] = useState("today");
  const [selectedTask, setSelectedTask] = useState(null);
  const [quickInput, setQuickInput] = useState("");
  const [filterPriority, setFilterPriority] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [toast, setToast] = useState(null);
  const [nlpPreview, setNlpPreview] = useState(null);
  const inputRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // View filtering
  const getVisibleTasks = useCallback(() => {
    let filtered = tasks;

    if (view === "today") {
      filtered = tasks.filter(t => t.dueDate === today || (isOverdue(t.dueDate) && !t.completed));
    } else if (view === "week") {
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      filtered = tasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
    } else if (view === "all") {
      filtered = tasks;
    } else {
      // list view
      filtered = tasks.filter(t => t.listId === view);
    }

    if (filterPriority !== null) filtered = filtered.filter(t => t.priority === filterPriority);
    if (filterTag) filtered = filtered.filter(t => t.tags.includes(filterTag));
    if (!showCompleted) filtered = filtered.filter(t => !t.completed);

    return filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [tasks, view, filterPriority, filterTag, showCompleted, today]);

  const visibleTasks = getVisibleTasks();

  // Counts
  const todayCount = tasks.filter(t => !t.completed && (t.dueDate === today || isOverdue(t.dueDate))).length;
  const listCounts = LISTS.reduce((acc, l) => {
    acc[l.id] = tasks.filter(t => t.listId === l.id && !t.completed).length;
    return acc;
  }, {});
  const completedToday = tasks.filter(t => t.completed && t.dueDate === today).length;
  const totalToday = tasks.filter(t => t.dueDate === today).length;
  const overdue = tasks.filter(t => !t.completed && isOverdue(t.dueDate)).length;

  // Quick add
  const handleQuickInput = (val) => {
    setQuickInput(val);
    if (val.trim().length > 2) {
      const parsed = parseNLP(val);
      setNlpPreview(parsed);
    } else {
      setNlpPreview(null);
    }
  };

  const handleAddTask = () => {
    if (!quickInput.trim()) return;
    const parsed = parseNLP(quickInput);
    const currentList = LISTS.find(l => l.id === view) ? view : "inbox";
    const newTask = {
      id: "t" + Date.now(),
      title: parsed.title || quickInput.trim(),
      listId: currentList,
      priority: parsed.priority,
      tags: parsed.tags,
      dueDate: parsed.dueDate,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks(prev => [newTask, ...prev]);
    setQuickInput("");
    setNlpPreview(null);
    showToast("✓ Task added");
  };

  const handleToggleComplete = (e, id) => {
    e.stopPropagation();
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
    const task = tasks.find(t => t.id === id);
    if (task && !task.completed) showToast("🎉 Task completed!");
  };

  const handleDeleteTask = (e, id) => {
    e.stopPropagation();
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTask?.id === id) setSelectedTask(null);
    showToast("🗑 Task deleted");
  };

  const handleSaveTask = (updated) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTask(updated);
    showToast("✓ Saved");
  };

  const getViewTitle = () => {
    if (view === "today") return "Today";
    if (view === "week") return "Next 7 Days";
    if (view === "all") return "All Tasks";
    return LISTS.find(l => l.id === view)?.name || "Tasks";
  };

  const getViewMeta = () => {
    const c = visibleTasks.filter(t => !t.completed).length;
    const suffix = view === "today" ? (overdue > 0 ? `, ${overdue} overdue` : "") : "";
    return `${c} task${c !== 1 ? "s" : ""} remaining${suffix}`;
  };

  const grouped = view === "week"
    ? (() => {
        const groups = {};
        visibleTasks.forEach(t => {
          const key = t.dueDate || "No date";
          if (!groups[key]) groups[key] = [];
          groups[key].push(t);
        });
        return groups;
      })()
    : null;

  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <span>✓</span> TaskFlow
          </div>

          <div className="sidebar-section-label">Smart Lists</div>
          {[
            { id: "today", icon: "☀️", label: "Today",      count: todayCount },
            { id: "week",  icon: "📅", label: "Next 7 Days", count: null },
            { id: "all",   icon: "⊞",  label: "All Tasks",   count: tasks.filter(t=>!t.completed).length },
          ].map(v => (
            <div
              key={v.id}
              className={`sidebar-item${view === v.id ? " active" : ""}`}
              onClick={() => setView(v.id)}
            >
              <span>{v.icon}</span>
              {v.label}
              {v.count != null && <span className="count">{v.count}</span>}
            </div>
          ))}

          <div className="sidebar-section-label" style={{marginTop:8}}>Lists</div>
          {LISTS.map(l => (
            <div
              key={l.id}
              className={`sidebar-item${view === l.id ? " active" : ""}`}
              onClick={() => setView(l.id)}
            >
              <span className="sidebar-dot" style={{background: l.color}} />
              {l.name}
              {listCounts[l.id] > 0 && <span className="count">{listCounts[l.id]}</span>}
            </div>
          ))}

          <div className="sidebar-bottom">
            <div
              className="sidebar-item"
              onClick={() => setShowCompleted(p => !p)}
              style={showCompleted ? {color: COLORS.accent} : {}}
            >
              <span>👁</span>
              {showCompleted ? "Hide completed" : "Show completed"}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{getViewTitle()}</div>
            <div className="topbar-meta">{getViewMeta()}</div>
          </div>

          {/* Stats (today only) */}
          {view === "today" && (
            <>
              <div className="stats-bar">
                <div className="stat-card">
                  <div className="stat-value">{totalToday}</div>
                  <div className="stat-label">Due today</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{color: COLORS.green}}>{completedToday}</div>
                  <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{color: overdue > 0 ? COLORS.red : COLORS.textMuted}}>{overdue}</div>
                  <div className="stat-label">Overdue</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{color: COLORS.accent}}>{progressPct}%</div>
                  <div className="stat-label">Progress</div>
                </div>
              </div>
              <div className="progress-wrap">
                <div className="progress-label">
                  <span>Daily progress</span>
                  <span>{completedToday}/{totalToday} tasks</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{width: `${progressPct}%`}} />
                </div>
              </div>
            </>
          )}

          {/* Quick add */}
          <div className="quickadd-wrap">
            <div className="quickadd">
              <span style={{color: COLORS.textDim, fontSize:15}}>+</span>
              <input
                ref={inputRef}
                placeholder='Add task… try "Fix bug tomorrow !high #work"'
                value={quickInput}
                onChange={e => handleQuickInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTask()}
              />
              {quickInput && (
                <span className="quickadd-hint">↵ Enter</span>
              )}
              <button className="quickadd-btn" onClick={handleAddTask}>+</button>
            </div>
            {nlpPreview && nlpPreview.title && (
              <div className="nlp-preview">
                {nlpPreview.title && (
                  <span className="nlp-badge" style={{background: COLORS.accent+"18", color: COLORS.accent}}>
                    ✏ {nlpPreview.title}
                  </span>
                )}
                {nlpPreview.dueDate && (
                  <span className="nlp-badge" style={{background: COLORS.blue+"18", color: COLORS.blue}}>
                    📅 {formatDate(nlpPreview.dueDate)}
                  </span>
                )}
                {nlpPreview.priority > 0 && (
                  <span className="nlp-badge" style={{background: PRIORITIES[nlpPreview.priority].color+"18", color: PRIORITIES[nlpPreview.priority].color}}>
                    {PRIORITIES[nlpPreview.priority].icon} {PRIORITIES[nlpPreview.priority].label}
                  </span>
                )}
                {nlpPreview.tags.map(tag => (
                  <span key={tag} className="nlp-badge" style={{background: COLORS.green+"18", color: COLORS.green}}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="filters">
            <button
              className={`filter-chip${filterPriority === null && !filterTag ? " active" : ""}`}
              onClick={() => { setFilterPriority(null); setFilterTag(null); }}
            >All</button>
            {PRIORITIES.slice(1).reverse().map(p => (
              <button
                key={p.level}
                className={`filter-chip${filterPriority === p.level ? " active" : ""}`}
                onClick={() => setFilterPriority(filterPriority === p.level ? null : p.level)}
                style={filterPriority === p.level ? {} : {}}
              >{p.icon} {p.label}</button>
            ))}
            {TAGS.map(tag => (
              <button
                key={tag}
                className={`filter-chip${filterTag === tag ? " active" : ""}`}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              >#{tag}</button>
            ))}
          </div>

          {/* Task list */}
          <div className="tasklist">
            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✦</div>
                <div className="empty-title">All clear!</div>
                <div className="empty-sub">No tasks here. Add one above.</div>
              </div>
            ) : grouped ? (
              Object.entries(grouped).map(([date, gtasks]) => (
                <div key={date}>
                  <div className="task-group-label">
                    {date === today ? "Today" : date === tomorrow ? "Tomorrow" : formatDate(date)}
                  </div>
                  {gtasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selectedTask?.id === task.id}
                      onSelect={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                      onToggle={handleToggleComplete}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </div>
              ))
            ) : (
              visibleTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selectedTask?.id === task.id}
                  onSelect={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                  onToggle={handleToggleComplete}
                  onDelete={handleDeleteTask}
                />
              ))
            )}
          </div>
        </main>

        {/* DETAIL PANEL */}
        {selectedTask && (
          <DetailPanel
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onSave={handleSaveTask}
            onDelete={(id) => {
              handleDeleteTask({ stopPropagation: ()=>{} }, id);
            }}
          />
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

function TaskRow({ task, selected, onSelect, onToggle, onDelete }) {
  const priority = PRIORITIES[task.priority];
  const list = LISTS.find(l => l.id === task.listId);
  const dateLabel = formatDate(task.dueDate);
  const overdue = isOverdue(task.dueDate) && !task.completed;
  const isToday = task.dueDate === new Date().toISOString().split("T")[0];

  return (
    <div
      className={`task-item${task.completed ? " completed" : ""}${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <div
        className={`task-check${task.completed ? " checked" : ""}`}
        onClick={e => onToggle(e, task.id)}
        style={task.priority > 0 && !task.completed ? { borderColor: priority.color } : {}}
      >
        {task.completed ? "✓" : ""}
      </div>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.priority > 0 && (
            <span className="task-priority" style={{color: priority.color}}>
              {priority.icon}
            </span>
          )}
          {dateLabel && (
            <span className={`task-date${overdue ? " overdue" : isToday ? " today" : ""}`}>
              {overdue ? "⚠ " : ""}{dateLabel}
            </span>
          )}
          {task.tags.map(tag => (
            <span key={tag} className="task-tag">#{tag}</span>
          ))}
          {list && (
            <span className="task-list-badge">
              <span style={{width:6,height:6,borderRadius:"50%",background:list.color,display:"inline-block"}} />
              {list.name}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        <button
          className="task-action-btn del"
          onClick={e => onDelete(e, task.id)}
          title="Delete"
        >✕</button>
      </div>
    </div>
  );
}

function DetailPanel({ task, onClose, onSave, onDelete }) {
  const [local, setLocal] = useState({ ...task });

  useEffect(() => { setLocal({ ...task }); }, [task.id]);

  const update = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));

  const toggleTag = (tag) => {
    setLocal(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <span className="detail-header-title">TASK DETAILS</span>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="detail-body">
        <textarea
          className="detail-title-input"
          value={local.title}
          onChange={e => update("title", e.target.value)}
          rows={2}
          placeholder="Task title..."
        />

        <div className="detail-field">
          <div className="detail-label">Priority</div>
          <select
            className="detail-select"
            value={local.priority}
            onChange={e => update("priority", Number(e.target.value))}
          >
            {PRIORITIES.map(p => (
              <option key={p.level} value={p.level}>{p.icon} {p.label}</option>
            ))}
          </select>
        </div>

        <div className="detail-field">
          <div className="detail-label">List</div>
          <select
            className="detail-select"
            value={local.listId}
            onChange={e => update("listId", e.target.value)}
          >
            {LISTS.map(l => (
              <option key={l.id} value={l.id}>{l.icon} {l.name}</option>
            ))}
          </select>
        </div>

        <div className="detail-field">
          <div className="detail-label">Due Date</div>
          <input
            type="date"
            className="detail-date-input"
            value={local.dueDate || ""}
            onChange={e => update("dueDate", e.target.value || null)}
          />
        </div>

        <div className="detail-field">
          <div className="detail-label">Tags</div>
          <div className="detail-tags-wrap">
            {TAGS.map(tag => (
              <button
                key={tag}
                className={`detail-tag${local.tags?.includes(tag) ? " active" : ""}`}
                onClick={() => toggleTag(tag)}
              >#{tag}</button>
            ))}
          </div>
        </div>

        <div className="detail-field">
          <div className="detail-label">Notes</div>
          <textarea
            className="detail-notes"
            rows={5}
            placeholder="Add notes, links, context..."
            value={local.notes || ""}
            onChange={e => update("notes", e.target.value)}
          />
        </div>

        <div className="detail-field">
          <div className="detail-label">Status</div>
          <select
            className="detail-select"
            value={local.completed ? "done" : "open"}
            onChange={e => update("completed", e.target.value === "done")}
          >
            <option value="open">○ Open</option>
            <option value="done">✓ Completed</option>
          </select>
        </div>
      </div>
      <div className="detail-footer">
        <button className="save-btn" onClick={() => onSave(local)}>Save changes</button>
        <button className="del-task-btn" onClick={() => onDelete(task.id)}>Delete</button>
      </div>
    </div>
  );
}
