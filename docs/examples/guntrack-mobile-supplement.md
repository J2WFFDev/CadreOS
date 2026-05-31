# 📱 GunTrack-Like App — Complete Mobile Build Supplement

> Full React Native / Expo deep dive covering project structure, navigation, SQLite offline storage, camera, push notifications, biometric auth, mobile UI patterns, and App Store submission. Companion to the main build guide.

---

## Table of Contents

1. [Project Setup & Expo Configuration](#1-project-setup--expo-configuration)
2. [Project Structure & Navigation](#2-project-structure--navigation)
3. [Local SQLite Database (Offline-First)](#3-local-sqlite-database-offline-first)
4. [Sync Engine (Mobile)](#4-sync-engine-mobile)
5. [Camera & Photo Picker](#5-camera--photo-picker)
6. [Biometric Auth & App Lock](#6-biometric-auth--app-lock)
7. [Push Notifications (APNs + FCM)](#7-push-notifications-apns--fcm)
8. [Mobile UI Patterns](#8-mobile-ui-patterns)
9. [Subscriptions with RevenueCat](#9-subscriptions-with-revenuecat)
10. [EAS Build & OTA Updates](#10-eas-build--ota-updates)
11. [App Store & Google Play Submission](#11-app-store--google-play-submission)
12. [Mobile Performance](#12-mobile-performance)
13. [Full Mobile Tech Stack & Scripts](#13-full-mobile-tech-stack--scripts)

---

## 1. Project Setup & Expo Configuration

### Initial Setup

```bash
# Create new Expo project with TypeScript
npx create-expo-app guntrack-mobile --template blank-typescript
cd guntrack-mobile

# Core dependencies
npx expo install expo-router expo-sqlite expo-camera expo-image-picker
npx expo install expo-local-authentication expo-notifications expo-secure-store
npx expo install expo-file-system expo-sharing expo-print
npx expo install expo-updates @expo/vector-icons

# State & data
npm install zustand immer @tanstack/react-query zod react-hook-form
npm install @hookform/resolvers

# Supabase
npm install @supabase/supabase-js

# UI
npm install react-native-reanimated react-native-gesture-handler
npm install @gorhom/bottom-sheet react-native-safe-area-context
npm install react-native-screens

# Subscriptions
npm install react-native-purchases

# PDF generation
npm install react-native-html-to-pdf

# Utilities
npm install date-fns react-native-uuid
```

### app.json / app.config.ts

```typescript
// app.config.ts
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GunTrack',
  slug: 'guntrack-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',   // Supports dark mode
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f0f11',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yourcompany.guntrack',
    buildNumber: '1',
    infoPlist: {
      // Required permission strings — App Store will reject without these
      NSCameraUsageDescription:
        'GunTrack uses your camera to photograph firearms, accessories, and targets.',
      NSPhotoLibraryUsageDescription:
        'GunTrack accesses your photo library to attach images to firearm records.',
      NSPhotoLibraryAddUsageDescription:
        'GunTrack saves target photos to your photo library.',
      NSFaceIDUsageDescription:
        'GunTrack uses Face ID to protect your firearm records.',
      NSLocationWhenInUseUsageDescription:
        'GunTrack uses your location to log shooting range locations.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f0f11',
    },
    package: 'com.yourcompany.guntrack',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'RECEIVE_BOOT_COMPLETED',       // For notification scheduling
      'VIBRATE',
      'ACCESS_FINE_LOCATION',
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    [
      'expo-camera',
      { cameraPermission: 'GunTrack uses your camera to photograph firearms and targets.' }
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#7c6af7',
        sounds: ['./assets/notification.wav'],
      }
    ],
    'expo-secure-store',
    [
      'expo-local-authentication',
      { faceIDPermission: 'GunTrack uses Face ID to protect your firearm records.' }
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
    eas: { projectId: 'your-eas-project-id' },
  },
  updates: {
    url: 'https://u.expo.dev/your-eas-project-id',
  },
  runtimeVersion: { policy: 'appVersion' },
});
```

### Environment Variables

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_REVENUECAT_API_KEY=your-revenuecat-key

# Never commit — use EAS Secrets for CI
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 2. Project Structure & Navigation

### Folder Structure

```
guntrack-mobile/
├── app/                          ← Expo Router file-based routing
│   ├── _layout.tsx               ← Root layout (auth gate, biometric, providers)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/                    ← Protected routes (require auth)
│   │   ├── _layout.tsx           ← Tab navigator
│   │   ├── index.tsx             ← Dashboard tab
│   │   ├── firearms/
│   │   │   ├── index.tsx         ← Firearm list
│   │   │   ├── [id].tsx          ← Firearm detail
│   │   │   ├── [id]/
│   │   │   │   ├── sessions.tsx
│   │   │   │   ├── maintenance.tsx
│   │   │   │   └── malfunctions.tsx
│   │   │   └── new.tsx
│   │   ├── ammo/
│   │   │   ├── index.tsx
│   │   │   └── new.tsx
│   │   ├── sessions/
│   │   │   ├── index.tsx
│   │   │   └── new.tsx
│   │   └── settings/
│   │       ├── index.tsx
│   │       ├── subscription.tsx
│   │       └── export.tsx
├── components/
│   ├── firearms/
│   │   ├── FirearmCard.tsx
│   │   ├── FirearmForm.tsx
│   │   └── CaliberBadge.tsx
│   ├── ammo/
│   │   ├── AmmoCard.tsx
│   │   └── AmmoCountBadge.tsx
│   ├── sessions/
│   │   └── SessionForm.tsx
│   ├── shared/
│   │   ├── PhotoPicker.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── SwipeableRow.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingSpinner.tsx
│   └── dashboard/
│       ├── StatCard.tsx
│       └── RecentActivity.tsx
├── db/
│   ├── schema.ts                 ← SQLite schema definition
│   ├── migrations.ts             ← Schema version migrations
│   └── queries/
│       ├── firearms.ts
│       ├── ammo.ts
│       ├── sessions.ts
│       └── maintenance.ts
├── store/
│   ├── authStore.ts
│   ├── firearmsStore.ts
│   └── syncStore.ts
├── services/
│   ├── supabase.ts
│   ├── syncService.ts
│   ├── notificationService.ts
│   └── photoService.ts
├── hooks/
│   ├── useFirearms.ts
│   ├── useAmmo.ts
│   ├── useBiometric.ts
│   └── useSync.ts
└── utils/
    ├── encryption.ts
    └── formatting.ts
```

### Root Layout & Auth Gate

```typescript
// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useAuthStore } from '@/store/authStore';
import { BiometricLock } from '@/components/shared/BiometricLock';
import { SyncProvider } from '@/services/syncService';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading, initialize } = useAuthStore();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      await initialize();           // Load session from SecureStore
      await checkForUpdates();      // OTA update check
      setAppReady(true);
      SplashScreen.hideAsync();
    }
    prepare();
  }, []);

  async function checkForUpdates() {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (e) {
      // Ignore — user may be offline
    }
  }

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SyncProvider>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </SyncProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

// app/(app)/_layout.tsx — Tab navigator with biometric gate
import { Tabs, Redirect } from 'expo-router';
import { BiometricGate } from '@/components/shared/BiometricGate';
import { Ionicons } from '@expo/vector-icons';

export default function AppLayout() {
  const { session } = useAuthStore();
  if (!session) return <Redirect href="/login" />;

  return (
    <BiometricGate>
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: '#18181c', borderTopColor: '#2a2a35' },
          tabBarActiveTintColor: '#7c6af7',
          tabBarInactiveTintColor: '#7a7a99',
          headerStyle: { backgroundColor: '#18181c' },
          headerTintColor: '#f0eff6',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="firearms"
          options={{
            title: 'Firearms',
            tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ammo"
          options={{
            title: 'Ammo',
            tabBarIcon: ({ color }) => <Ionicons name="layers-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sessions"
          options={{
            title: 'Sessions',
            tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />,
          }}
        />
      </Tabs>
    </BiometricGate>
  );
}
```

---

## 3. Local SQLite Database (Offline-First)

All reads and writes go through SQLite first. The server is secondary.

### Schema Setup

```typescript
// db/schema.ts
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('guntrack.db');

export function initializeDatabase() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS firearms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      serial_number TEXT,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      caliber TEXT NOT NULL,
      type TEXT NOT NULL,
      action TEXT,
      date_purchased TEXT,
      purchase_price REAL,
      purchased_from TEXT,
      status TEXT DEFAULT 'active',
      sold_date TEXT,
      sold_price REAL,
      nickname TEXT,
      notes TEXT,
      photo_urls TEXT DEFAULT '[]',    -- JSON array stored as TEXT
      receipt_urls TEXT DEFAULT '[]',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,                  -- NULL = needs sync
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ammo_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      caliber TEXT NOT NULL,
      type TEXT,
      grain_weight INTEGER,
      rounds_on_hand INTEGER NOT NULL DEFAULT 0,
      rounds_purchased INTEGER NOT NULL DEFAULT 0,
      storage_location TEXT,
      date_purchased TEXT,
      purchase_price REAL,
      photo_url TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS shooting_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      firearm_id TEXT REFERENCES firearms(id),
      ammo_id TEXT REFERENCES ammo_inventory(id),
      date TEXT NOT NULL,
      caliber TEXT NOT NULL,
      rounds_fired INTEGER NOT NULL DEFAULT 0,
      activity_type TEXT,
      location_name TEXT,
      location_lat REAL,
      location_lng REAL,
      notes TEXT,
      target_photo_urls TEXT DEFAULT '[]',
      decremented_ammo INTEGER DEFAULT 0,   -- SQLite has no BOOLEAN
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      firearm_id TEXT REFERENCES firearms(id),
      maintenance_type TEXT NOT NULL,
      date TEXT NOT NULL,
      details TEXT,
      performed_by TEXT DEFAULT 'self',
      cost REAL,
      next_due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS malfunction_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      firearm_id TEXT REFERENCES firearms(id),
      ammo_id TEXT REFERENCES ammo_inventory(id),
      malfunction_type TEXT NOT NULL,
      date TEXT NOT NULL,
      details TEXT,
      resolved INTEGER DEFAULT 0,
      resolution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,          -- 'create' | 'update' | 'delete'
      entity_type TEXT NOT NULL,        -- 'firearms' | 'ammo' etc.
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,            -- JSON
      timestamp INTEGER NOT NULL,
      retries INTEGER DEFAULT 0,
      last_error TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_firearms_user ON firearms(user_id);
    CREATE INDEX IF NOT EXISTS idx_ammo_user ON ammo_inventory(user_id);
    CREATE INDEX IF NOT EXISTS idx_ammo_caliber ON ammo_inventory(caliber);
    CREATE INDEX IF NOT EXISTS idx_sessions_firearm ON shooting_sessions(firearm_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON shooting_sessions(date DESC);
    CREATE INDEX IF NOT EXISTS idx_maintenance_firearm ON maintenance_records(firearm_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp ASC);
  `);
}
```

### Database Migrations

```typescript
// db/migrations.ts
const MIGRATIONS: Record<number, string> = {
  1: `
    -- v1: initial schema (handled by initializeDatabase)
  `,
  2: `
    -- v2: add ffl_number to firearms
    ALTER TABLE firearms ADD COLUMN ffl_number TEXT;
  `,
  3: `
    -- v3: add grain_weight to sessions
    ALTER TABLE shooting_sessions ADD COLUMN grain_weight INTEGER;
    ALTER TABLE shooting_sessions ADD COLUMN bullet_type TEXT;
  `,
};

export function runMigrations() {
  // Store current schema version
  db.execSync(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO schema_version (version) VALUES (0);
  `);

  const result = db.getFirstSync<{ version: number }>(
    'SELECT version FROM schema_version'
  );
  let currentVersion = result?.version ?? 0;
  const targetVersion = Math.max(...Object.keys(MIGRATIONS).map(Number));

  while (currentVersion < targetVersion) {
    const nextVersion = currentVersion + 1;
    const migration = MIGRATIONS[nextVersion];
    if (migration?.trim()) {
      db.execSync(migration);
    }
    db.runSync('UPDATE schema_version SET version = ?', [nextVersion]);
    currentVersion = nextVersion;
  }
}
```

### Query Layer

```typescript
// db/queries/firearms.ts
import { db } from '../schema';
import { Firearm } from '@/types';
import { randomUUID } from 'expo-crypto';

export const firearmsDB = {

  getAll(userId: string): Firearm[] {
    const rows = db.getAllSync<any>(
      `SELECT * FROM firearms
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(parseFirearm);
  },

  getById(id: string): Firearm | null {
    const row = db.getFirstSync<any>(
      'SELECT * FROM firearms WHERE id = ?', [id]
    );
    return row ? parseFirearm(row) : null;
  },

  create(data: Omit<Firearm, 'id' | 'createdAt' | 'updatedAt'>): Firearm {
    const now = new Date().toISOString();
    const id = randomUUID();
    const firearm: Firearm = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    db.runSync(`
      INSERT INTO firearms (
        id, user_id, serial_number, manufacturer, model, caliber, type,
        action, date_purchased, purchase_price, purchased_from, status,
        nickname, notes, photo_urls, receipt_urls, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      firearm.id, firearm.userId, firearm.serialNumber ?? null,
      firearm.manufacturer, firearm.model, firearm.caliber, firearm.type,
      firearm.action ?? null, firearm.datePurchased ?? null,
      firearm.purchasePrice ?? null, firearm.purchasedFrom ?? null,
      firearm.status ?? 'active', firearm.nickname ?? null,
      firearm.notes ?? null,
      JSON.stringify(firearm.photoUrls ?? []),
      JSON.stringify(firearm.receiptUrls ?? []),
      now, now
    ]);

    // Queue for sync
    queueOperation('create', 'firearms', id, firearm);

    return firearm;
  },

  update(id: string, updates: Partial<Firearm>): void {
    const now = new Date().toISOString();
    // Build dynamic SET clause
    const fields = Object.keys(updates)
      .filter(k => !['id', 'userId', 'createdAt'].includes(k))
      .map(k => `${toSnakeCase(k)} = ?`);
    const values = Object.entries(updates)
      .filter(([k]) => !['id', 'userId', 'createdAt'].includes(k))
      .map(([, v]) => Array.isArray(v) ? JSON.stringify(v) : v);

    db.runSync(
      `UPDATE firearms SET ${fields.join(', ')}, updated_at = ?, version = version + 1
       WHERE id = ?`,
      [...values, now, id]
    );

    queueOperation('update', 'firearms', id, { id, ...updates });
  },

  softDelete(id: string): void {
    const now = new Date().toISOString();
    db.runSync(
      'UPDATE firearms SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    );
    queueOperation('delete', 'firearms', id, { id });
  },

  // Computed stats via SQL joins
  getStats(firearmsId: string) {
    return db.getFirstSync<{
      totalRoundsFired: number;
      sessionCount: number;
      lastShotDate: string | null;
      lastMaintenanceDate: string | null;
      malfunctionCount: number;
    }>(`
      SELECT
        COALESCE(SUM(ss.rounds_fired), 0) AS totalRoundsFired,
        COUNT(DISTINCT ss.id) AS sessionCount,
        MAX(ss.date) AS lastShotDate,
        MAX(mr.date) AS lastMaintenanceDate,
        COUNT(DISTINCT mal.id) AS malfunctionCount
      FROM firearms f
      LEFT JOIN shooting_sessions ss ON ss.firearm_id = f.id
      LEFT JOIN maintenance_records mr ON mr.firearm_id = f.id
      LEFT JOIN malfunction_records mal ON mal.firearm_id = f.id
      WHERE f.id = ?
    `, [firearmsId]);
  },
};

function parseFirearm(row: any): Firearm {
  return {
    ...row,
    photoUrls: JSON.parse(row.photo_urls ?? '[]'),
    receiptUrls: JSON.parse(row.receipt_urls ?? '[]'),
    purchasePrice: row.purchase_price,
    datePurchased: row.date_purchased,
    serialNumber: row.serial_number,
    // ... map all snake_case → camelCase
  };
}

function queueOperation(
  operation: string,
  entityType: string,
  entityId: string,
  payload: any
) {
  db.runSync(
    `INSERT INTO sync_queue (operation, entity_type, entity_id, payload, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [operation, entityType, entityId, JSON.stringify(payload), Date.now()]
  );
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}
```

---

## 4. Sync Engine (Mobile)

```typescript
// services/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import { db } from '@/db/schema';
import { supabase } from './supabase';
import { useAuthStore } from '@/store/authStore';
import { createContext, useContext, useEffect, useRef } from 'react';

const SYNC_BATCH_SIZE = 50;
const SYNC_INTERVAL_MS = 30_000;     // Sync every 30s when online
const MAX_RETRIES = 5;

class SyncEngine {
  private syncing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    // Sync on network reconnect
    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        this.flush();
      }
    });

    // Periodic sync
    this.intervalId = setInterval(() => this.flush(), SYNC_INTERVAL_MS);

    // Initial sync
    this.flush();
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async flush(): Promise<void> {
    if (this.syncing) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    this.syncing = true;
    try {
      await this.pushLocalChanges();
      await this.pullRemoteChanges();
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      this.syncing = false;
    }
  }

  // Push pending local operations to server
  private async pushLocalChanges() {
    const pending = db.getAllSync<any>(`
      SELECT * FROM sync_queue
      WHERE retries < ?
      ORDER BY timestamp ASC
      LIMIT ?
    `, [MAX_RETRIES, SYNC_BATCH_SIZE]);

    if (pending.length === 0) return;

    for (const op of pending) {
      try {
        await this.applyToServer(op);
        // Mark as synced — delete from queue
        db.runSync('DELETE FROM sync_queue WHERE id = ?', [op.id]);

        // Mark local record as synced
        const now = new Date().toISOString();
        db.runSync(
          `UPDATE ${op.entity_type} SET synced_at = ? WHERE id = ?`,
          [now, op.entity_id]
        );
      } catch (err: any) {
        // Increment retry count
        db.runSync(
          'UPDATE sync_queue SET retries = retries + 1, last_error = ? WHERE id = ?',
          [err.message, op.id]
        );
      }
    }
  }

  private async applyToServer(op: any) {
    const payload = JSON.parse(op.payload);
    const table = op.entity_type;

    if (op.operation === 'delete') {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', op.entity_id);
      if (error) throw error;
    } else {
      // Upsert handles both create and update
      const { error } = await supabase
        .from(table)
        .upsert(toSnakeCaseObject(payload), { onConflict: 'id' });
      if (error) throw error;
    }
  }

  // Pull changes from server (other devices)
  private async pullRemoteChanges() {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const lastSync = db.getFirstSync<{ ts: string }>(
      'SELECT MAX(synced_at) as ts FROM firearms WHERE user_id = ?',
      [userId]
    );
    const since = lastSync?.ts ?? '1970-01-01T00:00:00.000Z';

    const tables = [
      'firearms', 'ammo_inventory', 'shooting_sessions',
      'maintenance_records', 'malfunction_records'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', since);

      if (error || !data) continue;

      for (const row of data) {
        this.upsertLocal(table, row);
      }
    }
  }

  private upsertLocal(table: string, serverRow: any) {
    const localRow = db.getFirstSync<any>(
      `SELECT * FROM ${table} WHERE id = ?`, [serverRow.id]
    );

    if (!localRow) {
      // New record from another device — insert
      this.insertFromServer(table, serverRow);
      return;
    }

    // Conflict resolution: server wins if server version > local
    if (serverRow.version > localRow.version) {
      this.updateFromServer(table, serverRow);
    }
    // If local version is higher, it's already in sync_queue to push
  }

  private insertFromServer(table: string, row: any) {
    const columns = Object.keys(row).join(', ');
    const placeholders = Object.keys(row).map(() => '?').join(', ');
    const values = Object.values(row).map(v =>
      typeof v === 'object' && v !== null ? JSON.stringify(v) : v
    );
    db.runSync(
      `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`,
      values
    );
  }

  private updateFromServer(table: string, row: any) {
    const sets = Object.keys(row)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`).join(', ');
    const values = Object.entries(row)
      .filter(([k]) => k !== 'id')
      .map(([, v]) => typeof v === 'object' && v !== null ? JSON.stringify(v) : v);

    db.runSync(
      `UPDATE ${table} SET ${sets}, synced_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), row.id]
    );
  }
}

export const syncEngine = new SyncEngine();

// React context so components can trigger manual sync
const SyncContext = createContext<{ sync: () => void }>({ sync: () => {} });
export const SyncProvider = ({ children }) => {
  useEffect(() => {
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);
  return (
    <SyncContext.Provider value={{ sync: () => syncEngine.flush() }}>
      {children}
    </SyncContext.Provider>
  );
};
export const useSync = () => useContext(SyncContext);
```

---

## 5. Camera & Photo Picker

```typescript
// services/photoService.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { randomUUID } from 'expo-crypto';

type PhotoBucket = 'firearm-photos' | 'receipts' | 'targets' | 'accessories';

export const photoService = {

  // Pick from camera roll
  async pickFromLibrary(allowMultiple = false): Promise<string[]> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Photo library permission denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: allowMultiple,
      quality: 0.9,
      exif: false,               // Don't include location EXIF in photos
    });

    if (result.canceled) return [];
    return result.assets.map(a => a.uri);
  },

  // Take a new photo with camera
  async takePhoto(): Promise<string | null> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('Camera permission denied');

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      exif: false,
    });

    if (result.canceled) return null;
    return result.assets[0].uri;
  },

  // Compress + resize before upload
  async compress(uri: string, maxWidth = 1920): Promise<string> {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  },

  // Upload to Supabase Storage
  async upload(
    localUri: string,
    bucket: PhotoBucket,
    userId: string,
    entityId: string
  ): Promise<string> {
    // Compress first
    const compressed = await this.compress(localUri);

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(compressed, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const path = `${userId}/${entityId}/${randomUUID()}.jpg`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, decode(base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;
    return data.path;  // Store this path, not the full URL
  },

  // Get a 1-hour signed URL for display
  async getSignedUrl(bucket: PhotoBucket, path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  // Cache signed URLs locally (avoid re-fetching on every render)
  signedUrlCache: new Map<string, { url: string; expiresAt: number }>(),

  async getCachedSignedUrl(bucket: PhotoBucket, path: string): Promise<string> {
    const cacheKey = `${bucket}:${path}`;
    const cached = this.signedUrlCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.url;
    }

    const url = await this.getSignedUrl(bucket, path);
    this.signedUrlCache.set(cacheKey, {
      url,
      expiresAt: Date.now() + 3600_000,
    });
    return url;
  },
};

// Helper: decode base64 to Uint8Array for Supabase upload
function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// components/shared/PhotoPicker.tsx
import { View, TouchableOpacity, Image, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PhotoPickerProps {
  photos: string[];             // Array of local URIs or storage paths
  onAdd: (uris: string[]) => void;
  onRemove: (index: number) => void;
  maxPhotos?: number;
  bucket?: PhotoBucket;
}

export function PhotoPicker({ photos, onAdd, onRemove, maxPhotos = 5 }: PhotoPickerProps) {
  const handleAdd = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: async () => {
        const uri = await photoService.takePhoto();
        if (uri) onAdd([uri]);
      }},
      { text: 'Photo Library', onPress: async () => {
        const uris = await photoService.pickFromLibrary(maxPhotos - photos.length > 1);
        if (uris.length) onAdd(uris);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {photos.map((uri, i) => (
          <View key={i} style={styles.photoWrap}>
            <Image source={{ uri }} style={styles.photo} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(i)}>
              <Ionicons name="close-circle" size={20} color="white" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Ionicons name="camera-outline" size={24} color="#7a7a99" />
            <Text style={styles.addText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4 },
  addBtn: {
    width: 90, height: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a35',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: { fontSize: 11, color: '#7a7a99' },
});
```

---

## 6. Biometric Auth & App Lock

```typescript
// services/biometricService.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const biometricService = {

  async isAvailable(): Promise<{ available: boolean; type: string }> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const typeLabel = types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    ) ? 'Face ID' : types.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT
    ) ? 'Touch ID / Fingerprint' : 'Biometrics';

    return { available: hasHardware && isEnrolled, type: typeLabel };
  },

  async authenticate(reason?: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason ?? 'Authenticate to access your firearm records',
      fallbackLabel: 'Enter PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,  // Allow PIN fallback
    });
    return result.success;
  },

  // Store whether biometric lock is enabled
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync('biometric_enabled', enabled ? 'true' : 'false');
  },

  async isBiometricEnabled(): Promise<boolean> {
    const val = await SecureStore.getItemAsync('biometric_enabled');
    return val === 'true';
  },

  // Store encrypted user session token
  async storeSession(token: string): Promise<void> {
    await SecureStore.setItemAsync('session_token', token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getStoredSession(): Promise<string | null> {
    return SecureStore.getItemAsync('session_token');
  },

  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync('session_token');
  },
};

// components/shared/BiometricGate.tsx
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { biometricService } from '@/services/biometricService';

const LOCK_AFTER_BACKGROUND_MS = 5 * 60 * 1000;  // Lock after 5 min in background

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      const enabled = await biometricService.isBiometricEnabled();
      setBiometricEnabled(enabled);
      if (enabled) {
        setLocked(true);
        authenticate();
      }
    }
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        if (!biometricEnabled) return;
        const elapsed = backgroundedAt.current
          ? Date.now() - backgroundedAt.current
          : Infinity;
        if (elapsed >= LOCK_AFTER_BACKGROUND_MS) {
          setLocked(true);
          authenticate();
        }
      }
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  const authenticate = async () => {
    const success = await biometricService.authenticate();
    if (success) setLocked(false);
  };

  if (!locked) return <>{children}</>;

  return (
    <View style={styles.lock}>
      <Text style={styles.title}>🔒 GunTrack</Text>
      <Text style={styles.subtitle}>Your records are locked</Text>
      <TouchableOpacity style={styles.unlockBtn} onPress={authenticate}>
        <Text style={styles.unlockText}>Unlock with Biometrics</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1, backgroundColor: '#0f0f11',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#f0eff6' },
  subtitle: { fontSize: 15, color: '#7a7a99' },
  unlockBtn: {
    marginTop: 24, backgroundColor: '#7c6af7',
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 12,
  },
  unlockText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
```

---

## 7. Push Notifications (APNs + FCM)

### Setup & Token Registration

```typescript
// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior while app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {

  // Call once on login — registers device for push
  async registerForPushNotifications(userId: string): Promise<void> {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('guntrack-reminders', {
        name: 'GunTrack Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c6af7',
      });
    }

    // Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-eas-project-id',
    });

    // Save token to Supabase so server can send pushes
    await supabase
      .from('device_push_tokens')
      .upsert({
        user_id: userId,
        token: token.data,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'token' });
  },

  // Schedule a LOCAL notification (no server needed)
  async scheduleMaintenanceReminder(
    firearmsId: string,
    firearmsName: string,
    dueDate: Date
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔧 Maintenance Due',
        body: `${firearmsName} is due for cleaning/maintenance.`,
        data: { screen: 'maintenance', firearmsId },
        categoryIdentifier: 'maintenance',
      },
      trigger: {
        date: dueDate,
        channelId: 'guntrack-reminders',
      },
    });
    return id;
  },

  async scheduleLowAmmoAlert(
    caliber: string,
    roundsRemaining: number
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Low Ammo',
        body: `Only ${roundsRemaining} rounds of ${caliber} remaining.`,
        data: { screen: 'ammo' },
        categoryIdentifier: 'ammo',
      },
      trigger: { seconds: 1 },   // Immediate local notification
    });
    return id;
  },

  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  },

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  // Set up notification response handler (user taps notification)
  setupNotificationResponseHandler() {
    return Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Navigate to relevant screen
      if (data.screen === 'maintenance' && data.firearmsId) {
        router.push(`/firearms/${data.firearmsId}/maintenance`);
      } else if (data.screen === 'ammo') {
        router.push('/ammo');
      }
    });
  },
};

// Server-side: Send push via Expo Push API (Edge Function or cron)
// supabase/functions/send-reminders/index.ts
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendRemindersToUsers() {
  const { data: tokens } = await supabase
    .from('device_push_tokens')
    .select('user_id, token, platform');

  // Find users with upcoming maintenance due tomorrow
  const { data: upcoming } = await supabase.rpc('get_maintenance_due_tomorrow');

  const messages = upcoming.map(item => {
    const userToken = tokens.find(t => t.user_id === item.user_id);
    if (!userToken) return null;
    return {
      to: userToken.token,
      title: '🔧 Maintenance Due Tomorrow',
      body: `${item.firearm_name} — ${item.maintenance_type}`,
      data: { firearmsId: item.firearm_id },
      channelId: 'guntrack-reminders',
    };
  }).filter(Boolean);

  // Expo push API accepts batches of up to 100
  const chunks = chunk(messages, 100);
  for (const batch of chunks) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  }
}
```

---

## 8. Mobile UI Patterns

### Bottom Sheet (Add/Edit Forms)

```typescript
// components/shared/BottomSheet.tsx
import { forwardRef, useCallback } from 'react';
import BottomSheet, {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

export const AppBottomSheet = forwardRef<BottomSheetModal, {
  children: React.ReactNode;
  snapPoints?: string[];
}>(({ children, snapPoints = ['50%', '90%'] }, ref) => {

  const renderBackdrop = useCallback(props => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
  ), []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: '#18181c' }}
      handleIndicatorStyle={{ backgroundColor: '#4a4a60' }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
```

### Swipeable Row (Delete / Quick Actions)

```typescript
// components/shared/SwipeableRow.tsx
import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated from 'react-native-reanimated';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit?: () => void;
  deleteLabel?: string;
}

export function SwipeableRow({
  children, onDelete, onEdit, deleteLabel = 'Delete'
}: SwipeableRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    Alert.alert(
      'Confirm Delete',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeRef.current?.close() },
        { text: 'Delete', style: 'destructive', onPress: () => { onDelete(); swipeRef.current?.close(); } },
      ]
    );
  };

  const renderRightActions = (progress, dragX) => (
    <View style={styles.rightActions}>
      {onEdit && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => { onEdit(); swipeRef.current?.close(); }}
        >
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.actionBtn, styles.deleteBtn]}
        onPress={handleDelete}
      >
        <Text style={styles.actionText}>{deleteLabel}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} friction={2}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  rightActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    justifyContent: 'center', alignItems: 'center',
    width: 80, height: '100%', padding: 12,
  },
  editBtn: { backgroundColor: '#3b82f6' },
  deleteBtn: { backgroundColor: '#ef4444' },
  actionText: { color: 'white', fontSize: 13, fontWeight: '600' },
});
```

### Firearm List Item

```typescript
// components/firearms/FirearmCard.tsx
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Firearm } from '@/types';

interface FirearmCardProps {
  firearm: Firearm;
  stats?: { totalRoundsFired: number; lastShotDate: string | null };
}

export function FirearmCard({ firearm, stats }: FirearmCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/firearms/${firearm.id}`)}
      activeOpacity={0.7}
    >
      {/* Photo thumbnail */}
      <View style={styles.thumbnail}>
        {firearm.photoUrls[0] ? (
          <Image source={{ uri: firearm.photoUrls[0] }} style={styles.photo} />
        ) : (
          <Text style={styles.photoPlaceholder}>🔫</Text>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {firearm.nickname ?? `${firearm.manufacturer} ${firearm.model}`}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {firearm.manufacturer} {firearm.model}
        </Text>

        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{firearm.caliber}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{firearm.type}</Text>
          </View>
        </View>

        {stats && (
          <View style={styles.stats}>
            <Text style={styles.stat}>🎯 {stats.totalRoundsFired.toLocaleString()} rounds</Text>
            {stats.lastShotDate && (
              <Text style={styles.stat}>Last: {stats.lastShotDate}</Text>
            )}
          </View>
        )}
      </View>

      {/* Investment value */}
      {firearm.purchasePrice && (
        <View style={styles.value}>
          <Text style={styles.valueAmount}>
            ${firearm.purchasePrice.toFixed(0)}
          </Text>
          <Text style={styles.valueLabel}>value</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181c',
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  thumbnail: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: '#22222a',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { fontSize: 28 },
  content: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#f0eff6', marginBottom: 2 },
  sub: { fontSize: 12, color: '#7a7a99', marginBottom: 6 },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badge: {
    backgroundColor: '#22222a', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: '#7a7a99', fontFamily: 'monospace' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { fontSize: 11, color: '#4a4a60' },
  value: { alignItems: 'flex-end', marginLeft: 8 },
  valueAmount: { fontSize: 16, fontWeight: '700', color: '#22c55e' },
  valueLabel: { fontSize: 10, color: '#4a4a60' },
});
```

### Native Date/Time Pickers

```typescript
// components/shared/NativeDatePicker.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, Modal, View } from 'react-native';

interface NativeDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}

export function NativeDatePicker({
  value, onChange, placeholder = 'Select date', maximumDate, minimumDate
}: NativeDatePickerProps) {
  const [show, setShow] = useState(false);

  const handleChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(selected);
  };

  const formatted = value
    ? value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : placeholder;

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setShow(true)}>
        <Text style={[styles.text, !value && styles.placeholder]}>{formatted}</Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>

      {/* iOS: modal sheet */}
      {Platform.OS === 'ios' && show && (
        <Modal transparent animationType="slide">
          <View style={styles.iosModal}>
            <View style={styles.iosSheet}>
              <TouchableOpacity onPress={() => setShow(false)} style={styles.done}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
              <DateTimePicker
                value={value ?? new Date()}
                mode="date"
                display="spinner"
                onChange={handleChange}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                textColor="#f0eff6"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android: native dialog */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="default"
          onChange={handleChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#22222a', borderRadius: 8, borderWidth: 1,
    borderColor: '#2a2a35', padding: 12,
  },
  text: { fontSize: 14, color: '#f0eff6' },
  placeholder: { color: '#4a4a60' },
  icon: { fontSize: 16 },
  iosModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  iosSheet: { backgroundColor: '#18181c', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  done: { alignItems: 'flex-end', padding: 16 },
  doneText: { color: '#7c6af7', fontSize: 16, fontWeight: '600' },
});
```

---

## 9. Subscriptions with RevenueCat

```typescript
// services/subscriptionService.ts
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const ENTITLEMENT_PRO = 'pro';
const OFFERING_DEFAULT = 'default';

export const subscriptionService = {

  async initialize(userId: string): Promise<void> {
    const apiKey = Platform.OS === 'ios'
      ? Constants.expoConfig?.extra?.revenueCatApiKeyIOS
      : Constants.expoConfig?.extra?.revenueCatApiKeyAndroid;

    Purchases.configure({ apiKey });
    await Purchases.logIn(userId);  // Link to your user ID
  },

  async getOfferings(): Promise<PurchasesPackage[]> {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  },

  async isPro(customerInfo?: CustomerInfo): Promise<boolean> {
    const info = customerInfo ?? await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PRO] !== undefined;
  },

  async purchase(pkg: PurchasesPackage): Promise<{ success: boolean; error?: string }> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPro = await this.isPro(customerInfo);
      return { success: isPro };
    } catch (error: any) {
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { success: false, error: 'Purchase cancelled' };
      }
      return { success: false, error: error.message };
    }
  },

  async restore(): Promise<boolean> {
    const customerInfo = await Purchases.restorePurchases();
    return this.isPro(customerInfo);
  },
};

// components/shared/PaywallGate.tsx
// Wrap premium features with this component
import { useSubscription } from '@/hooks/useSubscription';
import { router } from 'expo-router';

export function PaywallGate({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: string;
}) {
  const { isPro } = useSubscription();

  if (isPro) return <>{children}</>;

  return (
    <TouchableOpacity
      style={styles.gate}
      onPress={() => router.push('/settings/subscription')}
    >
      <Text style={styles.icon}>⭐</Text>
      <Text style={styles.title}>Pro Feature</Text>
      <Text style={styles.sub}>{feature} requires GunTrack Pro</Text>
      <Text style={styles.cta}>Upgrade Now →</Text>
    </TouchableOpacity>
  );
}

// Free tier limits
export const FREE_TIER_LIMITS = {
  maxFirearms: 3,
  maxAmmoLots: 10,
  pdfExport: false,
  csvExport: false,
  advancedStats: false,
  maintenanceReminders: false,
};
```

---

## 10. EAS Build & OTA Updates

### eas.json

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": { "APP_ENV": "staging" }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Build & Deploy Commands

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Initial setup (first time)
eas build:configure

# Development build (use with Expo Go replacement)
eas build --platform ios --profile development
eas build --platform android --profile development

# Preview build for internal testing
eas build --platform all --profile preview

# Production build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores (after production build)
eas submit --platform ios --profile production
eas submit --platform android --profile production

# OTA update (no new build needed for JS changes)
eas update --branch production --message "Fix ammo decrement bug"

# Set secrets (for CI — never hardcode)
eas secret:create --scope project --name SUPABASE_SERVICE_ROLE_KEY --value "your-key"
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/eas-build.yml
name: EAS Production Build

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install dependencies
        run: npm ci

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Set EAS secrets
        run: |
          eas secret:push --scope project --env-file .env.production
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}

      - name: Build iOS
        run: eas build --platform ios --profile production --non-interactive

      - name: Build Android
        run: eas build --platform android --profile production --non-interactive

      - name: Submit to stores
        run: eas submit --platform all --profile production --non-interactive
```

---

## 11. App Store & Google Play Submission

### Apple App Store Checklist

```
PRE-SUBMISSION:
✅ App icon: 1024x1024 PNG, no alpha channel, no rounded corners (Apple adds them)
✅ Screenshots: 6.9" iPhone (1320x2868), 6.5" iPhone (1242x2688), iPad Pro 12.9" if tablet support
✅ App preview video: optional but boosts conversion (30 seconds max)
✅ Privacy policy URL: must be live and accessible
✅ Age rating: 17+ (Frequent/Intense Realistic Violence is correct for firearm-adjacent apps)
✅ App category: Utilities (primary), Lifestyle (secondary)
✅ Keywords: firearm tracker, gun inventory, ammo tracker, shooting log (max 100 chars)

INFO.PLIST REQUIREMENTS:
✅ NSCameraUsageDescription — required if using camera
✅ NSPhotoLibraryUsageDescription — required if reading photo library
✅ NSFaceIDUsageDescription — required if using Face ID
✅ NSLocationWhenInUseUsageDescription — if logging GPS at range

APP REVIEW NOTES (write this in the "Notes for Review" field):
  "This app is a personal record-keeping tool for legal firearm owners.
   It does NOT facilitate the purchase, sale, or transfer of firearms.
   It does NOT display weapons for sale or promote weapon use.
   All data is stored securely and encrypted. The app requires users
   to acknowledge they are the legal owner of any firearms they record."

COMMON REJECTION REASONS TO AVOID:
❌ Any in-app purchase of firearms or ammunition
❌ Any content that depicts illegal weapon modifications
❌ Missing permission usage descriptions
❌ Crashes on review device (test on oldest supported iOS version)
❌ Broken demo account (provide one in review notes if auth is required)
```

### Google Play Checklist

```
PRE-SUBMISSION:
✅ App icon: 512x512 PNG
✅ Feature graphic: 1024x500 PNG
✅ Screenshots: phone (min 2), tablet (recommended)
✅ Privacy policy URL: live and accessible
✅ Data safety form: complete accurately
   - Collected: email, user content (firearm records), photos
   - Shared: none
   - Security: data encrypted in transit and at rest

CONTENT RATING:
  Complete IARC questionnaire honestly:
  - Violence: NONE (no violence depicted in this app)
  - Weapons: YES — app facilitates legal ownership of firearms
  Expected rating: Teen (13+) or Mature (17+)

SENSITIVE PERMISSIONS:
✅ CAMERA — justified by photo capture feature
✅ READ/WRITE_EXTERNAL_STORAGE — justified by photo upload
✅ ACCESS_FINE_LOCATION — justified by range location logging (mark as optional)

DATA SAFETY SECTION (fill in Google Play Console):
  Data collected:
    - Personal info: email address (required, encrypted)
    - Photos and videos: firearm/target photos (optional, encrypted)
    - App activity: shooting sessions, maintenance records (required for core functionality)
  Data NOT collected:
    - Financial info (purchase prices stored locally, not sent to ad networks)
    - Location (only if user opts in)
  Data shared with third parties: NONE
  Data encrypted in transit: YES
  Users can request data deletion: YES (account deletion in settings)
```

---

## 12. Mobile Performance

### FlashList for Large Inventories

```typescript
// Use FlashList instead of FlatList for large collections
import { FlashList } from '@shopify/flash-list';
import { FirearmCard } from '@/components/firearms/FirearmCard';

function FirearmListScreen() {
  const firearms = useFirearmsStore(s => s.getAll());

  return (
    <FlashList
      data={firearms}
      renderItem={({ item }) => <FirearmCard firearm={item} />}
      estimatedItemSize={90}        // Critical for FlashList performance
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={<EmptyState message="No firearms added yet" />}
    />
  );
}
```

### Image Caching

```typescript
// Use expo-image instead of React Native's Image for automatic caching
import { Image } from 'expo-image';

// expo-image caches aggressively and handles blurhash placeholders
<Image
  source={{ uri: signedUrl }}
  style={styles.photo}
  contentFit="cover"
  placeholder={blurhash}             // Show while loading
  cachePolicy="memory-disk"          // Aggressive caching
  recyclingKey={storagePath}         // Stable key for cache hits
  transition={200}
/>
```

### SQLite Query Performance

```typescript
// ALWAYS run heavy queries off the main thread using transactions
// Bad: synchronous query blocking UI
const firearms = db.getAllSync('SELECT * FROM firearms');

// Good: use in a background thread via async wrapper
// expo-sqlite v14+ supports runAsync
const firearms = await db.getAllAsync(
  'SELECT * FROM firearms WHERE user_id = ? AND deleted_at IS NULL',
  [userId]
);

// For dashboard aggregations, use a single SQL query instead of JS reduction
const summary = await db.getFirstAsync(`
  SELECT
    COUNT(DISTINCT f.id) AS total_firearms,
    COALESCE(SUM(ss.rounds_fired), 0) AS total_rounds_fired,
    COALESCE(SUM(f.purchase_price), 0) AS total_firearms_value,
    COALESCE(SUM(acc.purchase_price), 0) AS total_accessories_value,
    COALESCE(SUM(a.rounds_on_hand * (a.purchase_price / NULLIF(a.rounds_purchased, 0))), 0) AS ammo_value
  FROM firearms f
  LEFT JOIN shooting_sessions ss ON ss.firearm_id = f.id
  LEFT JOIN accessories acc ON acc.firearm_id = f.id
  LEFT JOIN ammo_inventory a ON a.user_id = f.user_id AND a.deleted_at IS NULL
  WHERE f.user_id = ? AND f.deleted_at IS NULL
`, [userId]);
```

### Bundle Size Tips

```bash
# Analyze your bundle
npx expo export --platform ios
npx npx bundle-buddy dist/

# Heavy packages to watch:
# - react-native-purchases: ~4MB (only load on subscription screen)
# - react-native-html-to-pdf: lazy-load on export action
# - expo-camera: only initialize when needed (don't import at root)

# Use dynamic imports for heavy screens
const ExportScreen = React.lazy(() => import('@/app/(app)/settings/export'));
```

---

## 13. Full Mobile Tech Stack & Scripts

### Complete Dependencies

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-sqlite": "~14.0.0",
    "expo-camera": "~15.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-image-manipulator": "~12.0.0",
    "expo-local-authentication": "~14.0.0",
    "expo-notifications": "~0.28.0",
    "expo-secure-store": "~13.0.0",
    "expo-file-system": "~17.0.0",
    "expo-sharing": "~12.0.0",
    "expo-updates": "~0.25.0",
    "expo-image": "~1.12.0",
    "expo-crypto": "~13.0.0",
    "expo-device": "~6.0.0",

    "@supabase/supabase-js": "^2.0.0",
    "react-native-purchases": "^8.0.0",

    "zustand": "^4.5.0",
    "immer": "^10.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.0",

    "react-native-reanimated": "~3.10.0",
    "react-native-gesture-handler": "~2.16.0",
    "@gorhom/bottom-sheet": "^4.6.0",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "~3.31.0",
    "@shopify/flash-list": "^1.6.0",

    "@expo/vector-icons": "^14.0.0",
    "@react-native-community/datetimepicker": "~8.0.0",
    "@react-native-community/netinfo": "~11.3.0",

    "date-fns": "^3.3.0",
    "react-native-html-to-pdf": "^0.12.0"
  },
  "devDependencies": {
    "@types/react": "~18.2.0",
    "typescript": "^5.3.0",
    "jest": "^29.0.0",
    "@testing-library/react-native": "^12.0.0",
    "detox": "^20.0.0"
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",

    "build:dev:ios": "eas build --platform ios --profile development",
    "build:dev:android": "eas build --platform android --profile development",
    "build:preview": "eas build --platform all --profile preview",
    "build:production": "eas build --platform all --profile production",

    "submit:ios": "eas submit --platform ios --profile production",
    "submit:android": "eas submit --platform android --profile production",

    "update": "eas update --branch production",
    "update:preview": "eas update --branch preview",

    "type-check": "tsc --noEmit",
    "lint": "expo lint",
    "test": "jest --watchAll",
    "test:e2e": "detox test --configuration ios.sim.debug",

    "db:reset": "node scripts/reset-local-db.js",
    "generate-types": "supabase gen types typescript --local > types/database.ts"
  }
}
```

### Quick Reference: Key Expo APIs

| Feature | Package | Key API |
|---------|---------|---------|
| SQLite storage | expo-sqlite | `SQLite.openDatabaseSync()` |
| Camera / photos | expo-camera, expo-image-picker | `launchCameraAsync()`, `launchImageLibraryAsync()` |
| Biometric auth | expo-local-authentication | `authenticateAsync()` |
| Push notifications | expo-notifications | `scheduleNotificationAsync()`, `getExpoPushTokenAsync()` |
| Secure token storage | expo-secure-store | `setItemAsync()`, `getItemAsync()` |
| File system | expo-file-system | `readAsStringAsync()`, `downloadAsync()` |
| Share/export | expo-sharing | `shareAsync()` |
| OTA updates | expo-updates | `checkForUpdateAsync()`, `fetchUpdateAsync()` |
| Network state | @react-native-community/netinfo | `NetInfo.addEventListener()` |
| PDF generation | react-native-html-to-pdf | `convert({ html, fileName })` |
| Image caching | expo-image | `<Image cachePolicy="memory-disk" />` |
| Subscriptions | react-native-purchases | `Purchases.purchasePackage()` |

---

*Mobile supplement complete. Use alongside the main GunTrack build guide.*
*All code targets Expo SDK 51 / React Native 0.74. Check Expo changelog for SDK updates.*
