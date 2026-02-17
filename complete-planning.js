const Database = require('better-sqlite3');
const db = new Database('/Users/matt/clawd/mission-control/mission-control.db');

// Get the task
const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('52a880bf-12f6-42a1-99a4-3338cdbf085e');
const messages = JSON.parse(task.planning_messages);

// Find the completion message
const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
const content = lastAssistant.content;

// Extract JSON from code block
const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
if (!jsonMatch) {
  console.log('No JSON found');
  process.exit(1);
}

let jsonStr = jsonMatch[1];

// Use a more robust approach - find and extract key parts
// Find the status
const statusMatch = jsonStr.match(/"status":\s*"complete"/);
if (!statusMatch) {
  console.log('Not a completion message');
  process.exit(1);
}

console.log('Status: complete');

// Extract spec using regex
const specMatch = jsonStr.match(/"spec":\s*\{([\s\S]*?)\n  \},?\n  "agents"/);
let spec = {};
if (specMatch) {
  try {
    spec = JSON.parse('{' + specMatch[1] + '}');
  } catch (e) {
    console.log('Could not parse spec, using default');
    spec = {
      title: "Test Task: Mission Control Integration",
      summary: "Execute a full pipeline smoke test"
    };
  }
}
console.log('Spec title:', spec.title || 'N/A');

// Extract agents array
const agentsMatch = jsonStr.match(/"agents":\s*\[([\s\S]*?)\n  \]/);
let agents = [];
if (agentsMatch) {
  // Find each agent object
  const agentObjects = agentsMatch[1].match(/\{[^{}]*"name"[^{}]*\}/g) || [];
  for (const agentStr of agentObjects) {
    try {
      // Fix any malformed JSON in agent object
      const fixed = agentStr
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/"([^"]+)":\s*"[^"]*"/g, (m) => m); // Keep valid string pairs
      const agent = JSON.parse(fixed);
      agents.push({
        name: agent.name || 'Agent',
        role: agent.role || 'Agent',
        avatar_emoji: agent.avatar_emoji || '🤖',
        soul_md: agent.soul_md || '',
        instructions: agent.instructions || ''
      });
    } catch (e) {
      // Try to extract just the name
      const nameMatch = agentStr.match(/"name":\s*"([^"]+)"/);
      if (nameMatch) {
        agents.push({
          name: nameMatch[1],
          role: 'Agent',
          avatar_emoji: '🤖',
          soul_md: '',
          instructions: ''
        });
      }
    }
  }
}

console.log('Agents:', agents.map(a => a.name).join(', '));

// Update task
db.prepare(`
  UPDATE tasks SET 
    planning_complete = 1,
    planning_spec = ?,
    planning_agents = ?,
    status = 'inbox'
  WHERE id = ?
`).run(JSON.stringify(spec), JSON.stringify(agents), '52a880bf-12f6-42a1-99a4-3338cdbf085e');

// Create agents
for (const agent of agents) {
  const agentId = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO agents (id, workspace_id, name, role, description, avatar_emoji, status, soul_md, created_at, updated_at)
      VALUES (?, 'default', ?, ?, '', ?, 'standby', ?, datetime('now'), datetime('now'))
    `).run(agentId, agent.name, agent.role, agent.avatar_emoji || '🤖', agent.soul_md || '');
    console.log('Created agent:', agent.name, agentId);
    
    // Assign first agent to task
    if (agents[0] === agent) {
      db.prepare('UPDATE tasks SET assigned_agent_id = ? WHERE id = ?').run(agentId, '52a880bf-12f6-42a1-99a4-3338cdbf085e');
      console.log('Assigned to task');
    }
  } catch (e) {
    console.log('Error creating agent:', agent.name, e.message);
  }
}

console.log('Done!');
