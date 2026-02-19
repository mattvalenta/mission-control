import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index';

/**
 * Seed team members for the Mission Control org chart
 */
export function seedTeamMembers() {
  const db = getDb();
  const now = new Date().toISOString();

  // Check if team_members already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM team_members').get() as { count: number };
  if (existing.count > 0) {
    console.log('[Seed] Team members already seeded, skipping...');
    return;
  }

  console.log('[Seed] Seeding team members...');

  // Skippy (CEO)
  const skippyId = 'skippy-001';
  db.prepare(`
    INSERT INTO team_members (id, name, tier, role, status, discord_id, avatar_emoji, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(skippyId, 'Skippy', 'skippy', 'CEO Agent', 'active', '1473421744164573305', '🍺', now, now);

  // Managers
  const managers = [
    { id: 'dev-manager-001', name: 'Dev Manager', role: 'CTO/Tech Lead', discord_id: '1473422614944022684', emoji: '💻' },
    { id: 'marketing-manager-001', name: 'Marketing Manager', role: 'Marketing Lead', discord_id: '1473422881118748923', emoji: '📱' },
    { id: 'insights-manager-001', name: 'Insights Manager', role: 'Analytics Lead', discord_id: '1473423045128360050', emoji: '📊' },
  ];

  for (const manager of managers) {
    db.prepare(`
      INSERT INTO team_members (id, name, tier, role, manager_id, status, discord_id, avatar_emoji, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(manager.id, manager.name, 'manager', manager.role, skippyId, 'active', manager.discord_id, manager.emoji, now, now);
  }

  // Dev Manager Subagents
  const devSubagents = [
    { id: 'frontend-dev-001', name: 'Frontend Dev', role: 'UI Developer', emoji: '🎨' },
    { id: 'backend-dev-001', name: 'Backend Dev', role: 'API Developer', emoji: '📝' },
    { id: 'qa-agent-001', name: 'QA Agent', role: 'Testing', emoji: '🔍' },
    { id: 'rpa-dev-001', name: 'RPA Developer', role: 'Automation', emoji: '🤖' },
  ];

  for (const subagent of devSubagents) {
    db.prepare(`
      INSERT INTO team_members (id, name, tier, role, manager_id, status, avatar_emoji, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subagent.id, subagent.name, 'subagent', subagent.role, 'dev-manager-001', 'on-demand', subagent.emoji, now, now);
  }

  // Marketing Manager Subagents
  const marketingSubagents = [
    { id: 'researcher-001', name: 'Researcher', role: 'Content Research', emoji: '🔬' },
    { id: 'copywriter-001', name: 'Copywriter', role: 'Content Writing', emoji: '✍️' },
    { id: 'editor-001', name: 'Editor', role: 'Content Editing', emoji: '📖' },
    { id: 'community-mgr-001', name: 'Community Manager', role: 'Social Engagement', emoji: '💬' },
  ];

  for (const subagent of marketingSubagents) {
    db.prepare(`
      INSERT INTO team_members (id, name, tier, role, manager_id, status, avatar_emoji, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subagent.id, subagent.name, 'subagent', subagent.role, 'marketing-manager-001', 'on-demand', subagent.emoji, now, now);
  }

  // Insights Manager Subagents
  const insightsSubagents = [
    { id: 'data-analyst-001', name: 'Data Analyst', role: 'Analytics', emoji: '📈' },
    { id: 'report-agent-001', name: 'Report Agent', role: 'Reporting', emoji: '📋' },
  ];

  for (const subagent of insightsSubagents) {
    db.prepare(`
      INSERT INTO team_members (id, name, tier, role, manager_id, status, avatar_emoji, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subagent.id, subagent.name, 'subagent', subagent.role, 'insights-manager-001', 'on-demand', subagent.emoji, now, now);
  }

  console.log('[Seed] Team members seeded successfully');
}

/**
 * Seed sample content items for the pipeline
 */
export function seedContentItems() {
  const db = getDb();
  const now = new Date().toISOString();

  // Check if content_items already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM content_items').get() as { count: number };
  if (existing.count > 0) {
    console.log('[Seed] Content items already seeded, skipping...');
    return;
  }

  console.log('[Seed] Seeding sample content items...');

  const items = [
    { id: uuidv4(), title: 'LinkedIn carousel: AI tools for dealers', type: 'carousel', platform: 'linkedin', stage: 'idea', assigned_to: 'Marketing Manager' },
    { id: uuidv4(), title: 'X thread: Voice AI trends 2026', type: 'x_thread', platform: 'x', stage: 'research', assigned_to: 'Researcher' },
    { id: uuidv4(), title: 'Blog: Getting started with Mission Control', type: 'blog', platform: 'linkedin', stage: 'draft', assigned_to: 'Copywriter' },
    { id: uuidv4(), title: 'LinkedIn post: Product update', type: 'linkedin_post', platform: 'linkedin', stage: 'schedule', assigned_to: 'Marketing Manager' },
  ];

  for (const item of items) {
    db.prepare(`
      INSERT INTO content_items (id, title, type, platform, stage, assigned_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.title, item.type, item.platform, item.stage, item.assigned_to, now, now);
  }

  console.log('[Seed] Content items seeded successfully');
}

/**
 * Seed sample calendar events
 */
export function seedCalendarEvents() {
  const db = getDb();
  const now = new Date();

  // Check if calendar_events already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM calendar_events').get() as { count: number };
  if (existing.count > 0) {
    console.log('[Seed] Calendar events already seeded, skipping...');
    return;
  }

  console.log('[Seed] Seeding sample calendar events...');

  // Create events for the next 7 days
  const events = [
    { title: 'Daily Tech Brief', type: 'cron', tier: 'skippy', agent_name: 'Skippy', hour: 6, color: '#FFD700' },
    { title: 'Daily Self-Audit', type: 'cron', tier: 'manager', agent_name: 'Dev Manager', hour: 6, minute: 30, color: '#3B82F6' },
    { title: 'Daily Auto-Update', type: 'cron', tier: 'manager', agent_name: 'Dev Manager', hour: 7, color: '#3B82F6' },
    { title: 'Daily Security Audit', type: 'cron', tier: 'manager', agent_name: 'Dev Manager', hour: 9, color: '#3B82F6' },
    { title: 'Weekly Report', type: 'reminder', tier: 'skippy', agent_name: 'Skippy', hour: 17, color: '#FFD700' },
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() + dayOffset);

    for (const event of events) {
      const eventTime = new Date(eventDate);
      eventTime.setHours(event.hour, event.minute || 0, 0, 0);

      const endTime = new Date(eventTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      db.prepare(`
        INSERT INTO calendar_events (id, title, type, tier, agent_id, agent_name, start_time, end_time, color, recurring, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        event.title,
        event.type,
        event.tier,
        event.tier === 'skippy' ? 'skippy-001' : 'dev-manager-001',
        event.agent_name,
        eventTime.toISOString(),
        endTime.toISOString(),
        event.color,
        JSON.stringify({ frequency: 'daily', interval: 1 }),
        now.toISOString()
      );
    }
  }

  console.log('[Seed] Calendar events seeded successfully');
}

/**
 * Run all Mission Control seeds
 */
export function seedMissionControl() {
  console.log('[Seed] Seeding Mission Control data...');
  seedTeamMembers();
  seedContentItems();
  seedCalendarEvents();
  console.log('[Seed] Mission Control seeding complete');
}
