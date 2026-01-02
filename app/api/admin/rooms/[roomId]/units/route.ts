import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    const units = await db.roomUnit.findMany({
      where: { roomTypeId: roomId },
      orderBy: { number: 'asc' }
    });

    return NextResponse.json({ units });
  } catch (error) {
    console.error('Error fetching room units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room units' },
      { status: 500 }
    );
  }
}
