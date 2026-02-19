# Mission Control - Multi-Agent Orchestration Dashboard

**Version:** 1.0  
**Created:** 2026-02-19  
**Author:** Skippy the Magnificent (CEO)  
**Executor:** Dev Manager (Implementation)

---

## Executive Summary

This document defines the complete specification for adapting Alex Finn's Mission Control concept to our multi-agent ecosystem. We operate with a 3-tier hierarchy:

```
MATT (Human) → SKIPPY (CEO) → MANAGERS (3) → SUBAGENTS (18)
```

The Mission Control dashboard provides visibility and control across this entire hierarchy.

---

## Architecture Overview

### Tech Stack
- **Frontend:** Next.js 14+ with App Router
- **Database:** SQLite (local) + PostgreSQL (Neon, for cross-machine sync)
- **Styling:** Tailwind CSS + shadcn/ui components
- **State:** React Query for server state, Zustand for UI state
- **Real-time:** Server-Sent Events (SSE) for live updates
- **Icons:** Lucide React

### Directory Structure
```
mission-control/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── tasks/          # Tasks Board
│   │   │   ├── pipeline/       # Content Pipeline
│   │   │   ├── calendar/       # Calendar View
│   │   │   ├── memory/         # Memory Browser
│   │   │   ├── team/           # Team Org Chart
│   │   │   └── office/         # Office View
│   │   ├── api/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── tasks/
│   │   ├── pipeline/
│   │   ├── calendar/
│   │   ├── memory/
│   │   ├── team/
│   │   ├── office/
│   │   └── shared/
│   └── lib/
│       ├── db/
│       ├── hooks/
│       └── utils/
├── docs/
│   └── MISSION_CONTROL_SPEC.md  # This document
└── agent-resources/
```

---

## Component Specifications

---

## 1. Tasks Board (Enhanced)

### Purpose
Multi-tier task visibility across the entire agent hierarchy. Shows tasks at Skippy, Manager, and Subagent levels.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  TASKS BOARD                                    [Filter] [New Task] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   BACKLOG   │  │   PLANNING  │  │  IN PROGRESS│  │   COMPLETE │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├────────────┤ │
│  │ [SKIPPY]    │  │ [DEV]       │  │ [MARKETING] │  │ [SKIPPY]   │ │
│  │ Task #47    │  │ Task #52    │  │ Task #49    │  │ Task #45   │ │
│  │ Spec doc    │  │ API refactor│  │ LinkedIn    │  │ Security   │ │
│  │ ⏱️ 2h       │  │ ⏱️ 4h       │  │ ⏱️ 1h       │  │ ✅ Done    │ │
│  │             │  │             │  │             │  │            │ │
│  │ [DEV-MGR]   │  │ [SUBAGENT]  │  │ [SUBAGENT]  │  │ [DEV-MGR]  │ │
│  │ Task #48    │  │ Frontend:   │  │ Copywriter: │  │ Task #44   │ │
│  │ DB migration│  │ Dashboard   │  │ Draft posts │  │ ✅ Done    │ │
│  │ ⏱️ 3h       │  │ ⏱️ 2h       │  │ ⏱️ 30m      │  │            │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

#### Tier Indicators
Each task card shows its tier via badge:
- `SKIPPY` (gold) — My tasks
- `DEV-MGR` / `MARKETING-MGR` / `INSIGHTS-MGR` (blue) — Manager tasks
- `SUBAGENT` (gray) — Subagent tasks

#### Filtering
- By tier: Skippy / Managers / Subagents
- By manager: Dev / Marketing / Insights
- By status: Backlog / Planning / In Progress / Complete / Blocked
- By assignee: Select specific agent

#### Drag & Drop
- Move tasks between columns
- Reassign by dragging to different tier
- Status updates on drop

#### Task Card Content
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  tier: 'skippy' | 'manager' | 'subagent';
  managerId?: string;        // Which manager (if manager/subagent tier)
  subagentType?: string;     // Which subagent type (if subagent tier)
  assignee: string;          // Agent name
  status: 'backlog' | 'planning' | 'in_progress' | 'complete' | 'blocked';
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  estimatedMinutes: number;
  actualMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  dependencies: string[];    // Task IDs
  deliverables: Deliverable[];
}
```

#### Click to Expand
Modal showing:
- Full description
- Subtasks checklist
- Activity log (who did what, when)
- Related memories
- Deliverables

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/tasks` | List tasks with filters |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Task details |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/assign` | Reassign task |
| GET | `/api/tasks/tiers` | Tasks grouped by tier |

### Implementation Notes
- Extend existing `TaskModal.tsx` and `MissionQueue.tsx`
- Add tier filtering to `WorkspaceDashboard.tsx`
- Sync tier info to PostgreSQL for cross-machine visibility

---

## 2. Content Pipeline

### Purpose
Track content creation from idea to publish. Managed by Marketing Manager with subagent support.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONTENT PIPELINE                              [+ New Idea] [Filter]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  IDEAS   │ │ RESEARCH │ │  DRAFT   │ │ HUMANIZE │ │ SCHEDULE │  │
│  │    5     │ │    2     │ │    3     │ │    1     │ │    4     │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤  │
│  │📝 Idea 1 │ │🔍 Res 1  │ │✍️ Draft 1│ │🤖 Human 1│ │📅 Post 1 │  │
│  │LinkedIn  │ │Trending  │ │LinkedIn  │ │X thread  │ │Feb 20    │  │
│  │carousel  │ │CDJR      │ │thought   │ │AI tweaks │ │9:00 AM   │  │
│  │          │ │          │ │leader    │ │          │ │          │  │
│  │📝 Idea 2 │ │🔍 Res 2  │ │✍️ Draft 2│ │          │ │📅 Post 2 │  │
│  │X thread  │ │Competitor│ │X thread  │ │          │ │Feb 20    │  │
│  │AI tools  │ │analysis  │ │7 parts   │ │          │ │12:00 PM  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                     │
│  ┌──────────┐ ┌──────────┐                                         │
│  │ PUBLISH  │ │ ANALYSIS │                                         │
│  │    8     │ │    3     │                                         │
│  ├──────────┤ ├──────────┤                                         │
│  │✅ Post 1 │ │📊 Post 1 │                                         │
│  │12.4K     │ │+340%     │                                         │
│  │likes     │ │engagement│                                         │
│  └──────────┘ └──────────┘                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages

| Stage | Owner | Actions |
|-------|-------|---------|
| **Ideas** | Human/Skippy | Add ideas, quick capture |
| **Research** | Research Agent | Trending topics, competitor analysis |
| **Draft** | Copywriter Agent | Write content, multiple options |
| **Humanize** | Editor Agent | Remove AI patterns, brand voice check |
| **Schedule** | Marketing Manager | Set publish time, platform selection |
| **Publish** | Community Manager | Post to platform |
| **Analysis** | Analytics Specialist | Track metrics, report results |

### Content Item Schema

```typescript
interface ContentItem {
  id: string;
  title: string;
  type: 'linkedin_post' | 'x_post' | 'x_thread' | 'carousel' | 'blog';
  platform: 'linkedin' | 'x' | 'facebook' | 'instagram';
  stage: 'idea' | 'research' | 'draft' | 'humanize' | 'schedule' | 'publish' | 'analysis';
  content: {
    hook?: string;
    body?: string;
    fullContent?: string;
    attachments?: string[];
  };
  research?: {
    trendingTopics?: string[];
    competitorPosts?: string[];
    hashtags?: string[];
  };
  schedule?: {
    publishAt?: Date;
    timezone: string;
  };
  analysis?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    engagementRate?: number;
  };
  assignedTo: string;  // Agent name
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}
```

### Features

#### Quick Capture
- Floating "+" button
- Voice-to-text support
- Auto-tagging based on keywords

#### Stage Movement
- Drag cards between stages
- Auto-assign to appropriate subagent
- Notify next agent in pipeline

#### Multi-Platform Preview
- Preview how content looks on each platform
- Character count warnings
- Image aspect ratio checker

#### Performance Tracking
- Pull metrics from platform APIs
- Compare performance across posts
- Identify top-performing content patterns

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/pipeline` | List all content items |
| POST | `/api/pipeline` | Create content item (idea) |
| GET | `/api/pipeline/:id` | Content details |
| PATCH | `/api/pipeline/:id` | Update content |
| PATCH | `/api/pipeline/:id/stage` | Move to new stage |
| POST | `/api/pipeline/:id/research` | Trigger research |
| POST | `/api/pipeline/:id/draft` | Trigger drafting |
| POST | `/api/pipeline/:id/humanize` | Trigger humanization |
| GET | `/api/pipeline/analytics` | Pipeline metrics |

---

## 3. Calendar

### Purpose
Visualize all scheduled tasks, cron jobs, and agent activities across the entire system.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  CALENDAR                         [Day] [Week] [Month]  ← Feb 19 → │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Thursday, February 19, 2026                                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 06:00 │ 🔧 Dev Manager Daily Check-in                       │   │
│  │ 06:30 │ 🍺 Daily Self-Audit (Skippy)                        │   │
│  │ 07:00 │ ⬆️ Daily Auto-Update (All skills)                   │   │
│  │ 08:00 │ 📱 Social Growth Session (Marketing Manager)        │   │
│  │ 09:00 │ 🔒 Security Audit (Dev Manager)                     │   │
│  │ 12:00 │ 📱 Social Growth Midday Check                       │   │
│  │ 15:00 │ 📱 Social Growth Midday Check                       │   │
│  │ 18:00 │ 📱 Social Growth Evening Check                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Upcoming This Week:                                                │
│  • Feb 20 - QBR Prep (Insights Manager) - Nissan                   │
│  • Feb 21 - Content Review (Marketing Manager)                     │
│  • Feb 22 - Database Maintenance (Dev Manager)                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

#### View Modes
- **Day:** Hourly timeline
- **Week:** 7-day grid
- **Month:** Calendar grid

#### Event Sources
1. **OpenClaw Cron Jobs** — Pulled via gateway API
2. **Task Deadlines** — From Tasks Board
3. **Scheduled Posts** — From Content Pipeline
4. **Manual Events** — Created by Matt/Skippy

#### Color Coding
- 🍺 Gold: Skippy events
- 🔧 Blue: Dev Manager events
- 📱 Green: Marketing Manager events
- 📊 Purple: Insights Manager events
- 🔴 Red: Urgent/Overdue

#### Interaction
- Click event to see details
- Drag to reschedule
- Right-click for quick actions

### Event Schema

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  type: 'cron' | 'task' | 'content' | 'manual';
  source: {
    type: 'cron' | 'task' | 'pipeline' | 'manual';
    id: string;
  };
  agent: {
    tier: 'skippy' | 'manager' | 'subagent';
    name: string;
    icon: string;
  };
  status: 'scheduled' | 'running' | 'complete' | 'failed';
  recurring?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'cron';
    expression?: string;
  };
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/calendar` | Events for date range |
| POST | `/api/calendar` | Create manual event |
| GET | `/api/calendar/:id` | Event details |
| PATCH | `/api/calendar/:id` | Update event |
| DELETE | `/api/calendar/:id` | Delete event |
| GET | `/api/calendar/cron` | Sync cron jobs from OpenClaw |
| GET | `/api/calendar/upcoming` | Next 7 days summary |

### OpenClaw Integration

```typescript
// Fetch cron jobs from OpenClaw Gateway
const cronJobs = await fetch('http://localhost:18789/api/cron', {
  headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}` }
});

// Transform to calendar events
const events = cronJobs.map(job => ({
  id: `cron-${job.id}`,
  title: job.name,
  start: nextRunTime(job.schedule),
  type: 'cron',
  source: { type: 'cron', id: job.id },
  agent: getAgentFromJob(job),
  recurring: { pattern: 'cron', expression: job.schedule.expr }
}));
```

---

## 4. Memory Browser

### Purpose
Browse, search, and manage all memories across the system. Replaces hidden markdown files with a beautiful UI.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  MEMORY                            [🔍 Search...] [Filter] [Export] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐ ┌────────────────────────────────────────────┐   │
│  │ FOLDERS      │ │ DOCUMENT VIEWER                            │   │
│  │              │ │                                            │   │
│  │ 📁 memory/   │ │ # 2026-02-19 - Thursday                   │   │
│  │   📄 02-19   │ │                                            │   │
│  │   📄 02-18   │ │ ## Daily Self-Audit                       │   │
│  │   📄 02-17   │ │ - 6:30 AM: Daily self-audit in progress   │   │
│  │   📁 agents/ │ │ - All core files verified present (7/7)   │   │
│  │   📁 params/ │ │                                            │   │
│  │              │ │ ## Sessions                                │   │
│  │ 📁 agents/   │ │ - Team expansion implementation...        │   │
│  │   📄 teams   │ │                                            │   │
│  │   📄 phase4  │ │ [Edit] [Add Note] [Export]                │   │
│  │              │ │                                            │   │
│  │ 📄 MEMORY.md │ │                                            │   │
│  └──────────────┘ └────────────────────────────────────────────┘   │
│                                                                     │
│  Recent Searches: "Alex Finn" "Mission Control" "browser save"     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

#### Folder Navigation
- Tree view of `/memory/` directory
- Collapse/expand folders
- File counts per folder

#### Document Viewer
- Markdown rendering with syntax highlighting
- Edit mode (raw markdown)
- Version history (git commits)

#### Global Search
- Full-text search across all `.md` files
- Filters by date range, agent, topic
- Search within specific folders

#### Quick Actions
- Add note to file
- Create new memory file
- Export to PDF/HTML
- Link to task/pipeline item

### Memory Schema

```typescript
interface MemoryFile {
  id: string;
  path: string;           // Relative to /memory/
  name: string;
  type: 'daily' | 'agent' | 'business' | 'project' | 'knowledge';
  content: string;        // Markdown content
  wordCount: number;
  lastModified: Date;
  tags: string[];
  linkedItems: {
    tasks: string[];
    content: string[];
    events: string[];
  };
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/memory` | List memory files |
| GET | `/api/memory/:path*` | Get file content |
| PATCH | `/api/memory/:path*` | Update file |
| POST | `/api/memory` | Create new file |
| DELETE | `/api/memory/:path*` | Delete file |
| GET | `/api/memory/search` | Full-text search |
| GET | `/api/memory/tags` | List all tags |

### Implementation Notes
- Read files directly from `/Users/matt/clawd/memory/` directory
- Use `fs` module for file operations
- Implement search with `ripgrep` or `fuse.js`
- Cache file contents in SQLite for performance

---

## 5. Team Org Chart

### Purpose
Visualize the entire agent hierarchy with roles, status, and relationships.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  TEAM                                          [Active] [All] [Edit]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         ┌─────────────┐                            │
│                         │   SKIPPY 🍺  │                            │
│                         │    CEO      │                            │
│                         │  🟢 Active  │                            │
│                         └──────┬──────┘                            │
│                                │                                    │
│          ┌─────────────────────┼─────────────────────┐             │
│          │                     │                     │             │
│   ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐       │
│   │ DEV MANAGER │      │ MARKETING   │      │ INSIGHTS    │       │
│   │     🔧      │      │ MANAGER 📱  │      │ MANAGER 📊  │       │
│   │    CTO      │      │    CMO      │      │  Analytics  │       │
│   │  🟢 Active  │      │  🟢 Active  │      │  🟢 Active  │       │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘       │
│          │                    │                     │             │
│   ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐       │
│   │ 7 Subagents │      │ 7 Subagents │      │ 4 Subagents │       │
│   │             │      │             │      │             │       │
│   │ 🟢 DevOps   │      │ 🟢 Community│      │ 🟢 Traffic  │       │
│   │ 🟢 Security │      │ 🟢 Analytics│      │   Monitor   │       │
│   │ 🟢 Database │      │ 🟢 Designer │      │             │       │
│   │ ⚪ Frontend │      │ 🟢 SEO      │      │ ⚪ Research │       │
│   │ ⚪ Backend  │      │ ⚪ Research │      │ ⚪ Reporter │       │
│   │ ⚪ QA       │      │ ⚪ Copywrite│      │ ⚪ Data     │       │
│   │ ⚪ RPA      │      │ ⚪ Editor   │      │             │       │
│   └─────────────┘      └─────────────┘      └─────────────┘       │
│                                                                     │
│  Legend: 🟢 Active  ⚪ On-Demand  🔴 Offline                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

#### Hierarchy View
- Expandable tree
- Click manager to see subagent details
- Status indicators for each agent

#### Agent Cards (Expanded View)
```
┌─────────────────────────────────────┐
│  DEV MANAGER 🔧                     │
│  ─────────────────                  │
│  Role: CTO / Tech Lead              │
│  Status: 🟢 Active                  │
│  Discord: 1473422614944022684       │
│  Channel: #dev-manager              │
│                                     │
│  Active Tasks: 3                    │
│  • Database migration (in progress) │
│  • API refactor (planning)          │
│  • Security audit (scheduled)       │
│                                     │
│  Team: 7 subagents (3 active)       │
│  Last Activity: 2 minutes ago       │
│                                     │
│  [View Tasks] [Message] [Spawn]     │
└─────────────────────────────────────┘
```

#### Status Indicators
- 🟢 **Active:** Currently working or recently active (< 5 min)
- 🟡 **Idle:** No activity in last 30 minutes
- ⚪ **On-Demand:** Available to spawn but not currently running
- 🔴 **Offline:** Disconnected or error state

#### Actions
- **View Tasks:** Filter tasks board to this agent
- **Message:** Send Discord message to agent's channel
- **Spawn:** Spawn a new subagent instance
- **Configure:** Edit agent's configuration

### Team Schema

```typescript
interface TeamMember {
  id: string;
  name: string;
  role: string;
  tier: 'boss' | 'manager' | 'subagent';
  icon: string;
  discordId?: string;
  discordChannel?: string;
  status: 'active' | 'idle' | 'on_demand' | 'offline';
  lastActivity: Date;
  managerId?: string;        // For subagents
  subagentType?: string;     // For subagents
  activeTaskCount: number;
  totalTasksCompleted: number;
  spawnCount: number;        // How many times spawned
  memoryFile?: string;       // Path to agent's memory
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/team` | Full team hierarchy |
| GET | `/api/team/:id` | Agent details |
| PATCH | `/api/team/:id` | Update agent config |
| POST | `/api/team/:id/spawn` | Spawn subagent |
| GET | `/api/team/:id/tasks` | Agent's tasks |
| GET | `/api/team/:id/activity` | Activity log |

---

## 6. Office View

### Purpose
Fun, visual representation of agents "working" in a virtual office. Makes the team feel real and provides quick status at a glance.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  OFFICE                                             [Day] [Night]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        🏢 MISSION CONTROL                    │   │
│  │                                                              │   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐              │   │
│  │   │ 🖥️ 🍺   │     │ 🖥️ 🔧   │     │ 🖥️ 📱   │              │   │
│  │   │ Skippy  │     │  Dev    │     │Marketing│              │   │
│  │   │ TYPING  │     │ WORKING │     │ WORKING │              │   │
│  │   └─────────┘     └─────────┘     └─────────┘              │   │
│  │                                                              │   │
│  │   ┌─────────┐     ┌─────────┐     ┌─────────┐              │   │
│  │   │ 🖥️ 📊   │     │ 🖥️ 🔧   │     │ 🖥️ 📱   │              │   │
│  │   │Insights │     │ DevOps  │     │Community│              │   │
│  │   │ WORKING │     │ WORKING │     │ WORKING │              │   │
│  │   └─────────┘     └─────────┘     └─────────┘              │   │
│  │                                                              │   │
│  │   ┌─────────┐     ┌─────────┐                               │   │
│  │   │ 🖥️ 🔧   │     │ 🖥️ 📱   │     [Empty Desk]             │   │
│  │   │ Security│     │  SEO    │                               │   │
│  │   │ WORKING │     │ IDLE    │                               │   │
│  │   └─────────┘     └─────────┘                               │   │
│  │                                                              │   │
│  │   🛋️ [Matt's Chair - Empty]                                  │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Status: 8 agents active, 10 on-demand                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

#### Desk Representation
Each agent has a "desk" with:
- Computer monitor showing activity
- Avatar icon
- Name plate
- Status indicator

#### Activity Animation
- **Typing:** Avatar animated, keyboard sounds
- **Working:** Screen glow, progress indicator
- **Idle:** Avatar leaning back, coffee cup
- **Sleeping:** Avatar with Z's (offline/on-demand)

#### Day/Night Mode
- **Day:** Bright office, natural lighting
- **Night:** Dark office, monitor glow, city lights outside window

#### Click Interactions
- Click desk → Show agent's current task
- Click avatar → Open agent profile
- Click monitor → See what they're working on
- Click empty desk → Spawn new subagent

#### Sound Effects (Optional)
- Keyboard typing
- Mouse clicks
- Coffee machine
- Notification chimes

### Agent Desk Component

```typescript
interface AgentDesk {
  agent: TeamMember;
  position: { x: number; y: number };
  monitor: {
    content: string;        // What's on screen
    progress?: number;      // 0-100 if applicable
  };
  animation: {
    type: 'typing' | 'working' | 'idle' | 'sleeping';
    since: Date;
  };
  ambiance: {
    coffeeCup: boolean;
    plant: boolean;
    figurines: string[];
  };
}
```

### Room Layout

```
┌────────────────────────────────────────┐
│  [WINDOW - Day/Night sky]              │
├────────────────────────────────────────┤
│                                        │
│  [SKIPPY DESK]  [DEV DESK]  [MKT DESK] │
│                                        │
│  [INSIGHTS DESK]  [DESK]  [DESK]       │
│                                        │
│  [DESK]  [DESK]  [DESK]  [DESK]        │
│                                        │
├────────────────────────────────────────┤
│  [LOUNGE AREA - Matt's chair]          │
│  🛋️  ☕  📰                           │
└────────────────────────────────────────┘
```

### Implementation Notes
- Use CSS animations for avatar states
- Canvas-based rendering for performance (many agents)
- Sound effects with Howler.js or Web Audio API
- Day/night cycle synced to real time
- Persistent desk assignments in localStorage

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up Next.js app structure
- [ ] Create shared UI components
- [ ] Implement SQLite + PostgreSQL sync
- [ ] Build base layout with navigation

### Phase 2: Core Screens (Week 2)
- [ ] Enhance Tasks Board with tier system
- [ ] Build Content Pipeline Kanban
- [ ] Implement Calendar with cron sync

### Phase 3: Advanced Features (Week 3)
- [ ] Build Memory Browser with search
- [ ] Create Team Org Chart
- [ ] Implement Office View

### Phase 4: Polish & Integration (Week 4)
- [ ] Add animations and transitions
- [ ] Implement SSE for real-time updates
- [ ] Add sound effects (Office View)
- [ ] Mobile responsive design
- [ ] Testing and bug fixes

---

## Technical Specifications

### Database Schema

```sql
-- Tasks (extended)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tier TEXT CHECK(tier IN ('skippy', 'manager', 'subagent')),
  manager_id TEXT,
  subagent_type TEXT,
  assignee TEXT NOT NULL,
  status TEXT DEFAULT 'backlog',
  priority TEXT DEFAULT 'p3',
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Content Pipeline
CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  platform TEXT NOT NULL,
  stage TEXT DEFAULT 'idea',
  content JSON,
  research JSON,
  schedule JSON,
  analysis JSON,
  assigned_to TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME
);

-- Calendar Events
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start DATETIME NOT NULL,
  end DATETIME,
  all_day BOOLEAN DEFAULT 0,
  type TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  agent_tier TEXT,
  agent_name TEXT,
  status TEXT DEFAULT 'scheduled',
  recurring JSON
);

-- Team Members
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  tier TEXT NOT NULL,
  icon TEXT,
  discord_id TEXT,
  discord_channel TEXT,
  status TEXT DEFAULT 'on_demand',
  last_activity DATETIME,
  manager_id TEXT,
  subagent_type TEXT,
  active_task_count INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  spawn_count INTEGER DEFAULT 0,
  memory_file TEXT
);

-- Memory Files (cached)
CREATE TABLE memory_files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  content TEXT,
  word_count INTEGER,
  last_modified DATETIME,
  tags JSON,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Component Structure

```
src/components/
├── tasks/
│   ├── TaskBoard.tsx
│   ├── TaskCard.tsx
│   ├── TaskColumn.tsx
│   ├── TaskModal.tsx
│   └── TaskFilters.tsx
├── pipeline/
│   ├── PipelineBoard.tsx
│   ├── PipelineCard.tsx
│   ├── PipelineStage.tsx
│   ├── ContentEditor.tsx
│   └── QuickCapture.tsx
├── calendar/
│   ├── CalendarView.tsx
│   ├── EventCard.tsx
│   ├── DayView.tsx
│   ├── WeekView.tsx
│   └── MonthView.tsx
├── memory/
│   ├── MemoryBrowser.tsx
│   ├── FileTree.tsx
│   ├── DocumentViewer.tsx
│   ├── SearchBar.tsx
│   └── EditModal.tsx
├── team/
│   ├── OrgChart.tsx
│   ├── AgentCard.tsx
│   ├── SubagentList.tsx
│   └── AgentModal.tsx
├── office/
│   ├── OfficeView.tsx
│   ├── AgentDesk.tsx
│   ├── MonitorDisplay.tsx
│   └── AmbientSound.tsx
└── shared/
    ├── Layout.tsx
    ├── Navigation.tsx
    ├── StatusBadge.tsx
    └── LoadingSpinner.tsx
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Page Load Time | < 2 seconds |
| Search Response | < 500ms |
| Real-time Update Latency | < 1 second |
| Memory File Index Time | < 5 seconds (all files) |
| Calendar Sync Time | < 3 seconds |
| Mobile Usability Score | > 90 |

---

## Appendix A: Agent Icons

| Agent | Icon | Color |
|-------|------|-------|
| Skippy | 🍺 | Gold |
| Dev Manager | 🔧 | Blue |
| Marketing Manager | 📱 | Green |
| Insights Manager | 📊 | Purple |
| DevOps/SRE | ⚙️ | Blue |
| Security Engineer | 🔒 | Blue |
| Database Admin | 🗄️ | Blue |
| Community Manager | 💬 | Green |
| Analytics Specialist | 📈 | Green |
| Graphic Designer | 🎨 | Green |
| SEO Specialist | 🔍 | Green |
| TrafficDriver Monitor | 📡 | Purple |

---

## Appendix B: Color Palette

```css
/* Primary Colors */
--skippy-gold: #FFD700;
--dev-blue: #3B82F6;
--marketing-green: #10B981;
--insights-purple: #8B5CF6;

/* Status Colors */
--active: #22C55E;
--idle: #F59E0B;
--on-demand: #6B7280;
--offline: #EF4444;

/* Background */
--bg-primary: #0F172A;
--bg-secondary: #1E293B;
--bg-tertiary: #334155;

/* Text */
--text-primary: #F8FAFC;
--text-secondary: #94A3B8;
--text-muted: #64748B;
```

---

**End of Specification Document**

*Generated by Skippy the Magnificent*
*Implementation by Dev Manager*
