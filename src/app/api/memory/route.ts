import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/Users/openclawserver4/.openclaw/workspace';

/**
 * GET /api/memory
 * List memory files from workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get('agent');
    const search = searchParams.get('search');

    // If search query provided, search in files
    if (search) {
      const results = await searchFiles(search, agent || undefined);
      return NextResponse.json({ success: true, results, count: results.length });
    }

    // List files by agent
    const files = await listMemoryFiles(agent || undefined);
    return NextResponse.json({ success: true, files, count: files.length });
  } catch (error) {
    console.error('Failed to list memory files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

/**
 * List memory files from workspace
 */
async function listMemoryFiles(agent?: string): Promise<{ agent: string; filename: string; path: string; size: number; modified: string }[]> {
  const files: { agent: string; filename: string; path: string; size: number; modified: string }[] = [];
  
  const agents = agent ? [agent] : ['skippy', 'dev-manager', 'marketing-manager', 'insights-manager'];
  
  for (const agentName of agents) {
    const agentPath = path.join(WORKSPACE_PATH, 'agents', agentName.replace('-manager', '-mgr'));
    
    if (fs.existsSync(agentPath)) {
      const agentFiles = fs.readdirSync(agentPath).filter(f => f.endsWith('.md'));
      
      for (const filename of agentFiles) {
        const filePath = path.join(agentPath, filename);
        const stats = fs.statSync(filePath);
        
        files.push({
          agent: agentName,
          filename,
          path: filePath.replace(WORKSPACE_PATH, ''),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }
    
    // Also check root workspace for agent files
    const rootFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md'];
    for (const filename of rootFiles) {
      const filePath = path.join(WORKSPACE_PATH, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        files.push({
          agent: 'workspace',
          filename,
          path: filename,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }
  }
  
  return files;
}

/**
 * Search for text in memory files
 */
async function searchFiles(query: string, agent?: string): Promise<{ agent: string; filename: string; path: string; matches: string[] }[]> {
  const results: { agent: string; filename: string; path: string; matches: string[] }[] = [];
  const queryLower = query.toLowerCase();
  
  const files = await listMemoryFiles(agent);
  
  for (const file of files) {
    const filePath = path.join(WORKSPACE_PATH, file.path);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: string[] = [];
      
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(queryLower)) {
          matches.push(`L${i + 1}: ${line.trim().substring(0, 100)}`);
        }
      });
      
      if (matches.length > 0) {
        results.push({
          agent: file.agent,
          filename: file.filename,
          path: file.path,
          matches: matches.slice(0, 10), // Limit to 10 matches per file
        });
      }
    }
  }
  
  return results;
}
