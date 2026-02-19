import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/Users/openclawserver4/.openclaw/workspace';

/**
 * GET /api/memory/[...path]
 * Get file contents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = path.join(WORKSPACE_PATH, ...pathSegments);
    
    // Security: ensure path is within workspace
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(WORKSPACE_PATH)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const stats = fs.statSync(resolvedPath);
    
    return NextResponse.json({
      success: true,
      file: {
        path: pathSegments.join('/'),
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to read file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

/**
 * PATCH /api/memory/[...path]
 * Update file contents
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const body = await request.json();
    const { content } = body;
    
    if (content === undefined) {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }
    
    const filePath = path.join(WORKSPACE_PATH, ...pathSegments);
    
    // Security: ensure path is within workspace
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(WORKSPACE_PATH)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Create directory if needed
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(resolvedPath, content, 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: 'File updated',
      path: pathSegments.join('/'),
    });
  } catch (error) {
    console.error('Failed to update file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}
