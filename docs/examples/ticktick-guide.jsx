import { useState } from "react";

const sections = [
  {
    id: "schema",
    emoji: "🗄️",
    title: "1. Data Model & Schema",
    color: "#6366f1",
    content: [
      {
        heading: "Core Task Object (TypeScript)",
        code: `// types/task.ts
interface Task {
  id: string;                    // UUID v4
  title: string;
  notes?: string;                // Markdown supported
  listId: string;
  parentId?: string;             // For subtasks
  subtaskIds: string[];

  // Scheduling
  dueDate?: string;              // ISO 8601 date "2024-03-15"
  dueTime?: string;              // "14:30"
  startDate?: string;
  timezone: string;              // "America/New_York"

  // Recurrence
  recurrence?: RecurrenceRule;

  // Classification
  priority: 0 | 1 | 2 | 3;     // 0=none, 1=low, 2=med, 3=high
  tags: string[];
  attachments: Attachment[];

  // Reminders
  reminders: Reminder[];

  // Completion
  completed: boolean;
  completedAt?: string;          // ISO timestamp
  completionNote?: string;

  // Collaboration
  assignees: string[];           // User IDs
  createdBy: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;            // Soft delete
  sortOrder: number;             // Manual sort position
  version: number;               // For conflict resolution
}

interface RecurrenceRule {
  rrule: string;                 // "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  endDate?: string;
  count?: number;
  exceptions: string[];          // Skipped dates
}

interface Reminder {
  id: string;
  type: "before" | "on" | "after";
  offsetMinutes: number;         // -30 = 30min before
  method: "push" | "email" | "sms";
  sent: boolean;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;                  // MIME type
  size: number;
  uploadedAt: string;
}`,
      },
      {
        heading: "List / Project Object",
        code: `interface TaskList {
  id: string;
  name: string;
  color: string;                 // hex color
  icon: string;                  // emoji or icon name
  type: "inbox" | "list" | "folder" | "smart";
  parentId?: string;             // For folder nesting
  sortOrder: number;
  isShared: boolean;
  members: ListMember[];
  settings: {
    defaultView: "list" | "kanban" | "timeline";
    showCompleted: boolean;
    sortBy: "manual" | "dueDate" | "priority" | "title";
    sortDir: "asc" | "desc";
  };
  createdAt: string;
  updatedAt: string;
}

interface ListMember {
  userId: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}`,
      },
      {
        heading: "PostgreSQL Schema",
        code: `-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lists
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '📋',
  type TEXT DEFAULT 'list',
  parent_id UUID REFERENCES lists(id),
  sort_order FLOAT DEFAULT 0,
  settings JSONB DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id),
  created_by UUID REFERENCES users(id),
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  due_time TIME,
  start_date DATE,
  timezone TEXT DEFAULT 'UTC',
  rrule TEXT,
  rrule_exceptions DATE[],
  priority SMALLINT DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  tags TEXT[] DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order FLOAT DEFAULT 0,
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (CRITICAL for performance)
CREATE INDEX idx_tasks_list_id ON tasks(list_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE completed = FALSE AND deleted_at IS NULL;
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at);  -- For sync

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL,
  method TEXT DEFAULT 'push',
  sent_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_for) WHERE sent_at IS NULL;`,
      },
    ],
  },
  {
    id: "sync",
    emoji: "🔄",
    title: "2. Sync Architecture",
    color: "#0ea5e9",
    content: [
      {
        heading: "Offline-First Strategy",
        text: `The core challenge: users expect instant UI with reliable sync across devices. The solution is a 3-layer architecture:

Layer 1 — Local Store (SQLite/IndexedDB): Source of truth for reads. All UI reads from local only.
Layer 2 — Sync Queue: Pending operations waiting to be sent.  
Layer 3 — Remote DB (PostgreSQL/Supabase): Canonical truth for multi-device.`,
      },
      {
        heading: "Sync Engine Implementation",
        code: `// sync/SyncEngine.ts
class SyncEngine {
  private queue: Operation[] = [];
  private isSyncing = false;
  private lastSyncAt: number = 0;

  // Every mutation goes through here
  async applyOperation(op: Operation) {
    // 1. Apply locally immediately (optimistic)
    await this.applyLocally(op);
    
    // 2. Queue for remote
    this.queue.push(op);
    await this.persistQueue();
    
    // 3. Try to sync
    this.scheduleSync();
  }

  private scheduleSync = debounce(async () => {
    if (!navigator.onLine || this.isSyncing) return;
    await this.flush();
  }, 500);

  async flush() {
    if (this.queue.length === 0) return;
    this.isSyncing = true;

    try {
      const batch = [...this.queue];
      
      const result = await api.post('/sync', {
        operations: batch,
        lastSyncAt: this.lastSyncAt,
        clientId: this.clientId
      });

      // Apply server changes (other devices)
      for (const serverOp of result.serverOps) {
        await this.applyLocally(serverOp, { skipQueue: true });
      }

      // Resolve conflicts
      for (const conflict of result.conflicts) {
        await this.resolveConflict(conflict);
      }

      // Clear synced ops
      this.queue = this.queue.filter(
        op => !batch.find(b => b.id === op.id)
      );
      
      this.lastSyncAt = result.serverTime;
      await this.persistQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  private async resolveConflict(conflict: Conflict) {
    // Last-write-wins by updatedAt timestamp
    const winner = conflict.local.updatedAt > conflict.remote.updatedAt
      ? conflict.local
      : conflict.remote;
    
    await this.applyLocally({
      type: 'UPDATE_TASK',
      payload: winner,
      skipQueue: true
    });
  }
}

// Operation types
interface Operation {
  id: string;           // UUID for deduplication
  type: OperationType;
  payload: any;
  timestamp: number;
  clientId: string;
  userId: string;
}

type OperationType = 
  | 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK'
  | 'COMPLETE_TASK' | 'MOVE_TASK' | 'REORDER_TASKS'
  | 'CREATE_LIST' | 'UPDATE_LIST' | 'DELETE_LIST';`,
      },
      {
        heading: "Server-Side Sync Endpoint",
        code: `// api/sync.ts (Next.js API Route)
export async function POST(req: Request) {
  const { operations, lastSyncAt, clientId } = await req.json();
  const userId = await getAuthUserId(req);

  // 1. Get changes from other devices since lastSyncAt
  const serverOps = await db.query(\`
    SELECT * FROM sync_log
    WHERE user_id = $1 
      AND created_at > to_timestamp($2 / 1000.0)
      AND client_id != $3
    ORDER BY created_at ASC
    LIMIT 1000
  \`, [userId, lastSyncAt, clientId]);

  // 2. Apply incoming operations
  const conflicts = [];
  for (const op of operations) {
    try {
      await applyOperation(op, userId);
      await logOperation(op, userId);
    } catch (e) {
      if (e instanceof ConflictError) {
        conflicts.push(e.conflict);
      }
    }
  }

  return Response.json({
    serverOps: serverOps.rows,
    conflicts,
    serverTime: Date.now()
  });
}`,
      },
    ],
  },
  {
    id: "nlp",
    emoji: "🧠",
    title: "3. Natural Language Parser",
    color: "#10b981",
    content: [
      {
        heading: "What We're Parsing",
        text: `Input: "Call dentist tomorrow at 3pm high priority #health every week"
Output: {
  title: "Call dentist",
  dueDate: "2024-03-16",
  dueTime: "15:00",
  priority: 3,
  tags: ["health"],
  recurrence: { rrule: "FREQ=WEEKLY" }
}`,
      },
      {
        heading: "Parser Implementation",
        code: `// nlp/parser.ts
import * as chrono from 'chrono-node';
import { RRule } from 'rrule';

interface ParsedTask {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 0 | 1 | 2 | 3;
  tags: string[];
  recurrence?: string;
  assignee?: string;
}

export function parseTaskInput(input: string): ParsedTask {
  let remaining = input;
  const result: ParsedTask = { title: '', tags: [] };

  // 1. Extract tags (#tag)
  const tagRegex = /#(\\w+)/g;
  result.tags = [...remaining.matchAll(tagRegex)].map(m => m[1]);
  remaining = remaining.replace(tagRegex, '').trim();

  // 2. Extract priority (!high, !!, p1, etc.)
  const priorityMap: Record<string, 0|1|2|3> = {
    '!low': 1, '!med': 2, '!medium': 2,
    '!high': 3, '!urgent': 3, '!!!': 3, '!!': 2, '!': 1,
    'p1': 3, 'p2': 2, 'p3': 1
  };
  for (const [pattern, level] of Object.entries(priorityMap)) {
    const re = new RegExp(\`\\\\b\${pattern}\\\\b\`, 'i');
    if (re.test(remaining)) {
      result.priority = level;
      remaining = remaining.replace(re, '').trim();
      break;
    }
  }

  // 3. Extract recurrence
  const recurrencePatterns = [
    { re: /\\bevery day\\b|\\bdaily\\b/i, rrule: 'FREQ=DAILY' },
    { re: /\\bevery week\\b|\\bweekly\\b/i, rrule: 'FREQ=WEEKLY' },
    { re: /\\bevery month\\b|\\bmonthly\\b/i, rrule: 'FREQ=MONTHLY' },
    { re: /\\bevery (mon|tue|wed|thu|fri|sat|sun)/i, rrule: (m: RegExpMatchArray) => {
      const dayMap: Record<string,string> = {
        mon:'MO',tue:'TU',wed:'WE',thu:'TH',fri:'FR',sat:'SA',sun:'SU'
      };
      return \`FREQ=WEEKLY;BYDAY=\${dayMap[m[1].toLowerCase()]}\`;
    }},
    { re: /\\bevery (\\d+) days?\\b/i, rrule: (m: RegExpMatchArray) => 
        \`FREQ=DAILY;INTERVAL=\${m[1]}\` },
  ];

  for (const { re, rrule } of recurrencePatterns) {
    const match = remaining.match(re);
    if (match) {
      result.recurrence = typeof rrule === 'function' ? rrule(match) : rrule;
      remaining = remaining.replace(re, '').trim();
      break;
    }
  }

  // 4. Extract assignee (@person)
  const assigneeMatch = remaining.match(/@(\\w+)/);
  if (assigneeMatch) {
    result.assignee = assigneeMatch[1];
    remaining = remaining.replace(/@\\w+/, '').trim();
  }

  // 5. Extract date/time using chrono
  const parsed = chrono.parse(remaining, new Date(), { forwardDate: true });
  if (parsed.length > 0) {
    const dateResult = parsed[0];
    result.dueDate = dateResult.start.date().toISOString().split('T')[0];
    
    if (dateResult.start.isCertain('hour')) {
      const d = dateResult.start.date();
      result.dueTime = \`\${String(d.getHours()).padStart(2,'0')}:\${String(d.getMinutes()).padStart(2,'0')}\`;
    }
    
    // Remove date text from title
    remaining = remaining.slice(0, dateResult.index) + 
                remaining.slice(dateResult.index + dateResult.text.length);
  }

  // 6. Whatever's left is the title
  result.title = remaining.replace(/\\s+/g, ' ').trim();
  
  return result;
}`,
      },
    ],
  },
  {
    id: "state",
    emoji: "⚡",
    title: "4. State Management",
    color: "#f59e0b",
    content: [
      {
        heading: "Zustand Store Architecture",
        code: `// store/taskStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

interface TaskStore {
  // State
  tasks: Record<string, Task>;
  lists: Record<string, TaskList>;
  tags: string[];
  ui: UIState;

  // Task actions
  createTask: (task: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string, completed: boolean) => Promise<void>;
  moveTask: (id: string, listId: string) => Promise<void>;

  // List actions
  createList: (list: Partial<TaskList>) => Promise<TaskList>;
  updateList: (id: string, updates: Partial<TaskList>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  // Selectors
  getTasksByList: (listId: string) => Task[];
  getTasksDueToday: () => Task[];
  getTasksDueThisWeek: () => Task[];
  getOverdueTasks: () => Task[];
  getTasksByTag: (tag: string) => Task[];
}

const useTaskStore = create<TaskStore>()(
  persist(
    immer((set, get) => ({
      tasks: {},
      lists: {},
      tags: [],
      ui: { selectedListId: 'inbox', view: 'list', filter: {} },

      createTask: async (partial) => {
        const task: Task = {
          id: crypto.randomUUID(),
          title: '',
          listId: get().ui.selectedListId,
          subtaskIds: [],
          priority: 0,
          tags: [],
          attachments: [],
          reminders: [],
          completed: false,
          createdBy: getCurrentUserId(),
          assignees: [],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sortOrder: Date.now(),
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...partial,
        };

        // Optimistic update
        set(state => { state.tasks[task.id] = task; });

        // Sync to server
        await syncEngine.applyOperation({
          type: 'CREATE_TASK',
          payload: task,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          clientId: getClientId(),
          userId: getCurrentUserId(),
        });

        return task;
      },

      updateTask: async (id, updates) => {
        set(state => {
          if (state.tasks[id]) {
            Object.assign(state.tasks[id], {
              ...updates,
              updatedAt: new Date().toISOString(),
              version: state.tasks[id].version + 1,
            });
          }
        });

        await syncEngine.applyOperation({
          type: 'UPDATE_TASK',
          payload: { id, ...updates },
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          clientId: getClientId(),
          userId: getCurrentUserId(),
        });
      },

      // SELECTORS
      getTasksDueToday: () => {
        const today = new Date().toISOString().split('T')[0];
        return Object.values(get().tasks).filter(t =>
          !t.completed && !t.deletedAt && t.dueDate === today
        ).sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          return (a.dueTime || '23:59') < (b.dueTime || '23:59') ? -1 : 1;
        });
      },

      getTasksDueThisWeek: () => {
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        return Object.values(get().tasks).filter(t => {
          if (t.completed || t.deletedAt || !t.dueDate) return false;
          const due = new Date(t.dueDate);
          return due >= today && due <= weekEnd;
        });
      },

      getOverdueTasks: () => {
        const today = new Date().toISOString().split('T')[0];
        return Object.values(get().tasks).filter(t =>
          !t.completed && !t.deletedAt && t.dueDate && t.dueDate < today
        );
      },
    })),
    { name: 'task-store', partialize: (s) => ({ tasks: s.tasks, lists: s.lists }) }
  )
);`,
      },
    ],
  },
  {
    id: "ui",
    emoji: "🎨",
    title: "5. UI/UX Implementation",
    color: "#ec4899",
    content: [
      {
        heading: "Views Architecture",
        text: `Build these views in order of priority:
1. List View — default, sortable, filterable task list
2. Today View — smart list showing due today + overdue
3. Next 7 Days — grouped by day with day headers
4. Calendar View — monthly/weekly grid
5. Kanban View — columns by status or priority
6. Timeline View — Gantt-style for project planning`,
      },
      {
        heading: "Drag & Drop with dnd-kit",
        code: `// components/TaskList.tsx
import {
  DndContext, closestCenter, KeyboardSensor,
  PointerSensor, useSensor, useSensors,
  DragEndEvent, DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  arrayMove, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTask({ task }: { task: Task }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <TaskItem task={task} />
    </div>
  );
}

function TaskList({ listId }: { listId: string }) {
  const tasks = useTaskStore(s => s.getTasksByList(listId));
  const updateTask = useTaskStore(s => s.updateTask);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 } // Prevent accidental drags
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);

    // Update sort orders
    reordered.forEach((task, i) => {
      updateTask(task.id, { sortOrder: i * 1000 });
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map(task => <SortableTask key={task.id} task={task} />)}
      </SortableContext>
    </DndContext>
  );
}`,
      },
      {
        heading: "Swipe Actions (Mobile)",
        code: `// components/SwipeableTask.tsx
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

function SwipeableTask({ task, onComplete, onDelete, onSchedule }) {
  const SWIPE_THRESHOLD = 80;
  const [{ x }, api] = useSpring(() => ({ x: 0 }));

  const bind = useDrag(({ down, movement: [mx], velocity: [vx], cancel }) => {
    // Swipe right = complete, swipe left = delete
    if (!down) {
      if (mx > SWIPE_THRESHOLD || vx > 0.5) {
        api.start({ x: 400 });
        setTimeout(() => onComplete(task.id), 200);
      } else if (mx < -SWIPE_THRESHOLD || vx < -0.5) {
        api.start({ x: -400 });
        setTimeout(() => onDelete(task.id), 200);
      } else {
        api.start({ x: 0 }); // Snap back
      }
    } else {
      api.start({ x: mx, immediate: true });
    }
  }, { axis: 'x', filterTaps: true });

  // Background color based on direction
  const bgStyle = x.to(x => 
    x > 0 
      ? \`rgba(16, 185, 129, \${Math.min(x / SWIPE_THRESHOLD, 1) * 0.8})\`
      : \`rgba(239, 68, 68, \${Math.min(-x / SWIPE_THRESHOLD, 1) * 0.8})\`
  );

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <animated.div style={{ background: bgStyle, position:'absolute', inset:0 }}>
        <span style={{ position:'absolute', left: 16, top:'50%', transform:'translateY(-50%)' }}>✓</span>
        <span style={{ position:'absolute', right: 16, top:'50%', transform:'translateY(-50%)' }}>🗑</span>
      </animated.div>
      <animated.div {...bind()} style={{ x, touchAction: 'pan-y' }}>
        <TaskItem task={task} />
      </animated.div>
    </div>
  );
}`,
      },
    ],
  },
  {
    id: "backend",
    emoji: "🖥️",
    title: "6. Backend Architecture",
    color: "#8b5cf6",
    content: [
      {
        heading: "API Design (REST + Realtime)",
        code: `// REST endpoints
GET    /api/tasks?listId=&since=&limit=&offset=
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/complete
POST   /api/tasks/reorder

GET    /api/lists
POST   /api/lists
PATCH  /api/lists/:id
DELETE /api/lists/:id

POST   /api/sync           // Batch sync endpoint
GET    /api/sync/status    // Last sync timestamp

// Real-time via Supabase or custom WebSocket
// Subscribe to task changes
supabase
  .channel('tasks')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: \`created_by=eq.\${userId}\`
  }, (payload) => {
    syncEngine.handleRemoteChange(payload);
  })
  .subscribe();`,
      },
      {
        heading: "Supabase Setup (Recommended Backend)",
        code: `// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Row Level Security policies (SQL)
/*
-- Users can only see their own tasks
CREATE POLICY "users_own_tasks" ON tasks
  FOR ALL USING (
    created_by = auth.uid() OR
    list_id IN (
      SELECT id FROM lists WHERE owner_id = auth.uid()
      UNION
      SELECT list_id FROM list_members WHERE user_id = auth.uid()
    )
  );

-- Users can only see their own lists
CREATE POLICY "users_own_lists" ON lists
  FOR ALL USING (
    owner_id = auth.uid() OR
    id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );
*/

// Task operations
export const taskApi = {
  async getTasksSince(since: string) {
    return supabase
      .from('tasks')
      .select('*')
      .gt('updated_at', since)
      .is('deleted_at', null);
  },

  async upsertTask(task: Task) {
    return supabase
      .from('tasks')
      .upsert(task, { onConflict: 'id' })
      .select()
      .single();
  },

  async softDelete(id: string) {
    return supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
  }
};`,
      },
    ],
  },
  {
    id: "notifications",
    emoji: "🔔",
    title: "7. Notifications & Reminders",
    color: "#f97316",
    content: [
      {
        heading: "Reminder Scheduler",
        code: `// reminders/scheduler.ts

// 1. Calculate next reminder time for a task
function getNextReminderTime(task: Task, reminder: Reminder): Date | null {
  if (!task.dueDate) return null;
  
  const dueDateStr = task.dueTime 
    ? \`\${task.dueDate}T\${task.dueTime}\`
    : \`\${task.dueDate}T09:00\`;
    
  const dueDate = new Date(dueDateStr);
  const reminderTime = new Date(dueDate.getTime() + reminder.offsetMinutes * 60 * 1000);
  
  if (reminderTime <= new Date()) return null; // Already passed
  return reminderTime;
}

// 2. Web Push setup
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_KEY!)
  });

  // Send subscription to server
  await api.post('/api/push/subscribe', { subscription });
}

// 3. Service Worker (sw.js)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: { taskId: data.taskId, url: data.url },
      actions: [
        { action: 'complete', title: '✓ Complete' },
        { action: 'snooze', title: '⏰ Snooze 30min' },
      ],
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'complete') {
    // Background complete
    fetch(\`/api/tasks/\${event.notification.data.taskId}/complete\`, {
      method: 'POST',
      headers: { 'Authorization': \`Bearer \${getStoredToken()}\` }
    });
  } else if (event.action === 'snooze') {
    // Reschedule +30 min
    fetch(\`/api/reminders/snooze\`, {
      method: 'POST',
      body: JSON.stringify({ taskId: event.notification.data.taskId, minutes: 30 })
    });
  } else {
    clients.openWindow(event.notification.data.url);
  }
});

// 4. Server-side reminder sending (cron job every minute)
// api/cron/reminders.ts
export async function sendDueReminders() {
  const due = await db.query(\`
    SELECT r.*, t.title, t.id as task_id, u.id as user_id
    FROM reminders r
    JOIN tasks t ON r.task_id = t.id
    JOIN users u ON t.created_by = u.id
    WHERE r.scheduled_for <= NOW()
      AND r.sent_at IS NULL
      AND t.completed = FALSE
      AND t.deleted_at IS NULL
    LIMIT 100
  \`);

  for (const reminder of due.rows) {
    await sendPushNotification(reminder.user_id, {
      title: reminder.title,
      body: getRelativeTimeString(reminder.scheduled_for),
      taskId: reminder.task_id,
    });
    
    await db.query(
      'UPDATE reminders SET sent_at = NOW() WHERE id = $1',
      [reminder.id]
    );
  }
}`,
      },
    ],
  },
  {
    id: "gamification",
    emoji: "🏆",
    title: "8. Gamification System",
    color: "#eab308",
    content: [
      {
        heading: "Points & Karma System",
        code: `// gamification/scoring.ts

const POINT_VALUES = {
  COMPLETE_TASK: 10,
  COMPLETE_HIGH_PRIORITY: 25,
  COMPLETE_ON_TIME: 15,         // Bonus for completing before due
  COMPLETE_EARLY: 20,           // Extra bonus for 1+ day early
  COMPLETE_HABIT: 20,           // Completing a recurring task
  MAINTAIN_STREAK_7: 50,        // 7-day streak bonus
  MAINTAIN_STREAK_30: 200,      // 30-day streak bonus
  COMPLETE_ALL_TODAY: 30,       // All tasks done today
  CREATE_TASK: 2,
};

interface UserStats {
  userId: string;
  totalPoints: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  lastActiveDate: string;
  badges: Badge[];
  weeklyPoints: number[];       // Last 12 weeks
}

function calculatePoints(task: Task, completedAt: Date): number {
  let points = POINT_VALUES.COMPLETE_TASK;
  
  if (task.priority === 3) points += POINT_VALUES.COMPLETE_HIGH_PRIORITY;
  if (task.recurrence) points += POINT_VALUES.COMPLETE_HABIT;
  
  if (task.dueDate) {
    const due = new Date(task.dueDate + 'T23:59:59');
    const daysDiff = (due.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff >= 1) points += POINT_VALUES.COMPLETE_EARLY;
    else if (daysDiff >= 0) points += POINT_VALUES.COMPLETE_ON_TIME;
    // No penalty for late, just no bonus
  }
  
  return points;
}

function getLevelFromPoints(points: number): number {
  // Logarithmic scaling: more points needed per level
  return Math.floor(Math.log(points / 100 + 1) / Math.log(1.5)) + 1;
}

function getStreakStatus(stats: UserStats): { 
  isActive: boolean; atRisk: boolean; multiplier: number 
} {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const isActive = stats.lastActiveDate === today || stats.lastActiveDate === yesterday;
  const atRisk = stats.lastActiveDate === yesterday; // Haven't done anything today yet
  
  // Streak multiplier: longer streaks = more points
  const multiplier = stats.currentStreak >= 30 ? 2.0
    : stats.currentStreak >= 7 ? 1.5
    : stats.currentStreak >= 3 ? 1.2
    : 1.0;
    
  return { isActive, atRisk, multiplier };
}

// Badges
const BADGES = [
  { id: 'first_task', name: 'First Steps', icon: '👶', desc: 'Complete your first task' },
  { id: 'streak_7', name: 'Week Warrior', icon: '🔥', desc: '7-day streak' },
  { id: 'streak_30', name: 'Month Master', icon: '⚡', desc: '30-day streak' },
  { id: 'century', name: 'Centurion', icon: '💯', desc: 'Complete 100 tasks' },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', desc: 'Complete 10 tasks early' },
  { id: 'list_creator', name: 'Organizer', icon: '📂', desc: 'Create 5 lists' },
  { id: 'inbox_zero', name: 'Inbox Zero', icon: '✨', desc: 'Clear all tasks on 3 days' },
];`,
      },
      {
        heading: "Habit Tracking",
        code: `// gamification/habits.ts

interface HabitStats {
  taskId: string;
  title: string;
  rrule: string;
  completionHistory: string[];    // ISO date strings
  currentStreak: number;
  longestStreak: number;
  completionRate: number;         // 0-1, last 30 occurrences
  heatmapData: Record<string, boolean>; // date -> completed
}

function calculateHabitStreak(completionHistory: string[]): number {
  if (completionHistory.length === 0) return 0;
  
  const sorted = [...completionHistory].sort().reverse();
  let streak = 0;
  let checkDate = new Date();
  
  for (const dateStr of sorted) {
    const diff = Math.floor(
      (checkDate.getTime() - new Date(dateStr).getTime()) / 86400000
    );
    
    if (diff <= 1) {
      streak++;
      checkDate = new Date(dateStr);
    } else {
      break;
    }
  }
  
  return streak;
}

// Contribution heatmap (like GitHub's)
function buildHeatmapData(
  completionHistory: string[],
  weeks: number = 52
): HeatmapEntry[] {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - weeks * 7);
  
  const completionSet = new Set(completionHistory);
  const entries: HeatmapEntry[] = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    entries.push({
      date: dateStr,
      completed: completionSet.has(dateStr),
      dayOfWeek: d.getDay(),
      week: Math.floor((d.getTime() - startDate.getTime()) / (7 * 86400000))
    });
  }
  
  return entries;
}`,
      },
    ],
  },
  {
    id: "performance",
    emoji: "🚀",
    title: "9. Performance",
    color: "#14b8a6",
    content: [
      {
        heading: "Handling 10,000+ Tasks",
        text: `Key insight: Never render all tasks. Virtualize everything. Filter at the selector level, not the render level.`,
      },
      {
        heading: "Virtualized List with react-virtual",
        code: `// components/VirtualTaskList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualTaskList({ tasks }: { tasks: Task[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,          // Estimated row height
    overscan: 10,                     // Render 10 items outside viewport
    measureElement: (el) => el.getBoundingClientRect().height, // Measure actual
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: \`translateY(\${virtualItem.start}px)\`,
            }}
          >
            <TaskItem task={tasks[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}`,
      },
      {
        heading: "Optimized Selectors with Memoization",
        code: `// store/selectors.ts
import { createSelector } from 'reselect';

// Only recomputes when tasks or filter changes
const selectFilteredTasks = createSelector(
  [(state) => state.tasks, (state) => state.ui.filter],
  (tasks, filter) => {
    let result = Object.values(tasks);
    
    if (filter.listId) result = result.filter(t => t.listId === filter.listId);
    if (filter.tag) result = result.filter(t => t.tags.includes(filter.tag));
    if (filter.priority !== undefined) result = result.filter(t => t.priority === filter.priority);
    if (!filter.showCompleted) result = result.filter(t => !t.completed);
    result = result.filter(t => !t.deletedAt);
    
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  }
);

// Database-level: Use indexes for date queries
// Bad:  SELECT * FROM tasks WHERE created_by = $1  (scans all tasks)
// Good: SELECT * FROM tasks WHERE created_by = $1  (uses index)
//         AND deleted_at IS NULL
//         AND due_date = CURRENT_DATE
//       ORDER BY priority DESC, sort_order ASC
//       LIMIT 200;

// Use cursor-based pagination for large lists
const getTasksPage = async (cursor?: string, limit = 50) => {
  return db.query(\`
    SELECT * FROM tasks
    WHERE created_by = $1
      AND deleted_at IS NULL
      AND (\$2::uuid IS NULL OR id > \$2)
    ORDER BY sort_order ASC
    LIMIT \$3
  \`, [userId, cursor ?? null, limit]);
};`,
      },
      {
        heading: "IndexedDB for Local Storage (Web)",
        code: `// db/localDb.ts - Using Dexie.js
import Dexie, { Table } from 'dexie';

class AppDatabase extends Dexie {
  tasks!: Table<Task>;
  lists!: Table<TaskList>;
  syncQueue!: Table<Operation>;

  constructor() {
    super('TaskApp');
    this.version(1).stores({
      // Index everything you filter/sort by
      tasks: 'id, listId, dueDate, priority, completed, updatedAt, [listId+completed]',
      lists: 'id, type, sortOrder',
      syncQueue: '++localId, timestamp',
    });
  }
}

export const db = new AppDatabase();

// Compound queries are fast with proper indexes
export const getTodayTasks = () => {
  const today = new Date().toISOString().split('T')[0];
  return db.tasks
    .where('[listId+completed]').equals(['any', 0])  // Not ideal but shows compound
    // Better:
    .filter(t => t.dueDate === today && !t.completed && !t.deletedAt)
    .toArray();
};`,
      },
    ],
  },
  {
    id: "roadmap",
    emoji: "🗺️",
    title: "10. Full Build Roadmap",
    color: "#64748b",
    content: [
      {
        heading: "Phase 1: Core MVP (Weeks 1-4)",
        text: `Week 1: Project setup, auth (Supabase Auth), basic task CRUD, local state
Week 2: Lists, tags, priorities, due dates — all data model fields
Week 3: Today view, Inbox, All Tasks — core navigation
Week 4: Offline support, sync engine v1, IndexedDB/SQLite

Ship: A working todo app. Get real users.`,
      },
      {
        heading: "Phase 2: Power Features (Weeks 5-8)",
        text: `Week 5: Natural language parser, quick-add bar
Week 6: Recurring tasks (rrule), subtasks
Week 7: Push notifications, reminders
Week 8: Drag & drop reorder, swipe actions (mobile)

Ship: Feature-complete for power users.`,
      },
      {
        heading: "Phase 3: Views & Productivity (Weeks 9-12)",
        text: `Week 9: Calendar view (react-big-calendar)
Week 10: Kanban view (columns by list or status)
Week 11: Filters, search (full-text), bulk actions
Week 12: Keyboard shortcuts, command palette (cmdk)

Ship: Productivity app that rivals basic TickTick.`,
      },
      {
        heading: "Phase 4: Collaboration & Polish (Weeks 13-16)",
        text: `Week 13: Shared lists, member invites, real-time updates
Week 14: Gamification — points, streaks, habits, heatmap
Week 15: File attachments, rich notes (markdown editor)
Week 16: Performance audit — virtualization, query optimization

Ship: Full-featured v1.0`,
      },
      {
        heading: "Tech Stack Summary",
        code: `// Recommended full stack
{
  "frontend": {
    "framework": "Next.js 14 (App Router)",
    "ui": "Tailwind CSS + Radix UI primitives",
    "state": "Zustand + Immer",
    "dnd": "@dnd-kit/core",
    "gestures": "@use-gesture/react + @react-spring/web",
    "virtualList": "@tanstack/react-virtual",
    "dates": "date-fns",
    "recurrence": "rrule",
    "nlp_dates": "chrono-node",
    "localDb": "Dexie.js (IndexedDB)",
    "forms": "react-hook-form + zod",
    "markdown": "@uiw/react-md-editor"
  },
  "mobile": {
    "framework": "React Native (Expo)",
    "navigation": "Expo Router",
    "localDb": "expo-sqlite",
    "notifications": "expo-notifications",
    "gestures": "react-native-gesture-handler"
  },
  "backend": {
    "database": "PostgreSQL (via Supabase)",
    "auth": "Supabase Auth",
    "realtime": "Supabase Realtime",
    "storage": "Supabase Storage (attachments)",
    "pushNotifications": "Web Push API + FCM (mobile)",
    "cron": "Vercel Cron or pg_cron",
    "hosting": "Vercel (frontend) + Supabase (backend)"
  },
  "testing": {
    "unit": "Vitest",
    "components": "@testing-library/react",
    "e2e": "Playwright",
    "ci": "GitHub Actions"
  }
}`,
      },
    ],
  },
];

export default function TickTickGuide() {
  const [activeSection, setActiveSection] = useState("schema");
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const section = sections.find(s => s.id === activeSection);

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      background: "#0d1117",
      color: "#e6edf3",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px 0",
        borderBottom: "1px solid #21262d",
        background: "#161b22",
      }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "#f0f6fc",
            letterSpacing: "-0.5px",
          }}>
            ⚡ TickTick-Like App — Complete Build Guide
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#7d8590" }}>
            10 deep-dive sections · Full code examples · Production-ready patterns
          </p>
        </div>

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 0 }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                padding: "8px 14px",
                background: activeSection === s.id ? "#0d1117" : "transparent",
                color: activeSection === s.id ? s.color : "#7d8590",
                border: "none",
                borderBottom: activeSection === s.id ? `2px solid ${s.color}` : "2px solid transparent",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                fontWeight: activeSection === s.id ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {s.emoji} {s.title.split(". ")[1] || s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
        {section && (
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
            }}>
              <span style={{ fontSize: 28 }}>{section.emoji}</span>
              <h2 style={{
                margin: 0,
                fontSize: 20,
                color: section.color,
                fontWeight: 700,
              }}>
                {section.title}
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {section.content.map((item, i) => {
                const key = `${section.id}-${i}`;
                const isExpanded = expandedItems[key] !== false; // Default expanded

                return (
                  <div
                    key={key}
                    style={{
                      border: `1px solid #21262d`,
                      borderLeft: `3px solid ${section.color}`,
                      borderRadius: "0 6px 6px 0",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => toggleItem(key)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "#161b22",
                        border: "none",
                        color: "#f0f6fc",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 13,
                        fontFamily: "inherit",
                        fontWeight: 600,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{item.heading}</span>
                      <span style={{ color: "#7d8590", fontSize: 11 }}>
                        {isExpanded ? "▲ collapse" : "▼ expand"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: "16px" }}>
                        {item.text && (
                          <p style={{
                            margin: "0 0 12px",
                            fontSize: 13,
                            lineHeight: 1.7,
                            color: "#8b949e",
                            whiteSpace: "pre-line",
                          }}>
                            {item.text}
                          </p>
                        )}
                        {item.code && (
                          <pre style={{
                            margin: 0,
                            padding: "16px",
                            background: "#0d1117",
                            border: "1px solid #30363d",
                            borderRadius: 6,
                            fontSize: 12,
                            lineHeight: 1.6,
                            color: "#e6edf3",
                            overflow: "auto",
                            whiteSpace: "pre",
                          }}>
                            <code>{item.code}</code>
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 24px",
        borderTop: "1px solid #21262d",
        background: "#161b22",
        fontSize: 11,
        color: "#7d8590",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span>10 sections · ~800 lines of production code examples</span>
        <span>Click any section tab above to navigate</span>
      </div>
    </div>
  );
}
