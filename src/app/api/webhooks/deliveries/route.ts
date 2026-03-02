/**
 * Webhook Deliveries API
 * 
 * GET: Get delivery history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryHistory } from '@/lib/webhooks';

// GET /api/webhooks/deliveries - Get delivery history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhookId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    const deliveries = await getDeliveryHistory(webhookId, limit);

    return NextResponse.json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (error) {
    console.error('Failed to get delivery history:', error);
    return NextResponse.json({ 
      error: 'Failed to get delivery history' 
    }, { status: 500 });
  }
}
