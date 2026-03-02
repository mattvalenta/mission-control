import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, run } from '@/lib/db';
import type { PlanningQuestion } from '@/lib/types';

function generateSpecMarkdown(task: { title: string; description?: string }, questions: PlanningQuestion[]): string {
  const lines: string[] = [];
  lines.push(`# ${task.title}`, '', '**Status:** SPEC LOCKED ✅', '');
  if (task.description) lines.push('## Original Request', task.description, '');

  const byCategory = questions.reduce((acc, q) => { acc[q.category] = acc[q.category] || []; acc[q.category].push(q); return acc; }, {} as Record<string, PlanningQuestion[]>);
  const categoryLabels: Record<string, string> = { goal: '🎯 Goal', audience: '👥 Audience', scope: '📋 Scope', design: '🎨 Design', content: '📝 Content', technical: '⚙️ Technical', timeline: '📅 Timeline', constraints: '⚠️ Constraints' };

  for (const [category, label] of Object.entries(categoryLabels)) {
    const qs = byCategory[category];
    if (!qs?.length) continue;
    lines.push(`## ${label}`, '');
    for (const q of qs) { if (q.answer) lines.push(`**${q.question}**`, `> ${q.answer}`, ''); }
  }
  lines.push('---', `*Spec locked at ${new Date().toISOString()}*`);
  return lines.join('\n');
}

// POST /api/tasks/[id]/planning/approve - Lock spec and move to inbox
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const existingSpec = await queryOne('SELECT * FROM planning_specs WHERE task_id = $1', [taskId]);
    if (existingSpec) return NextResponse.json({ error: 'Spec already locked' }, { status: 400 });

    const questions = await queryAll<PlanningQuestion>('SELECT * FROM planning_questions WHERE task_id = $1 ORDER BY sort_order', [taskId]);
    const unanswered = questions.filter(q => !q.answer);
    if (unanswered.length > 0) return NextResponse.json({ error: 'All questions must be answered', unanswered: unanswered.length }, { status: 400 });

    const parsedQuestions = questions.map(q => ({ ...q, options: q.options ? JSON.parse(q.options as any) : undefined }));
    const specMarkdown = generateSpecMarkdown(task, parsedQuestions);

    const specId = crypto.randomUUID();
    await run(`INSERT INTO planning_specs (id, task_id, spec_markdown, locked_at) VALUES ($1, $2, $3, NOW())`,
      [specId, taskId, specMarkdown]);

    await run(`UPDATE tasks SET description = $1, status = 'inbox', updated_at = NOW() WHERE id = $2`, [specMarkdown, taskId]);
    await run(`INSERT INTO task_activities (id, task_id, activity_type, message, created_at) VALUES ($1, $2, 'status_changed', 'Planning complete - spec locked', NOW())`,
      [crypto.randomUUID(), taskId]);

    const spec = await queryOne('SELECT * FROM planning_specs WHERE id = $1', [specId]);
    return NextResponse.json({ success: true, spec, specMarkdown });
  } catch (error) {
    console.error('Failed to approve spec:', error);
    return NextResponse.json({ error: 'Failed to approve spec' }, { status: 500 });
  }
}
