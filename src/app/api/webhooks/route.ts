/**
 * Webhooks API
 * 
 * GET: List all webhooks
 * POST: Create a webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebhooks, createWebhook } from '@/lib/webhooks';

// GET /api/webhooks - List all webhooks
export async function GET() {
  try {
    const webhooks = await getWebhooks();

    return NextResponse.json({
      success: true,
      webhooks,
      count: webhooks.length,
    });
  } catch (error) {
    console.error('Failed to get webhooks:', error);
    return NextResponse.json({ 
      error: 'Failed to get webhooks' 
    }, { status: 500 });
  }
}

// POST /api/webhooks - Create a webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, secret, events, enabled } = body;

    if (!name || !url || !events || !Array.isArray(events)) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, url, events' 
      }, { status: 400 });
    }

    const webhook = await createWebhook({
      name,
      url,
      secret,
      events,
      enabled,
    });

    return NextResponse.json({
      success: true,
      webhook,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to create webhook' 
    }, { status: 500 });
  }
}
