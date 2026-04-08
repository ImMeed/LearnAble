# Phase 0 — Project Setup & Role Picker
## Sustained Attention Score · LearnAble

**Goal:** Establish shared types, install all dependencies, and gate the call UI behind a role picker so the app knows whether the current user is a Teacher or a Student.

**Depends on:** Nothing — this is the foundation.

**Produces:**
- `frontend/src/features/attention/types/attention.ts` — shared TypeScript types used by all later phases
- `frontend/src/features/attention/components/RolePickerScreen.tsx` + `.css`
- Modifications to `frontend/src/pages/CallPage.tsx` — role state + conditional rendering
- Modifications to `frontend/src/app/i18n.ts` — all attention-feature translation keys (en + ar)

---

## 0.1 — Install Dependencies

Run the following inside `frontend/`:

```bash
npm install @mediapipe/face_mesh @mediapipe/camera_utils recharts
```

- `@mediapipe/face_mesh` — used in Phase 1 & 2 (student side, face landmark detection)
- `@mediapipe/camera_utils` — optional camera utility from MediaPipe (used for frame feeding helper)
- `recharts` — used in Phase 5 (teacher-side timeline chart); ships with its own TypeScript types, no `@types/` needed

After install, verify `frontend/package.json` `dependencies` contains all three. The app should still build cleanly with `npm run build`.

---

## 0.2 — Create Shared Types File

Create the file:
**`frontend/src/features/attention/types/attention.ts`**

This file must be created fresh. It defines every TypeScript type used across all attention phases. No other logic belongs here.

```typescript
// frontend/src/features/attention/types/attention.ts

/** Which role the user selected in the RolePickerScreen. */
export type UserRole = 'teacher' | 'student';

/** Attention quality tier mapped from the smoothed score. */
export type FocusLabel = 'high' | 'moderate' | 'low';

/**
 * Raw signals extracted from a single MediaPipe frame.
 * Computed in Phase 2 by extractFeatures().
 */
export interface RawFeatures {
  facePresent: boolean;
  headYaw: number;          // degrees; positive = turned right, negative = turned left
  headPitch: number;        // degrees; negative = looking down, positive = looking up
  eyeOpennessRatio: number; // 0.0 (fully closed) to ~0.35 (fully open)
  irisDeviation: number;    // 0.0 (centered) to 1.0 (extreme side gaze)
}

/**
 * Intermediate score object produced by computeAttentionScore().
 * Exists inside the student-side processor only — never sent over the wire.
 */
export interface AttentionScore {
  raw: number;      // 0–100 before smoothing
  smoothed: number; // 0–100 after EMA smoothing
  label: FocusLabel;
}

/**
 * The WebSocket message payload sent from student browser to teacher browser.
 * This is the only attention data that crosses the network.
 */
export interface AttentionMetrics {
  score: number;          // smoothed score 0–100
  label: FocusLabel;
  distraction: boolean;   // true = 2+ consecutive low-focus intervals detected
  signals: {
    face_present: boolean;
    head_yaw: number;
    head_pitch: number;
    eye_openness: number;
    blink_rate: number;   // blinks per minute, computed in Phase 2
    iris_deviation: number;
  };
  timestamp: number;      // seconds since the call started (not a Unix timestamp)
}

/**
 * One entry in the teacher-side in-memory timeline array.
 * Appended every 4 seconds. Cleared when the call ends.
 */
export interface AttentionDataPoint {
  timestamp: number;    // seconds since call start
  score: number;        // 0–100
  label: FocusLabel;
  distraction: boolean;
}

/**
 * The complete WebSocket message envelope for attention metrics.
 * type === "attention_metrics" is the discriminator used in useSignaling.ts.
 */
export interface AttentionMetricsMessage {
  type: 'attention_metrics';
  payload: AttentionMetrics;
}
```

---

## 0.3 — Build RolePickerScreen Component

### File: `frontend/src/features/attention/components/RolePickerScreen.tsx`

```tsx
// frontend/src/features/attention/components/RolePickerScreen.tsx

import { useTranslation } from 'react-i18next';
import { UserRole } from '../types/attention';
import './RolePickerScreen.css';

interface RolePickerScreenProps {
  onSelectRole: (role: UserRole) => void;
}

export default function RolePickerScreen({ onSelectRole }: RolePickerScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="role-picker" role="dialog" aria-modal="true" aria-label={t('attention.rolePicker.title')}>
      <div className="role-picker__card">
        <h2 className="role-picker__title">{t('attention.rolePicker.title')}</h2>
        <div className="role-picker__buttons">
          <button
            className="role-picker__btn role-picker__btn--teacher"
            onClick={() => onSelectRole('teacher')}
          >
            <span className="role-picker__icon" aria-hidden="true">🧑‍🏫</span>
            <span>{t('attention.rolePicker.teacher')}</span>
          </button>
          <button
            className="role-picker__btn role-picker__btn--student"
            onClick={() => onSelectRole('student')}
          >
            <span className="role-picker__icon" aria-hidden="true">🧒</span>
            <span>{t('attention.rolePicker.student')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

### File: `frontend/src/features/attention/components/RolePickerScreen.css`

```css
/* frontend/src/features/attention/components/RolePickerScreen.css */

.role-picker {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.role-picker__card {
  background: #1e1e2e;
  border-radius: 16px;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  width: min(90vw, 380px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.role-picker__title {
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
}

.role-picker__buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.role-picker__btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  border: 2px solid transparent;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  width: 100%;
  justify-content: center;
}

.role-picker__btn--teacher {
  background: #2563eb;
  color: #ffffff;
}

.role-picker__btn--teacher:hover {
  background: #1d4ed8;
  border-color: #93c5fd;
}

.role-picker__btn--student {
  background: #16a34a;
  color: #ffffff;
}

.role-picker__btn--student:hover {
  background: #15803d;
  border-color: #86efac;
}

.role-picker__icon {
  font-size: 1.4rem;
}
```

---

## 0.4 — Modify CallPage.tsx

File to edit: **`frontend/src/pages/CallPage.tsx`**

### What to change

**Step 1 — Import RolePickerScreen:**
Add the import near the top of the file alongside the other component imports:

```typescript
import RolePickerScreen from '../features/attention/components/RolePickerScreen';
import type { UserRole } from '../features/attention/types/attention';
```

**Step 2 — Add role state:**
Inside the `CallPage` function body, after the existing `useState` declarations, add:

```typescript
const [role, setRole] = useState<UserRole | null>(null);
```

**Step 3 — Add the role picker gate:**
The role picker must appear once the user has joined the room (i.e., the WebSocket is connected and camera is ready) but before the standard call UI renders, and only if a role has not yet been chosen.

Add this block immediately before the `return (` statement of the component (after all `useEffect` hooks):

```typescript
// Show the role picker once the room is joined, until the user picks a role
const showRolePicker =
  role === null &&
  (callState === 'waiting' || callState === 'connected');
```

**Step 4 — Render the picker overlay:**
Inside the returned JSX, immediately after the opening `<div className="call-page">` and before any other conditional renders, add:

```tsx
{showRolePicker && (
  <RolePickerScreen onSelectRole={setRole} />
)}
```

**Step 5 — Pass role to gated downstream logic (Phase 1 onwards):**
No downstream usage yet in Phase 0. The `role` state is defined here and will be consumed by hooks added in Phases 1–4. No further changes to `CallPage.tsx` are needed in this phase.

### Edge cases
- If both users pick "Teacher": neither runs MediaPipe (no processor mounted). Teacher sees the "Waiting for student data…" placeholder (added in Phase 4). This is acceptable for MVP.
- If both users pick "Student": both run MediaPipe but neither sees the teacher overlay UI. No crashes. Acceptable for MVP.
- Role is lost on tab refresh. User must re-pick. This is by design (PRD scope).

---

## 0.5 — Add Translation Keys to i18n.ts

File to edit: **`frontend/src/app/i18n.ts`**

Add the following `attention` block inside the `en.translation` object, at the same nesting level as the existing `call` key:

```typescript
attention: {
  rolePicker: {
    title: "Who are you?",
    teacher: "I'm a Teacher",
    student: "I'm a Student",
  },
  overlay: {
    highFocus: "High Focus",
    moderateFocus: "Moderate Focus",
    lowFocus: "Low Focus",
    waitingData: "Waiting for student data…",
    noData: "No attention data available",
    unavailable: "Attention tracking unavailable",
    details: "Details",
  },
  alert: {
    title: "Student appears distracted",
    body: "Focus dropped below threshold",
    dismiss: "Dismiss",
  },
  panel: {
    title: "Attention Timeline",
    back: "← Back",
    collecting: "Collecting data…",
    legendHigh: "High Focus",
    legendModerate: "Moderate",
    legendLow: "Low",
  },
  consent: {
    tracking: "Attention tracking is active",
  },
  tabInactive: "Student tab inactive",
},
```

Add the following `attention` block inside the `ar.translation` object at the same nesting level as `call`:

```typescript
attention: {
  rolePicker: {
    title: "من أنت؟",
    teacher: "أنا معلم",
    student: "أنا طالب",
  },
  overlay: {
    highFocus: "تركيز عالٍ",
    moderateFocus: "تركيز متوسط",
    lowFocus: "تركيز منخفض",
    waitingData: "…في انتظار بيانات الطالب",
    noData: "لا تتوفر بيانات انتباه",
    unavailable: "تتبع الانتباه غير متاح",
    details: "تفاصيل",
  },
  alert: {
    title: "يبدو أن الطالب مشتت",
    body: "انخفض التركيز عن المستوى المطلوب",
    dismiss: "تجاهل",
  },
  panel: {
    title: "مخطط الانتباه",
    back: "رجوع →",
    collecting: "…جمع البيانات",
    legendHigh: "تركيز عالٍ",
    legendModerate: "متوسط",
    legendLow: "منخفض",
  },
  consent: {
    tracking: "تتبع الانتباه نشط",
  },
  tabInactive: "علامة تبويب الطالب غير نشطة",
},
```

---

## 0.6 — Edge Case: Handle Missing Peer ID

The current `useSignaling.ts` connects to a room with two anonymous participants. There is no `peerId` in the existing implementation. Phase 0 does not require this, but the type file must include a `peerId` field in `AttentionMetrics` for forward compatibility (Phase 6 requirement). Add it to `AttentionMetrics` in `attention.ts`:

```typescript
export interface AttentionMetrics {
  peerId?: string;   // optional — populated in Phase 6 for multi-student support
  score: number;
  // ... rest of fields as defined in 0.2
}
```

---

## Acceptance Criteria

- [ ] `npm install` completes without errors. `npm run build` produces no TypeScript errors.
- [ ] Navigating to `/call/:roomId` shows the spinner initially (idle state).
- [ ] Once the WebSocket connects and camera is ready, `RolePickerScreen` appears as a full-screen overlay.
- [ ] Clicking "I'm a Teacher" or "I'm a Student" dismisses the picker and shows the normal call UI.
- [ ] Selecting Teacher or Student does NOT affect the WebRTC connection — media streams continue uninterrupted.
- [ ] Role is lost on page refresh (by design — no persistence).
- [ ] All `t('attention.*')` keys resolve without missing-translation warnings in both `en` and `ar` locales.
- [ ] No console errors.

---

## Files Created / Modified in This Phase

| Action | File |
|--------|------|
| CREATE | `frontend/src/features/attention/types/attention.ts` |
| CREATE | `frontend/src/features/attention/components/RolePickerScreen.tsx` |
| CREATE | `frontend/src/features/attention/components/RolePickerScreen.css` |
| MODIFY | `frontend/src/pages/CallPage.tsx` — add `role` state + picker gate |
| MODIFY | `frontend/src/app/i18n.ts` — add `attention.*` keys in `en` and `ar` |

---

## What Phase 1 Will Build On

Phase 1 reads `role` from `CallPage` state. When `role === 'student'`, it mounts the `useAttentionProcessor` hook and begins frame capture. Phase 0 must be fully working before Phase 1 starts.
