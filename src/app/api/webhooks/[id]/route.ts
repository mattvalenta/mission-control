/**
 * Webhook by ID API
 * 
 * GET: Get webhook details
 * PATCH: Update webhook
 * DELETE: Delete webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebhook, updateWebhook, deleteWebhook } from '@/lib/webhooks';

// GET /api/webhooks/[id] - Get webhook details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const webhook = await getWebhook(id);

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error) {
    console.error('Failed to get webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to get webhook' 
    }, { status: 500 });
  }
}

// PATCH /api/webhooks/[id] - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, url, secret, events, enabled } = body;

    const webhook = await updateWebhook(id, {
      name,
      url,
      secret,
      events,
      enabled,
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error) {
    console.error('Failed to update webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to update webhook' 
    }, { status: 500 });
  }
}

// DELETE /api/webhooks/[id] - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteWebhook(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted',
    });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to delete webhook' 
    }, { status: 500 });
  }
}
