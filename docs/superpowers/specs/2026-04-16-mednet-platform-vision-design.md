# MEDNET Platform Vision & Phase 1 Design

## Context

MEDNET is a React Native/Expo app for medical students at Tzfat Medical Faculty, Israel. It currently has 10+ features (Bridges, Discussions, Events, Chat, Messenger, Secondhand Marketplace, Apartments, Rides, Prices, Community Q&A) with Supabase backend and Claude-powered AI chat.

**The problem:** The current app works, but lacks the depth to be truly differentiated. The chat (MEDIT/CHATMED) is basic — it answers questions from the database but doesn't know the user, can't perform actions, and doesn't proactively engage. User profiles are shallow. There's no admin panel or analytics. The architecture is single-tenant.

**The vision:** Transform MEDNET from a feature collection into a **chat-first community platform** where the AI assistant is the primary interface. Three core differentiators:

1. **Chat as the primary interface** — not just search, but a proactive companion that knows each user deeply, performs actions on their behalf, and guides their experience
2. **Community-only data** — all information comes exclusively from community members, zero external sources
3. **Hermetically sealed environment** — privacy-first, data never leaves the system, with plans to migrate to an open-source LLM

**Future scope:** MEDNET is the first deployment of a reusable platform. The next client is the Thai Tourism Ministry (much larger scale). The architecture must be modular and multi-tenant ready.

---

## Roadmap Overview

### Phase 1: Data Foundation & User Context Engine (THIS SPEC)
Build the data infrastructure that everything else depends on: deep user profiles, activity tracking, social graph, smart notifications.

### Phase 2: Smart Chat (MEDIT 2.0)
Context-aware AI assistant with proactive engagement, action execution, page awareness, conversation memory, and personal analytics delivery.

### Phase 3: Admin Panel & Analytics
Web-based dashboard for community managers with content management, user analytics, engagement metrics, and hot topics tracking.

### Phase 4: Platform & Privacy
Multi-tenant architecture, LLM migration evaluation (open-source vs private API with DPA), security hardening, and white-label configuration.

---

## Phase 1: Detailed Design

### 1. Enhanced User Profile

**Current state:** `users` table has basic fields (full_name, email, year_of_study, avatar_url, interests[], invite_token, role, user_type).

**Enhanced fields to add to `users` table:**

| Field | Type | Purpose |
|-------|------|---------|
| `marital_status` | enum: `single`, `in_relationship`, `married` | Content matching (couple events, apartments) |
| `partner_user_id` | UUID (FK → users), nullable | Couple sync feature |
| `has_children` | boolean | Family-relevant content |
| `children_ages` | integer[] | Age-appropriate event suggestions |
| `settlement` | text | Location-based matching (rides, neighbors, prices) |
| `languages` | text[] | Content language preferences |
| `academic_track` | text | Medical specialization interest → relevant bridges |
| `bio` | text | Social context for other users |
| `phone` | text | Contact for rides, apartments, secondhand |
| `graduation_year` | integer | Cohort grouping |
| `origin_city` | text | Ride matching, social connection |
| `profile_completeness` | integer (0-100) | Chat prompts: "complete your profile" |
| `onboarding_completed_at` | timestamptz | Tracking |
**Tag subscriptions — separate junction table:**

Rather than storing tags as an array on users, a junction table enables efficient two-way queries ("which tags does user X follow?" and "which users follow tag Y?"):

```sql
CREATE TABLE user_tag_subscriptions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES bridge_tags(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);
```

**Couple sync flow:**
1. User A sets `partner_user_id` to User B
2. User B receives a confirmation request
3. On approval, both profiles are linked
4. Chat can cross-reference: "Your partner signed up for event X — want to join too?"

**Tags as the central matching mechanism:**
- Tags are already used for bridges (`bridge_tags`, `bridge_tag_assignments`)
- `selected_tags` on the user profile controls which discussions appear in their feed
- Users can create new tags and invite others to follow them
- This replaces "join a noisy WhatsApp group" — users subscribe only to relevant topics
- Chat uses tags to recommend content and suggest new relevant tags

### 2. Activity Tracking

**New table: `user_activity`**

```sql
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL, -- 'view', 'create', 'react', 'search', 'bookmark', 'share'
  target_type TEXT NOT NULL,   -- 'bridge', 'discussion', 'event', 'ride', 'secondhand', 'apartment', 'price'
  target_id UUID,              -- ID of the specific item (nullable for searches)
  metadata JSONB DEFAULT '{}', -- extra data: { "duration_seconds": 30, "query": "דירות 3 חדרים" }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_target ON user_activity(target_type, target_id);
```

**What this enables:**
- Chat knows: "You viewed the Anatomy bridge 5 times this week — want me to create a summary?"
- Recommendations: "Users who viewed your bridges also liked..."
- Admin analytics: "Most viewed bridge this month", "Top 10 active users"
- Personal analytics: "Your bridge was viewed 47 times, 3 people added tips"

**New table: `user_search_history`**

```sql
CREATE TABLE user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  context TEXT, -- where the search happened: 'bridges', 'discussions', 'secondhand', 'chat'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Chat can see search patterns and proactively offer help: "I see you searched for 'neurology study group' — there's a discussion with that tag, want me to add you?"

### 3. Social Graph Enhancement

**Changes to existing `friendships` table:**
- Add column: `relationship_type` (enum: `friend`, `partner`, `family`, `study_buddy`)

**New table: `user_circles`**

```sql
CREATE TABLE user_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "שנתון ג'", "שכני כרמיאל", "מעוניינים בכירורגיה"
  circle_type TEXT NOT NULL,             -- 'year_group', 'settlement', 'interest', 'custom'
  auto_generated BOOLEAN DEFAULT false,  -- true for system-created circles
  created_by UUID REFERENCES users(id),  -- null for auto-generated
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_circle_members (
  circle_id UUID NOT NULL REFERENCES user_circles(id),
  user_id UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (circle_id, user_id)
);
```

**Auto-generated circles:**
- System creates circles for: each year group, each settlement, each popular tag
- Circles are created/updated by a database function triggered on profile save (when user updates `year_of_study`, `settlement`, or tag subscriptions)
- Users are automatically added based on their profile
- Chat uses circles: "3 friends from your year added tips to Bridge X"

### 4. Smart Notification Infrastructure

**New table: `notification_preferences`**

```sql
CREATE TABLE notification_preferences (
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL, -- 'new_bridge', 'new_event', 'discussion_update', 'form_reminder', 'chat_suggestion'
  enabled BOOLEAN DEFAULT true,
  channel TEXT DEFAULT 'in_app',  -- 'in_app', 'push', 'email'
  PRIMARY KEY (user_id, notification_type)
);
```

**New table: `pending_actions`**

```sql
CREATE TABLE pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,       -- 'form', 'survey', 'profile_update', 'rsvp', 'document'
  title TEXT NOT NULL,             -- "טופס מלגה לשכר דירה"
  description TEXT,
  url TEXT,                        -- link to the form/action
  metadata JSONB DEFAULT '{}',    -- extra data specific to the action type
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'dismissed', 'expired'
  due_date TIMESTAMPTZ,           -- optional deadline
  created_by UUID REFERENCES users(id), -- admin who created it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Purpose:** 
- Admin creates a "scholarship form" pending action — one row per targeted user (e.g., all 2nd-year students get individual rows, created via a batch operation in the admin panel)
- Chat tells each user: "Hey, there's a scholarship form for housing you haven't filled out yet — due in 3 days. Want me to help you with it?"
- When user completes it, status changes to `completed`

**RLS policies for all new tables:**
- `user_activity`, `user_search_history`, `chat_interactions`: users can only read/write their own data
- `user_circles`, `user_circle_members`: all authenticated users can read; only circle creator or auto-system can write
- `notification_preferences`: users can only read/write their own preferences
- `pending_actions`: users can read/update their own; admins can create for any user
- `user_tag_subscriptions`: users can read/write their own; all users can read (to see who follows a tag)

### 5. Chat Interactions (Community FAQ Foundation)

**New table: `chat_interactions`**

```sql
CREATE TABLE chat_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  topic_tags TEXT[],              -- auto-assigned by AI during response: ['anatomy', 'exam_prep']
  response_summary TEXT,          -- brief summary of the answer given
  response_helpful BOOLEAN,       -- user feedback: was this useful?
  session_id UUID,                -- groups messages in the same chat session
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_interactions_topics ON chat_interactions USING GIN(topic_tags);
```

**Purpose:**
- Aggregates questions from ALL users to identify common questions per topic
- Chat suggests: "Students interested in anatomy frequently ask about X — want to know?"
- FAQ updates dynamically as the community grows
- Data source for Phase 3 analytics ("What are students asking about most?")

---

## Key Design Decisions

### Tags as First-Class Citizens
Tags are the primary matching mechanism. They connect bridges, discussions, events, and users. The user's `selected_tags` controls their entire content feed and drives chat personalization. This replaces broad groups with targeted, relevant content delivery.

### Activity Tracking is Opt-In Implicit
We track what users do (view, create, search) to improve their experience, but we don't expose raw data to other users. Only aggregated, anonymized insights appear (e.g., "47 views on your bridge"). The chat uses activity data to personalize, but doesn't reveal it to others.

### Pending Actions Bridge Admin and Chat
The `pending_actions` table is the communication channel between community management (Phase 3) and the smart chat (Phase 2). Admins create actions; the chat delivers and assists with them.

### Community FAQ is Emergent
Rather than manually curating FAQs, the system learns from actual chat interactions. Common questions surface naturally from usage patterns. This aligns with the "community-only data" principle.

---

## Files to Modify (Phase 1)

### New Migration File
- `supabase/migrations/005_user_context_engine.sql` — All new tables and schema changes

### Modified Files
- `src/types/database.ts` — TypeScript interfaces for new tables
- `src/stores/authStore.ts` — Extended user profile handling
- `src/stores/notificationStore.ts` — Smart notification preferences
- `app/(auth)/onboarding.tsx` — Enhanced onboarding with new profile fields
- `app/(tabs)/profile.tsx` — Extended profile editing (tags, family, settlement)

### New Files
- `src/stores/activityStore.ts` — Activity tracking (log views, searches, interactions)
- `src/stores/circleStore.ts` — Social circles management
- `src/lib/activityTracker.ts` — Utility to log user activity from any screen
- `src/components/TagSelector.tsx` — Reusable tag selection component (used in profile, discussions, bridges)

---

## Verification Plan

### Database
1. Apply migration `005_user_context_engine.sql` to Supabase
2. Verify all tables created with correct columns, types, and constraints
3. Verify RLS policies are in place
4. Test: insert a user with extended profile fields, verify data integrity

### Profile
1. Update onboarding flow to collect new fields
2. Edit profile screen to allow updating all new fields (tags, settlement, family status)
3. Verify `profile_completeness` calculates correctly
4. Test couple sync flow (request → approval → link)

### Activity Tracking
1. Instrument key screens to log activity (bridge view, discussion view, search)
2. Verify activity data is recorded correctly
3. Test that indexes work efficiently for querying user history

### Tags
1. Verify tag selection updates discussion feed
2. Test creating a new tag
3. Test inviting another user to follow a tag

### Notifications
1. Create a pending action as admin
2. Verify it appears for the targeted user
3. Mark as completed, verify status change

---

## What This Does NOT Include (Deferred to Later Phases)

- **Smart chat capabilities** → Phase 2
- **Chat performing actions** (creating rides, searching marketplace) → Phase 2
- **Admin panel UI** → Phase 3
- **Analytics dashboard** → Phase 3
- **Multi-tenant architecture** → Phase 4
- **LLM migration** → Phase 4
- **Push notifications infrastructure** → Phase 2/3
