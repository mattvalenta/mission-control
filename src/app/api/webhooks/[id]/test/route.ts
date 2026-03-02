/**
 * Test Webhook API
 * 
 * POST: Test a webhook by sending a test payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { testWebhook } from '@/lib/webhooks';

// POST /api/webhooks/[id]/test - Test webhook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await testWebhook(id);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook test successful',
      responseCode: result.responseCode,
    });
  } catch (error) {
    console.error('Failed to test webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to test webhook' 
    }, { status: 500 });
  }
}
