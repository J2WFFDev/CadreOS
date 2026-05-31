# 🔫 GunTrack-Like Firearm Inventory App — Complete Build Guide

> A fully detailed technical blueprint for building a secure, cross-platform firearm inventory, ammo tracking, maintenance logging, and shooting records application modelled on web.guntrack.app.

---

## Table of Contents

1. [App Overview & Feature Map](#1-app-overview--feature-map)
2. [Data Model & Schema](#2-data-model--schema)
3. [Security Architecture](#3-security-architecture)
4. [Ammo Tracking System](#4-ammo-tracking-system)
5. [Shooting Session Logging](#5-shooting-session-logging)
6. [Maintenance & Malfunction Tracking](#6-maintenance--malfunction-tracking)
7. [Investment & Valuation Engine](#7-investment--valuation-engine)
8. [Photo & Receipt Storage](#8-photo--receipt-storage)
9. [Backend Architecture](#9-backend-architecture)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Offline-First & Sync](#11-offline-first--sync)
12. [Export & Insurance Reports](#12-export--insurance-reports)
13. [Compliance & Legal Considerations](#13-compliance--legal-considerations)
14. [Full Build Roadmap & Tech Stack](#14-full-build-roadmap--tech-stack)

---

## 1. App Overview & Feature Map

GunTrack is a **secure, cross-platform firearm management platform**. Every feature connects back to one of five core record types:

```
USER
 ├── FIREARMS (inventory)
 │    ├── Accessories
 │    ├── Receipts / Photos
 │    └── Computed stats (rounds fired, total investment, last cleaned)
 ├── AMMO (inventory)
 │    └── Real-time count decremented on shooting events
 ├── SHOOTING SESSIONS
 │    ├── Links to firearm + ammo
 │    ├── Rounds fired (decrements ammo)
 │    └── Target / location photos
 ├── MAINTENANCE RECORDS
 │    └── Links to firearm, type, date, notes
 └── MALFUNCTIONS
      └── Links to firearm + ammo, type, date, notes
```

### Feature Checklist

| Module | Features |
|--------|----------|
| Firearm Records | Serial number, make, model, caliber, type, purchase date/price, photos, receipts, rounds fired lifetime, last shot date, last maintenance date |
| Accessories | Linked to parent firearm, manufacturer, purchase date/price, photos |
| Ammo Inventory | Caliber, brand, type, round count, purchase price, location tag, real-time decrement |
| Shooting Sessions | Date, range/location, firearm used, ammo used, rounds fired, activity type, target photos, notes |
| Maintenance | Firearm, maintenance type (clean/oil/zero/repair), date, details, next due reminder |
| Malfunctions | Firearm, ammo, malfunction type, date, details |
| Investment Dashboard | Per-firearm cost + accessories, total collection value, ammo value |
| Reports / Export | PDF per firearm, full CSV export, insurance-ready summary |
| Security | AES-256 encryption at rest, SSL in transit, biometric/PIN lock |

---

## 2. Data Model & Schema

### TypeScript Interfaces

```typescript
// ─── FIREARM ───────────────────────────────────────────────────────────────
interface Firearm {
  id: string;                   // UUID
  userId: string;

  // Identity
  serialNumber: string;
  manufacturer: string;
  model: string;
  caliber: string;              // e.g. "9mm", ".308 Win"
  type: FirearmType;
  action?: string;              // Semi-auto, bolt, revolver, pump, lever
  barrelLength?: number;        // inches
  overallLength?: number;
  weight?: number;              // oz

  // Purchase
  datePurchased?: string;       // ISO date
  purchasePrice?: number;
  purchasedFrom?: string;       // Dealer / private party
  fflNumber?: string;           // FFL dealer number

  // Status
  status: 'active' | 'sold' | 'transferred' | 'lost' | 'stolen';
  soldDate?: string;
  soldPrice?: number;
  soldTo?: string;

  // Notes
  notes?: string;
  nickname?: string;

  // Computed (derived, not stored)
  totalRoundsFired?: number;    // Sum of shooting sessions
  totalInvestment?: number;     // purchasePrice + accessories
  lastShotDate?: string;
  lastMaintenanceDate?: string;
  malfunctionCount?: number;

  // Media
  photoUrls: string[];
  receiptUrls: string[];

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;           // Soft delete
}

type FirearmType =
  | 'handgun'  | 'rifle'    | 'shotgun'
  | 'suppressor' | 'sbr'    | 'sbs'
  | 'machinegun' | 'other';

// ─── ACCESSORY ─────────────────────────────────────────────────────────────
interface Accessory {
  id: string;
  userId: string;
  firearmsId: string;           // Linked to parent firearm

  name: string;                 // "Vortex Viper Red Dot"
  manufacturer?: string;
  category: AccessoryCategory;
  datePurchased?: string;
  purchasePrice?: number;
  notes?: string;
  photoUrls: string[];
  receiptUrls: string[];

  createdAt: string;
  updatedAt: string;
}

type AccessoryCategory =
  | 'optic' | 'light' | 'suppressor' | 'stock'
  | 'grip' | 'trigger' | 'magazine' | 'sling'
  | 'holster' | 'bipod' | 'handguard' | 'barrel'
  | 'other';

// ─── AMMO ──────────────────────────────────────────────────────────────────
interface AmmoInventory {
  id: string;
  userId: string;

  manufacturer: string;
  brand?: string;               // e.g. "Federal Premium"
  caliber: string;              // Must match firearm caliber for linking
  type: AmmoType;
  grainWeight?: number;         // e.g. 124
  bulletType?: string;          // FMJ, JHP, SP, etc.

  // Inventory
  roundsOnHand: number;         // Real-time count
  roundsPurchased: number;      // Total ever purchased
  roundsExpended: number;       // Total ever shot (derived)
  storageLocation?: string;     // "Bin 3", "Gun safe", etc.

  // Purchase
  datePurchased?: string;
  purchasePrice?: number;       // Total paid for this lot
  pricePerRound?: number;       // Computed: purchasePrice / roundsPurchased
  purchasedFrom?: string;

  photoUrl?: string;

  createdAt: string;
  updatedAt: string;
}

type AmmoType = 'fmj' | 'jhp' | 'sp' | 'hollow_point' | 'match'
  | 'subsonic' | 'tracer' | 'frangible' | 'buckshot' | 'slug'
  | 'birdshot' | 'other';

// ─── SHOOTING SESSION ──────────────────────────────────────────────────────
interface ShootingSession {
  id: string;
  userId: string;

  date: string;
  firearmsId: string;
  ammoId?: string;              // Optional: "Other" allowed
  caliber: string;
  roundsFired: number;

  activityType: ShootingActivity;
  locationName?: string;        // "Eagle Peak Shooting Range"
  locationCoords?: { lat: number; lng: number };

  notes?: string;
  targetPhotoUrls: string[];
  locationPhotoUrls: string[];

  // Did this decrement ammo inventory?
  decrementedAmmo: boolean;

  createdAt: string;
  updatedAt: string;
}

type ShootingActivity =
  | 'range_practice' | 'competition' | 'hunting'
  | 'self_defense_training' | 'zeroing' | 'function_test'
  | 'other';

// ─── MAINTENANCE ───────────────────────────────────────────────────────────
interface MaintenanceRecord {
  id: string;
  userId: string;
  firearmsId: string;

  maintenanceType: MaintenanceType;
  date: string;
  details?: string;
  performedBy?: 'self' | 'gunsmith';
  gunsmithName?: string;
  cost?: number;
  nextDueDate?: string;         // For reminders
  roundsSinceLastMaintenance?: number; // Computed

  createdAt: string;
  updatedAt: string;
}

type MaintenanceType =
  | 'clean' | 'oil' | 'clean_and_oil'
  | 'inspect' | 'repair' | 'zero_optic'
  | 'parts_replacement' | 'professional_service' | 'other';

// ─── MALFUNCTION ───────────────────────────────────────────────────────────
interface MalfunctionRecord {
  id: string;
  userId: string;
  firearmsId: string;
  ammoId?: string;

  malfunctionType: MalfunctionType;
  date: string;
  details?: string;
  roundsAtMalfunction?: number; // Total rounds on firearm when it happened
  resolved: boolean;
  resolution?: string;

  createdAt: string;
  updatedAt: string;
}

type MalfunctionType =
  | 'failure_to_feed' | 'failure_to_fire' | 'failure_to_eject'
  | 'stovepipe' | 'double_feed' | 'squib'
  | 'slam_fire' | 'broken_part' | 'other';
```

### PostgreSQL Schema

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS (Supabase Auth handles this, but extend it)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',  -- 'free' | 'pro'
  subscription_expires_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FIREARMS
CREATE TABLE firearms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  serial_number TEXT,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  caliber TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT,
  barrel_length NUMERIC(5,2),
  overall_length NUMERIC(5,2),
  weight_oz NUMERIC(6,2),
  date_purchased DATE,
  purchase_price NUMERIC(10,2),
  purchased_from TEXT,
  ffl_number TEXT,
  status TEXT DEFAULT 'active',
  sold_date DATE,
  sold_price NUMERIC(10,2),
  sold_to TEXT,
  nickname TEXT,
  notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  receipt_urls TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_firearms_user_id ON firearms(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_firearms_caliber ON firearms(caliber);

-- ACCESSORIES
CREATE TABLE accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firearm_id UUID REFERENCES firearms(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  manufacturer TEXT,
  category TEXT,
  date_purchased DATE,
  purchase_price NUMERIC(10,2),
  notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  receipt_urls TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_accessories_firearm_id ON accessories(firearm_id);

-- AMMO INVENTORY
CREATE TABLE ammo_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  manufacturer TEXT NOT NULL,
  brand TEXT,
  caliber TEXT NOT NULL,
  type TEXT,
  grain_weight INTEGER,
  bullet_type TEXT,
  rounds_on_hand INTEGER NOT NULL DEFAULT 0,
  rounds_purchased INTEGER NOT NULL DEFAULT 0,
  storage_location TEXT,
  date_purchased DATE,
  purchase_price NUMERIC(10,2),
  purchased_from TEXT,
  photo_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rounds_non_negative CHECK (rounds_on_hand >= 0)
);
CREATE INDEX idx_ammo_user_id ON ammo_inventory(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ammo_caliber ON ammo_inventory(caliber);

-- SHOOTING SESSIONS
CREATE TABLE shooting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firearm_id UUID REFERENCES firearms(id) ON DELETE SET NULL,
  ammo_id UUID REFERENCES ammo_inventory(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  caliber TEXT NOT NULL,
  rounds_fired INTEGER NOT NULL DEFAULT 0,
  activity_type TEXT,
  location_name TEXT,
  location_lat NUMERIC(10,6),
  location_lng NUMERIC(10,6),
  notes TEXT,
  target_photo_urls TEXT[] DEFAULT '{}',
  location_photo_urls TEXT[] DEFAULT '{}',
  decremented_ammo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id ON shooting_sessions(user_id);
CREATE INDEX idx_sessions_firearm_id ON shooting_sessions(firearm_id);
CREATE INDEX idx_sessions_date ON shooting_sessions(date DESC);

-- MAINTENANCE RECORDS
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firearm_id UUID REFERENCES firearms(id) ON DELETE CASCADE NOT NULL,
  maintenance_type TEXT NOT NULL,
  date DATE NOT NULL,
  details TEXT,
  performed_by TEXT DEFAULT 'self',
  gunsmith_name TEXT,
  cost NUMERIC(10,2),
  next_due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_maintenance_firearm_id ON maintenance_records(firearm_id);
CREATE INDEX idx_maintenance_next_due ON maintenance_records(next_due_date)
  WHERE next_due_date IS NOT NULL;

-- MALFUNCTION RECORDS
CREATE TABLE malfunction_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firearm_id UUID REFERENCES firearms(id) ON DELETE CASCADE NOT NULL,
  ammo_id UUID REFERENCES ammo_inventory(id) ON DELETE SET NULL,
  malfunction_type TEXT NOT NULL,
  date DATE NOT NULL,
  details TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_malfunctions_firearm_id ON malfunction_records(firearm_id);

-- USEFUL VIEWS
-- Per-firearm computed stats (use as a view or materialized view)
CREATE VIEW firearm_stats AS
SELECT
  f.id AS firearm_id,
  f.user_id,
  COALESCE(SUM(ss.rounds_fired), 0) AS total_rounds_fired,
  MAX(ss.date) AS last_shot_date,
  MAX(mr.date) AS last_maintenance_date,
  COUNT(DISTINCT mal.id) AS malfunction_count,
  f.purchase_price + COALESCE(SUM(acc.purchase_price), 0) AS total_investment
FROM firearms f
LEFT JOIN shooting_sessions ss ON ss.firearm_id = f.id
LEFT JOIN maintenance_records mr ON mr.firearm_id = f.id
LEFT JOIN malfunction_records mal ON mal.firearm_id = f.id
LEFT JOIN accessories acc ON acc.firearm_id = f.id
WHERE f.deleted_at IS NULL
GROUP BY f.id, f.user_id, f.purchase_price;
```

---

## 3. Security Architecture

Security is the **#1 concern** for this type of app. Users store serial numbers, purchase receipts, and location data. Here's how to do it right.

### Encryption Strategy

```
Data in Transit:  TLS 1.3 (HTTPS everywhere)
Data at Rest:     AES-256-GCM (database + file storage)
Client-side:      Encrypt sensitive fields before sending (optional E2E)
Auth tokens:      Short-lived JWTs (15 min) + refresh tokens (30 days)
Biometric:        Face ID / Touch ID on mobile via device secure enclave
```

### Row-Level Security (Supabase RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE firearms ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ammo_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE shooting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE malfunction_records ENABLE ROW LEVEL SECURITY;

-- Users can ONLY see their own data
CREATE POLICY "own_firearms" ON firearms
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_accessories" ON accessories
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_ammo" ON ammo_inventory
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_sessions" ON shooting_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_maintenance" ON maintenance_records
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_malfunctions" ON malfunction_records
  FOR ALL USING (user_id = auth.uid());
```

### Client-Side Security Implementation

```typescript
// security/encryption.ts
import { AES, enc, lib } from 'crypto-js';

const ENCRYPTION_VERSION = 1;

export class EncryptionService {
  private key: string;

  constructor(userPassword: string, salt: string) {
    // Derive key from password using PBKDF2
    this.key = this.deriveKey(userPassword, salt);
  }

  private deriveKey(password: string, salt: string): string {
    // 100,000 iterations of PBKDF2-SHA256
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });
    return key.toString();
  }

  encrypt(plaintext: string): string {
    const iv = lib.WordArray.random(16);
    const encrypted = AES.encrypt(plaintext, this.key, { iv });
    return `v${ENCRYPTION_VERSION}:${iv.toString()}:${encrypted.toString()}`;
  }

  decrypt(ciphertext: string): string {
    const [version, ivHex, data] = ciphertext.split(':');
    const iv = enc.Hex.parse(ivHex);
    const decrypted = AES.decrypt(data, this.key, { iv });
    return decrypted.toString(enc.Utf8);
  }
}

// Sensitive fields to encrypt before storing
// (extra layer on top of database encryption)
const SENSITIVE_FIELDS = ['serialNumber', 'fflNumber', 'purchasedFrom', 'soldTo'];

export function encryptFirearm(firearm: Firearm, enc: EncryptionService): Firearm {
  const result = { ...firearm };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field]) result[field] = enc.encrypt(result[field]);
  }
  return result;
}

// auth/biometric.ts — React Native
import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateWithBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access your firearm records',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  return result.success;
}
```

### Security Checklist

```
✅ HTTPS / TLS 1.3 everywhere
✅ AES-256 encryption at rest (Supabase handles DB encryption)
✅ Row-Level Security — users can NEVER access other users' data
✅ Short-lived auth tokens with secure refresh
✅ Biometric / PIN lock on mobile app
✅ No sensitive data in logs or error messages
✅ Serial numbers stored encrypted
✅ Photo URLs signed (time-limited, not public)
✅ Rate limiting on auth endpoints
✅ No firearm data in app analytics events
✅ GDPR-compliant data deletion (cascade deletes)
✅ Privacy policy explicitly covering firearm data
```

---

## 4. Ammo Tracking System

The ammo tracker is the most operationally critical module — it needs real-time accuracy.

### Ammo Count Logic

```typescript
// ammo/ammoService.ts

export class AmmoService {

  // Add a new ammo purchase lot
  async addAmmoPurchase(data: {
    userId: string;
    caliber: string;
    manufacturer: string;
    roundsPurchased: number;
    purchasePrice: number;
    storageLocation?: string;
  }): Promise<AmmoInventory> {
    return db.ammo_inventory.create({
      ...data,
      roundsOnHand: data.roundsPurchased,
      pricePerRound: data.purchasePrice / data.roundsPurchased,
    });
  }

  // Called when a shooting session is logged
  async decrementAmmo(ammoId: string, roundsExpended: number): Promise<void> {
    const ammo = await db.ammo_inventory.findById(ammoId);
    if (!ammo) throw new Error('Ammo not found');
    if (ammo.roundsOnHand < roundsExpended) {
      throw new Error(`Not enough rounds. Have ${ammo.roundsOnHand}, need ${roundsExpended}`);
    }

    await db.ammo_inventory.update(ammoId, {
      roundsOnHand: ammo.roundsOnHand - roundsExpended,
      updatedAt: new Date().toISOString(),
    });
  }

  // Undo a decrement if user deletes a shooting session
  async incrementAmmo(ammoId: string, roundsToRestore: number): Promise<void> {
    await db.ammo_inventory.increment(ammoId, 'roundsOnHand', roundsToRestore);
  }

  // Get ammo compatible with a specific firearm
  async getCompatibleAmmo(firearmsId: string): Promise<AmmoInventory[]> {
    const firearm = await db.firearms.findById(firearmsId);
    return db.ammo_inventory.findAll({
      userId: firearm.userId,
      caliber: firearm.caliber,
      roundsOnHand: { gt: 0 },
    });
  }

  // Summary: total ammo value across all inventory
  async getTotalAmmoValue(userId: string): Promise<number> {
    const inventory = await db.ammo_inventory.findAll({ userId });
    return inventory.reduce((sum, lot) => {
      return sum + (lot.roundsOnHand * (lot.pricePerRound || 0));
    }, 0);
  }

  // Low ammo alert: returns lots below threshold
  async getLowAmmoAlerts(userId: string, thresholdRounds = 50): Promise<AmmoInventory[]> {
    const inventory = await db.ammo_inventory.findAll({ userId });
    return inventory.filter(lot => lot.roundsOnHand < thresholdRounds && lot.roundsOnHand > 0);
  }
}
```

### Ammo Dashboard Queries

```sql
-- Total ammo value per caliber
SELECT
  caliber,
  SUM(rounds_on_hand) AS total_rounds,
  SUM(rounds_on_hand * COALESCE(purchase_price / NULLIF(rounds_purchased, 0), 0)) AS total_value
FROM ammo_inventory
WHERE user_id = $1 AND deleted_at IS NULL
GROUP BY caliber
ORDER BY total_value DESC;

-- All-time rounds expended per caliber
SELECT
  ss.caliber,
  SUM(ss.rounds_fired) AS total_expended
FROM shooting_sessions ss
WHERE ss.user_id = $1
GROUP BY ss.caliber;

-- Ammo burn rate (rounds/month last 6 months)
SELECT
  DATE_TRUNC('month', date) AS month,
  caliber,
  SUM(rounds_fired) AS rounds_used
FROM shooting_sessions
WHERE user_id = $1
  AND date >= NOW() - INTERVAL '6 months'
GROUP BY month, caliber
ORDER BY month;
```

---

## 5. Shooting Session Logging

### Session Service

```typescript
// sessions/sessionService.ts

export class ShootingSessionService {

  async logSession(data: {
    userId: string;
    firearmsId: string;
    ammoId?: string;
    date: string;
    roundsFired: number;
    activityType: ShootingActivity;
    decrementAmmo: boolean;
    locationName?: string;
    notes?: string;
    targetPhotos?: File[];
  }): Promise<ShootingSession> {

    // Validate firearm belongs to user
    const firearm = await this.validateOwnership(data.firearmsId, data.userId);

    // Get caliber from firearm if not provided
    const caliber = firearm.caliber;

    // Decrement ammo if requested
    if (data.decrementAmmo && data.ammoId) {
      await ammoService.decrementAmmo(data.ammoId, data.roundsFired);
    }

    // Upload target photos
    const targetPhotoUrls = data.targetPhotos
      ? await Promise.all(data.targetPhotos.map(f => photoService.upload(f, 'targets')))
      : [];

    const session = await db.shooting_sessions.create({
      userId: data.userId,
      firearmsId: data.firearmsId,
      ammoId: data.ammoId || null,
      date: data.date,
      caliber,
      roundsFired: data.roundsFired,
      activityType: data.activityType,
      locationName: data.locationName,
      notes: data.notes,
      targetPhotoUrls,
      decrementedAmmo: data.decrementAmmo && !!data.ammoId,
    });

    return session;
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await db.shooting_sessions.findById(sessionId);
    if (session.userId !== userId) throw new Error('Unauthorized');

    // Restore ammo if it was decremented
    if (session.decrementedAmmo && session.ammoId) {
      await ammoService.incrementAmmo(session.ammoId, session.roundsFired);
    }

    await db.shooting_sessions.delete(sessionId);
  }

  // Get shooting history for a firearm
  async getFirearmHistory(firearmsId: string): Promise<{
    sessions: ShootingSession[];
    totalRoundsFired: number;
    sessionCount: number;
    lastShotDate: string | null;
    favoriteActivity: string;
  }> {
    const sessions = await db.shooting_sessions.findAll({
      firearmsId,
      orderBy: { date: 'desc' },
    });

    const totalRoundsFired = sessions.reduce((s, r) => s + r.roundsFired, 0);
    const activityCounts = sessions.reduce((acc, s) => {
      acc[s.activityType] = (acc[s.activityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const favoriteActivity = Object.entries(activityCounts)
      .sort(([,a],[,b]) => b - a)[0]?.[0] ?? 'none';

    return {
      sessions,
      totalRoundsFired,
      sessionCount: sessions.length,
      lastShotDate: sessions[0]?.date ?? null,
      favoriteActivity,
    };
  }
}
```

---

## 6. Maintenance & Malfunction Tracking

### Maintenance Service

```typescript
// maintenance/maintenanceService.ts

export class MaintenanceService {

  async logMaintenance(data: {
    userId: string;
    firearmsId: string;
    maintenanceType: MaintenanceType;
    date: string;
    details?: string;
    nextDueDate?: string;
    cost?: number;
  }): Promise<MaintenanceRecord> {
    return db.maintenance_records.create(data);
  }

  // Rounds since last maintenance of a given type
  async getRoundsSinceLastMaintenance(
    firearmsId: string,
    maintenanceType: MaintenanceType
  ): Promise<number> {
    const lastMaint = await db.maintenance_records.findFirst({
      firearmsId,
      maintenanceType,
      orderBy: { date: 'desc' },
    });

    if (!lastMaint) {
      // Never maintained — return lifetime rounds
      const stats = await this.getFirearmStats(firearmsId);
      return stats.totalRoundsFired;
    }

    const sessionsSince = await db.shooting_sessions.findAll({
      firearmsId,
      date: { gte: lastMaint.date },
    });

    return sessionsSince.reduce((sum, s) => sum + s.roundsFired, 0);
  }

  // Get upcoming maintenance due
  async getUpcomingMaintenance(userId: string): Promise<{
    firearm: Firearm;
    record: MaintenanceRecord;
    daysUntilDue: number;
  }[]> {
    const upcoming = await db.maintenance_records.findAll({
      userId,
      nextDueDate: { gte: new Date().toISOString().split('T')[0] },
      orderBy: { nextDueDate: 'asc' },
      limit: 20,
    });

    return Promise.all(upcoming.map(async record => {
      const firearm = await db.firearms.findById(record.firearmsId);
      const daysUntilDue = Math.ceil(
        (new Date(record.nextDueDate!).getTime() - Date.now()) / 86400000
      );
      return { firearm, record, daysUntilDue };
    }));
  }

  // Malfunction log
  async logMalfunction(data: {
    userId: string;
    firearmsId: string;
    ammoId?: string;
    malfunctionType: MalfunctionType;
    date: string;
    details?: string;
  }): Promise<MalfunctionRecord> {
    return db.malfunction_records.create({ ...data, resolved: false });
  }

  async resolveMalfunction(id: string, resolution: string): Promise<void> {
    await db.malfunction_records.update(id, { resolved: true, resolution });
  }
}
```

### Maintenance Dashboard Queries

```sql
-- Firearms overdue for cleaning (> 500 rounds since last clean)
WITH last_clean AS (
  SELECT
    firearm_id,
    MAX(date) AS last_cleaned
  FROM maintenance_records
  WHERE maintenance_type IN ('clean', 'clean_and_oil')
  GROUP BY firearm_id
),
rounds_since AS (
  SELECT
    ss.firearm_id,
    SUM(ss.rounds_fired) AS rounds_since_clean
  FROM shooting_sessions ss
  JOIN last_clean lc ON lc.firearm_id = ss.firearm_id
  WHERE ss.date > lc.last_cleaned
  GROUP BY ss.firearm_id
)
SELECT
  f.manufacturer, f.model, f.nickname,
  lc.last_cleaned,
  COALESCE(rs.rounds_since_clean, 0) AS rounds_since_clean
FROM firearms f
LEFT JOIN last_clean lc ON lc.firearm_id = f.id
LEFT JOIN rounds_since rs ON rs.firearm_id = f.id
WHERE f.user_id = $1
  AND f.deleted_at IS NULL
  AND COALESCE(rs.rounds_since_clean, 0) > 500
ORDER BY rounds_since_clean DESC;

-- Malfunction frequency per firearm
SELECT
  f.manufacturer, f.model, f.nickname,
  COUNT(mal.id) AS malfunction_count,
  COUNT(mal.id) * 1000.0 / NULLIF(SUM(ss.rounds_fired), 0) AS malfunctions_per_1000_rounds
FROM firearms f
LEFT JOIN malfunction_records mal ON mal.firearm_id = f.id
LEFT JOIN shooting_sessions ss ON ss.firearm_id = f.id
WHERE f.user_id = $1 AND f.deleted_at IS NULL
GROUP BY f.id, f.manufacturer, f.model, f.nickname
ORDER BY malfunctions_per_1000_rounds DESC NULLS LAST;
```

---

## 7. Investment & Valuation Engine

### Valuation Calculations

```typescript
// valuation/valuationService.ts

export interface FirearmValuation {
  firearmsId: string;
  purchasePrice: number;
  accessoriesValue: number;
  ammoValue: number;           // Ammo caliber-matched to this firearm
  totalInvestment: number;
  estimatedCurrentValue?: number;
}

export interface CollectionSummary {

  totalFirearms: number;
  activeFirearms: number;
  soldFirearms: number;
  totalPurchaseValue: number;
  totalAccessoriesValue: number;
  totalAmmoValue: number;
  totalCollectionValue: number;
  totalRoundsFired: number;
  totalAmmoExpended: number;
}

export class ValuationService {

  async getFirearmValuation(firearmsId: string): Promise<FirearmValuation> {
    const [firearm, accessories, ammo] = await Promise.all([
      db.firearms.findById(firearmsId),
      db.accessories.findAll({ firearmsId }),
      db.ammo_inventory.findAll({ caliber: /* firearm.caliber */ '' }),
    ]);

    const accessoriesValue = accessories.reduce(
      (sum, a) => sum + (a.purchasePrice || 0), 0
    );
    const ammoValue = ammo.reduce(
      (sum, a) => sum + (a.roundsOnHand * (a.pricePerRound || 0)), 0
    );
    const purchasePrice = firearm.purchasePrice || 0;

    return {
      firearmsId,
      purchasePrice,
      accessoriesValue,
      ammoValue,
      totalInvestment: purchasePrice + accessoriesValue,
    };
  }

  async getCollectionSummary(userId: string): Promise<CollectionSummary> {
    const [firearms, accessories, ammoInventory, sessions] = await Promise.all([
      db.firearms.findAll({ userId, deletedAt: null }),
      db.accessories.findAll({ userId }),
      db.ammo_inventory.findAll({ userId }),
      db.shooting_sessions.findAll({ userId }),
    ]);

    const activeFirearms = firearms.filter(f => f.status === 'active');
    const soldFirearms = firearms.filter(f => f.status === 'sold');

    return {
      totalFirearms: firearms.length,
      activeFirearms: activeFirearms.length,
      soldFirearms: soldFirearms.length,
      totalPurchaseValue: activeFirearms.reduce((s, f) => s + (f.purchasePrice || 0), 0),
      totalAccessoriesValue: accessories.reduce((s, a) => s + (a.purchasePrice || 0), 0),
      totalAmmoValue: ammoInventory.reduce((s, a) => s + (a.roundsOnHand * (a.pricePerRound || 0)), 0),
      totalCollectionValue:
        activeFirearms.reduce((s, f) => s + (f.purchasePrice || 0), 0) +
        accessories.reduce((s, a) => s + (a.purchasePrice || 0), 0) +
        ammoInventory.reduce((s, a) => s + (a.roundsOnHand * (a.pricePerRound || 0)), 0),
      totalRoundsFired: sessions.reduce((s, r) => s + r.roundsFired, 0),
      totalAmmoExpended: sessions.reduce((s, r) => s + r.roundsFired, 0),
    };
  }
}
```

---

## 8. Photo & Receipt Storage

### Storage Service (Supabase Storage)

```typescript
// storage/photoService.ts
import { supabase } from '@/lib/supabase';

type PhotoBucket = 'firearm-photos' | 'receipts' | 'targets' | 'accessories';

export class PhotoService {

  async upload(
    file: File | Blob,
    bucket: PhotoBucket,
    userId: string,
    entityId: string
  ): Promise<string> {
    const ext = file instanceof File ? file.name.split('.').pop() : 'jpg';
    const path = `${userId}/${entityId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file instanceof File ? file.type : 'image/jpeg',
      });

    if (error) throw error;

    return data.path;
  }

  // Get a signed URL valid for 1 hour (never expose direct public URLs)
  async getSignedUrl(bucket: PhotoBucket, path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hour

    if (error) throw error;
    return data.signedUrl;
  }

  // Compress image before upload (client-side)
  async compressImage(file: File, maxWidthPx = 1920, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxWidthPx / img.width, maxWidthPx / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(), 'image/jpeg', quality);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async deletePhoto(bucket: PhotoBucket, path: string): Promise<void> {
    await supabase.storage.from(bucket).remove([path]);
  }
}

// Storage bucket config (set in Supabase dashboard)
/*
Buckets:
  firearm-photos  — private, 10MB max per file
  receipts        — private, 20MB max per file (PDFs allowed)
  targets         — private, 10MB max per file
  accessories     — private, 10MB max per file

RLS policies on storage:
  Users can only read/write files under their own userId prefix.
*/
```

---

## 9. Backend Architecture

### API Routes

```typescript
// REST API structure
// All routes require auth header: Authorization: Bearer <jwt>

// FIREARMS
GET    /api/firearms                    // List all firearms for user
POST   /api/firearms                    // Create firearm
GET    /api/firearms/:id                // Get single firearm + computed stats
PATCH  /api/firearms/:id                // Update firearm
DELETE /api/firearms/:id                // Soft delete
GET    /api/firearms/:id/history        // Full history (sessions, maintenance, malfunctions)
GET    /api/firearms/:id/valuation      // Investment breakdown

// AMMO
GET    /api/ammo                        // List ammo inventory
POST   /api/ammo                        // Add ammo lot
PATCH  /api/ammo/:id                    // Update ammo
DELETE /api/ammo/:id                    // Delete lot
GET    /api/ammo/compatible/:firearmsId // Ammo matching firearm's caliber

// SHOOTING SESSIONS
GET    /api/sessions?firearmsId=        // List sessions, optionally filtered
POST   /api/sessions                    // Log session (may decrement ammo)
PATCH  /api/sessions/:id                // Edit session
DELETE /api/sessions/:id                // Delete (restores ammo if decremented)

// MAINTENANCE
GET    /api/maintenance?firearmsId=     // List maintenance records
POST   /api/maintenance                 // Log maintenance
PATCH  /api/maintenance/:id
DELETE /api/maintenance/:id
GET    /api/maintenance/upcoming        // Upcoming due dates

// MALFUNCTIONS
GET    /api/malfunctions?firearmsId=
POST   /api/malfunctions
PATCH  /api/malfunctions/:id
DELETE /api/malfunctions/:id

// DASHBOARD
GET    /api/dashboard                   // Collection summary + stats
GET    /api/dashboard/alerts            // Low ammo, overdue maintenance

// EXPORT
GET    /api/export/pdf/:firearmsId      // PDF report for one firearm
GET    /api/export/pdf/collection       // Full collection PDF
GET    /api/export/csv                  // All data as CSV
```

### Supabase + Next.js Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types'; // Auto-generated from schema

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side client (for API routes with service role key)
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Never expose client-side
);

// api/firearms/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('firearms')
    .select(`
      *,
      accessories(*),
      shooting_sessions(id, date, rounds_fired),
      maintenance_records(id, date, maintenance_type)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}
```

---

## 10. Frontend Architecture

### State Management

```typescript
// store/firearmsStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface FirearmsStore {
  firearms: Record<string, Firearm>;
  ammoInventory: Record<string, AmmoInventory>;
  sessions: ShootingSession[];
  maintenance: MaintenanceRecord[];
  malfunctions: MalfunctionRecord[];
  dashboard: CollectionSummary | null;

  // Actions
  loadFirearms: () => Promise<void>;
  addFirearm: (data: Partial<Firearm>) => Promise<Firearm>;
  updateFirearm: (id: string, data: Partial<Firearm>) => Promise<void>;
  deleteFirearm: (id: string) => Promise<void>;

  logSession: (data: NewSession) => Promise<ShootingSession>;
  deleteSession: (id: string) => Promise<void>;

  loadAmmo: () => Promise<void>;
  addAmmo: (data: Partial<AmmoInventory>) => Promise<void>;

  loadDashboard: () => Promise<void>;
}

export const useFirearmsStore = create<FirearmsStore>()(
  immer((set, get) => ({
    firearms: {},
    ammoInventory: {},
    sessions: [],
    maintenance: [],
    malfunctions: [],
    dashboard: null,

    loadFirearms: async () => {
      const res = await fetch('/api/firearms');
      const data = await res.json();
      set(state => {
        state.firearms = data.reduce((acc, f) => ({ ...acc, [f.id]: f }), {});
      });
    },

    addFirearm: async (partial) => {
      const res = await fetch('/api/firearms', {
        method: 'POST',
        body: JSON.stringify(partial),
        headers: { 'Content-Type': 'application/json' },
      });
      const firearm = await res.json();
      set(state => { state.firearms[firearm.id] = firearm; });
      return firearm;
    },

    logSession: async (data) => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      const session = await res.json();
      set(state => { state.sessions.unshift(session); });

      // Optimistically update ammo count
      if (data.ammoId && data.decrementAmmo) {
        set(state => {
          const ammo = state.ammoInventory[data.ammoId!];
          if (ammo) ammo.roundsOnHand -= data.roundsFired;
        });
      }

      return session;
    },

    loadDashboard: async () => {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      set(state => { state.dashboard = data; });
    },
  }))
);
```

### Key React Components Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/
│   ├── firearms/
│   │   ├── page.tsx           ← Firearm list / grid
│   │   ├── [id]/
│   │   │   ├── page.tsx       ← Firearm detail
│   │   │   ├── sessions/
│   │   │   ├── maintenance/
│   │   │   └── malfunctions/
│   │   └── new/
│   ├── ammo/
│   │   ├── page.tsx           ← Ammo inventory grid
│   │   └── new/
│   ├── sessions/
│   │   ├── page.tsx           ← All sessions log
│   │   └── new/
│   ├── reports/
│   └── settings/
├── components/
│   ├── firearms/
│   │   ├── FirearmCard.tsx
│   │   ├── FirearmForm.tsx
│   │   └── FirearmStats.tsx
│   ├── ammo/
│   │   ├── AmmoCard.tsx
│   │   ├── AmmoForm.tsx
│   │   └── AmmoInventoryBar.tsx
│   ├── sessions/
│   │   ├── SessionForm.tsx
│   │   └── SessionList.tsx
│   ├── maintenance/
│   │   └── MaintenanceTimeline.tsx
│   ├── dashboard/
│   │   ├── CollectionSummary.tsx
│   │   ├── ValueBreakdown.tsx
│   │   └── RecentActivity.tsx
│   └── shared/
│       ├── PhotoUploader.tsx
│       └── CaliberBadge.tsx
```

---

## 11. Offline-First & Sync

Firearm owners frequently use apps at ranges with poor connectivity. Offline support is essential.

```typescript
// sync/offlineStore.ts — Using Dexie.js (IndexedDB)
import Dexie, { Table } from 'dexie';

class GunTrackDB extends Dexie {
  firearms!: Table<Firearm>;
  ammo!: Table<AmmoInventory>;
  sessions!: Table<ShootingSession>;
  maintenance!: Table<MaintenanceRecord>;
  malfunctions!: Table<MalfunctionRecord>;
  pendingOps!: Table<PendingOperation>;

  constructor() {
    super('GunTrackDB');
    this.version(1).stores({
      firearms:     'id, userId, caliber, status, updatedAt',
      ammo:         'id, userId, caliber, updatedAt',
      sessions:     'id, userId, firearmsId, date, updatedAt',
      maintenance:  'id, userId, firearmsId, date, nextDueDate',
      malfunctions: 'id, userId, firearmsId, date',
      pendingOps:   '++localId, type, entityId, timestamp',
    });
  }
}

export const localDb = new GunTrackDB();

// Any write goes through this — local first, queued for sync
export async function writeWithSync<T>(
  table: string,
  operation: 'create' | 'update' | 'delete',
  data: any
): Promise<void> {
  // Write to local IndexedDB immediately
  if (operation === 'delete') {
    await localDb[table].delete(data.id);
  } else {
    await localDb[table].put(data);
  }

  // Queue for server sync
  await localDb.pendingOps.add({
    type: `${operation}:${table}`,
    entityId: data.id,
    payload: data,
    timestamp: Date.now(),
    retries: 0,
  });

  // Attempt to flush if online
  if (navigator.onLine) {
    syncQueue.flush();
  }
}

// Sync on reconnect
window.addEventListener('online', () => syncQueue.flush());
```

---

## 12. Export & Insurance Reports

### PDF Report Generator

```typescript
// reports/pdfGenerator.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generateFirearmReport(firearmsId: string): Promise<Blob> {
  const [firearm, accessories, sessions, maintenance, malfunctions, valuation] =
    await Promise.all([
      db.firearms.findById(firearmsId),
      db.accessories.findAll({ firearmsId }),
      db.shooting_sessions.findAll({ firearmsId, orderBy: { date: 'desc' } }),
      db.maintenance_records.findAll({ firearmsId, orderBy: { date: 'desc' } }),
      db.malfunction_records.findAll({ firearmsId }),
      valuationService.getFirearmValuation(firearmsId),
    ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(20);
  doc.text('Firearm Record Report', 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  doc.text(`CONFIDENTIAL — Personal Firearm Records`, 14, 36);

  // Firearm Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Firearm Details', 14, 48);

  autoTable(doc, {
    startY: 52,
    head: [['Field', 'Value']],
    body: [
      ['Manufacturer', firearm.manufacturer],
      ['Model', firearm.model],
      ['Caliber', firearm.caliber],
      ['Type', firearm.type],
      ['Serial Number', firearm.serialNumber || 'N/A'],
      ['Date Purchased', firearm.datePurchased || 'N/A'],
      ['Purchase Price', firearm.purchasePrice ? `$${firearm.purchasePrice.toFixed(2)}` : 'N/A'],
      ['Total Rounds Fired', sessions.reduce((s, r) => s + r.roundsFired, 0).toString()],
      ['Last Shot', sessions[0]?.date || 'Never'],
      ['Last Cleaned', maintenance.filter(m => m.maintenanceType.includes('clean'))[0]?.date || 'Never'],
    ],
    theme: 'striped',
  });

  // Accessories
  if (accessories.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Accessories', 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Name', 'Category', 'Purchased', 'Price']],
      body: accessories.map(a => [
        a.name,
        a.category || '',
        a.datePurchased || '',
        a.purchasePrice ? `$${a.purchasePrice.toFixed(2)}` : '',
      ]),
    });
  }

  // Investment Summary
  const finalY = (doc as any).lastAutoTable?.finalY + 14 || 200;
  doc.setFontSize(12);
  doc.text(`Total Investment: $${valuation.totalInvestment.toFixed(2)}`, 14, finalY);
  doc.text(`(Firearm: $${valuation.purchasePrice.toFixed(2)} + Accessories: $${valuation.accessoriesValue.toFixed(2)})`, 14, finalY + 8);

  // Shooting History
  if (sessions.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Shooting History', 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Activity', 'Rounds', 'Location', 'Ammo']],
      body: sessions.map(s => [
        s.date,
        s.activityType,
        s.roundsFired.toString(),
        s.locationName || '',
        s.caliber,
      ]),
    });
  }

  return doc.output('blob');
}

// CSV Export (all data)
export async function exportAllDataCSV(userId: string): Promise<string> {
  const [firearms, ammo, sessions, maintenance, malfunctions] = await Promise.all([
    db.firearms.findAll({ userId }),
    db.ammo_inventory.findAll({ userId }),
    db.shooting_sessions.findAll({ userId }),
    db.maintenance_records.findAll({ userId }),
    db.malfunction_records.findAll({ userId }),
  ]);

  const sections = [
    { label: 'FIREARMS', data: firearms },
    { label: 'AMMO INVENTORY', data: ammo },
    { label: 'SHOOTING SESSIONS', data: sessions },
    { label: 'MAINTENANCE', data: maintenance },
    { label: 'MALFUNCTIONS', data: malfunctions },
  ];

  return sections.map(({ label, data }) => {
    if (data.length === 0) return `# ${label}\n(no records)\n`;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(v =>
        typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v ?? '')
      ).join(',')
    );
    return `# ${label}\n${headers}\n${rows.join('\n')}\n`;
  }).join('\n\n');
}
```

---

## 13. Compliance & Legal Considerations

This is not legal advice — consult an attorney for your specific jurisdiction. These are technical considerations.

### Data Sensitivity

```
CRITICAL: Firearm serial numbers + owner info is highly sensitive data.
- NEVER store this data unencrypted
- NEVER send this data in analytics events
- NEVER log it in application logs
- Use field-level encryption for serial numbers
- Delete data immediately and completely when user requests it (GDPR / CCPA)
```

### Privacy Policy Must-Haves

Your privacy policy MUST explicitly address:

1. What firearm data you collect (serial numbers, purchase history, location)
2. Where data is stored (US-based servers recommended, or specify region)
3. Who can access data (no one but the user; never sold to third parties)
4. Law enforcement requests (have a policy — typically requires valid legal process)
5. Data retention and deletion procedures
6. Breach notification procedures

### Terms of Service Must-Haves

1. Users must be of legal age to own firearms in their jurisdiction
2. App is for legal firearm owners only
3. No transfer/sale facilitation (you're a record-keeping app, not an FFL)
4. User is responsible for compliance with all local laws
5. No data is sold or shared with government agencies voluntarily

### App Store Considerations

```
Apple App Store:
- Category: Utilities or Lifestyle (NOT in "Weapon" category)
- Age rating: 17+ (Mature/Frequent)
- Requires explicit "Firearms" app review
- Cannot facilitate illegal firearm sales/transfers

Google Play:
- Category: Tools
- Must comply with Developer Policy — no facilitating illegal weapon transactions
- Cannot show weapon ads

Both stores:
- Clearly state the app is for legal firearm record-keeping only
- No in-app firearm purchasing/transfer functionality
```

### Subscription / Monetization

GunTrack uses a freemium model:

```
Free tier:   Limited firearms (e.g. 3), basic tracking, no export
Pro tier:    Unlimited firearms, PDF/CSV export, advanced stats, cloud backup
Pricing:     ~$10/year or $1.99/month (competitive with market)

Implementation: RevenueCat (handles iOS + Android subscriptions cleanly)
```

---

## 14. Full Build Roadmap & Tech Stack

### Recommended Tech Stack

```json
{
  "frontend_web": {
    "framework": "Next.js 14 (App Router)",
    "ui": "Tailwind CSS + shadcn/ui",
    "state": "Zustand + Immer",
    "forms": "react-hook-form + zod",
    "charts": "Recharts",
    "pdf": "jsPDF + jspdf-autotable",
    "localDb": "Dexie.js (IndexedDB offline)",
    "photos": "browser-image-compression"
  },
  "frontend_mobile": {
    "framework": "React Native (Expo)",
    "navigation": "Expo Router",
    "localDb": "expo-sqlite",
    "camera": "expo-camera + expo-image-picker",
    "biometric": "expo-local-authentication",
    "notifications": "expo-notifications"
  },
  "backend": {
    "database": "PostgreSQL via Supabase",
    "auth": "Supabase Auth (email/password + biometric token)",
    "storage": "Supabase Storage (private buckets)",
    "realtime": "Supabase Realtime (multi-device sync)",
    "api": "Next.js API Routes or Supabase Edge Functions",
    "encryption": "AES-256 (Supabase at-rest + field-level)",
    "subscriptions": "RevenueCat (mobile) + Stripe (web)"
  },
  "infrastructure": {
    "hosting": "Vercel (web) + EAS Build (mobile)",
    "cdn": "Cloudflare (static assets)",
    "monitoring": "Sentry (errors) + PostHog (analytics, no PII)",
    "email": "Resend (transactional)"
  },
  "testing": {
    "unit": "Vitest",
    "components": "@testing-library/react",
    "e2e": "Playwright (web) + Detox (mobile)",
    "ci": "GitHub Actions"
  }
}
```

### Build Phases

#### Phase 1 — Core MVP (Weeks 1–5)

| Week | Deliverable |
|------|-------------|
| 1 | Project setup, Supabase schema, auth (email + biometric stub), RLS policies |
| 2 | Firearm CRUD — add, view, edit, delete, photo upload |
| 3 | Ammo inventory — add lots, view counts, link to calibers |
| 4 | Shooting session logger — firearm + ammo link, auto-decrement ammo |
| 5 | Dashboard — collection summary, total investment, recent activity |

**Ship:** Functional app with the core loop. Get beta users.

#### Phase 2 — Operations (Weeks 6–9)

| Week | Deliverable |
|------|-------------|
| 6 | Maintenance records — log, view timeline, next-due reminders |
| 7 | Malfunction records — log, resolve, frequency stats per firearm |
| 8 | Accessories — add to firearm, track value |
| 9 | Offline support — IndexedDB / expo-sqlite, sync queue on reconnect |

**Ship:** Full operational tracking. Core value prop complete.

#### Phase 3 — Reports & Polish (Weeks 10–13)

| Week | Deliverable |
|------|-------------|
| 10 | PDF export per firearm (insurance-ready) |
| 11 | CSV full data export |
| 12 | Advanced stats — rounds since last clean, malfunction rate, burn rate |
| 13 | Push notifications — maintenance reminders, low ammo alerts |

**Ship:** Insurance-grade record keeping. Monetizable.

#### Phase 4 — Monetization & Growth (Weeks 14–16)

| Week | Deliverable |
|------|-------------|
| 14 | Freemium limits + Stripe/RevenueCat subscription integration |
| 15 | Search & filter — find firearms/ammo/sessions quickly |
| 16 | Performance audit, App Store submission prep, privacy policy |

**Ship:** v1.0 — App Store ready.

---

### Key Differentiators to Build Better Than GunTrack

1. **Better offline** — Full functionality with zero connectivity (GunTrack has had data loss issues per reviews)
2. **Malfunction analytics** — Show malfunctions per 1,000 rounds per ammo brand (helps identify bad ammo)
3. **Cost-per-round tracker** — Total money spent on ammo for each firearm
4. **Maintenance reminders** — Push notifications based on rounds-since-clean threshold (e.g. "Your Glock 19 hasn't been cleaned in 500 rounds")
5. **Export to insurance** — One-tap PDF optimized for insurance claim submission
6. **Family/safe sharing** — Shared collection view for household (GunTrack doesn't support this)
7. **Sold firearm archive** — Full history preserved after sale (for legal protection)

---

*Complete technical blueprint — ready to build.*
*All code examples are production patterns. Consult an attorney for legal compliance in your jurisdiction.*
