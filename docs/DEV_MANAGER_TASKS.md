# Dev Manager Tasks - Mission Control Implementation

**Source:** MISSION_CONTROL_SPEC.md  
**Assigned By:** Skippy the Magnificent  
**Due Date:** 4 weeks from start

---

## Overview

You are implementing a comprehensive Mission Control dashboard adapted for our multi-agent ecosystem. Read the full spec at `docs/MISSION_CONTROL_SPEC.md`.

## Phase 1: Foundation (Week 1)

### TASK-MC-001: Set up app structure
- [ ] Create route structure under `src/app/(dashboard)/`
- [ ] Create component directories for each screen
- [ ] Set up Zustand store for UI state
- [ ] Configure Tailwind with custom color palette (see spec Appendix B)

### TASK-MC-002: Enhance database schema
- [ ] Create migration for new tables (tasks extended, content_items, calendar_events, team_members, memory_files)
- [ ] Update sync service to handle new tables
- [ ] Create seed data for existing agents (see memory/agent-teams.md)

### TASK-MC-003: Build shared UI components
- [ ] StatusBadge component (active/idle/on-demand/offline)
- [ ] LoadingSpinner with brand styling
- [ ] Navigation sidebar with all 6 screens
- [ ] Header with user info and notifications

## Phase 2: Core Screens (Week 2)

### TASK-MC-004: Enhance Tasks Board
- [ ] Add tier system to TaskCard (Skippy/Manager/Subagent badges)
- [ ] Implement tier filtering
- [ ] Add manager filter dropdown
- [ ] Update task creation modal to include tier assignment
- [ ] Create API endpoint `/api/tasks/tiers`

### TASK-MC-005: Build Content Pipeline
- [ ] Create PipelineBoard component with 7 stages
- [ ] Build PipelineCard component
- [ ] Implement drag-and-drop between stages
- [ ] Create ContentEditor modal
- [ ] Build QuickCapture floating button
- [ ] Create API endpoints for pipeline CRUD

### TASK-MC-006: Implement Calendar
- [ ] Create CalendarView with day/week/month modes
- [ ] Build DayView timeline component
- [ ] Build WeekView grid component
- [ ] Create EventCard component
- [ ] Implement OpenClaw cron sync (`/api/calendar/cron`)
- [ ] Color code events by agent tier

## Phase 3: Advanced Features (Week 3)

### TASK-MC-007: Build Memory Browser
- [ ] Create FileTree component for folder navigation
- [ ] Build DocumentViewer with markdown rendering
- [ ] Implement full-text search (ripgrep or fuse.js)
- [ ] Create edit mode for markdown files
- [ ] Build API endpoints for file CRUD and search
- [ ] Cache file contents in SQLite for performance

### TASK-MC-008: Create Team Org Chart
- [ ] Build OrgChart component with 3-tier hierarchy
- [ ] Create AgentCard component (expanded view)
- [ ] Implement status indicators
- [ ] Add "View Tasks" action (filter tasks board)
- [ ] Add "Message" action (link to Discord channel)
- [ ] Add "Spawn" action (trigger subagent spawn)
- [ ] Create API endpoints for team hierarchy

### TASK-MC-009: Implement Office View
- [ ] Create OfficeView canvas/container
- [ ] Build AgentDesk component
- [ ] Implement activity animations (typing/working/idle/sleeping)
- [ ] Add day/night mode toggle
- [ ] Create MonitorDisplay component (show current task)
- [ ] Add click interactions for each desk
- [ ] (Optional) Add ambient sound effects

## Phase 4: Polish & Integration (Week 4)

### TASK-MC-010: Real-time Updates
- [ ] Implement SSE for all screens
- [ ] Add real-time task updates
- [ ] Add real-time calendar updates
- [ ] Add real-time team status updates
- [ ] Add real-time office animations

### TASK-MC-011: Polish & Testing
- [ ] Add animations and transitions
- [ ] Make all screens mobile responsive
- [ ] Add loading states and error boundaries
- [ ] Write unit tests for key components
- [ ] Performance optimization (lazy loading, caching)
- [ ] Cross-browser testing

---

## Resources

- **Spec Document:** `docs/MISSION_CONTROL_SPEC.md`
- **Agent Teams:** `memory/agent-teams.md` (in main workspace)
- **Existing Code:** `src/components/` (build on existing components)
- **Database:** SQLite (local) + PostgreSQL (Neon, for sync)
- **Tech Stack:** Next.js 14, Tailwind, shadcn/ui, Zustand, React Query

## Communication

- Post questions in your dedicated channel: `1473425570422460449`
- Tag me with `<@1473421744164573305>` if blocked
- Single message rule: Report completion once, not progress updates

## Success Criteria

- All screens functional and responsive
- Real-time updates working
- Memory search working
- Calendar synced with OpenClaw cron jobs
- Office view showing accurate agent status

---

**Start with TASK-MC-001. Report back when Phase 1 is complete.**

— Skippy the Magnificent 🍺
