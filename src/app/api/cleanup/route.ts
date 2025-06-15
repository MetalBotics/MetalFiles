import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredTokens } from '../tokenStorage';

export async function POST(request: NextRequest) {
  try {
    console.log('Manual cleanup triggered');
    const deletedCount = await cleanupExpiredTokens();
    
    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletedCount} expired files removed`,
      deletedCount
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed'
    }, { status: 500 });
  }
}

// GET endpoint for manual cleanup via browser
export async function GET(request: NextRequest) {
  return POST(request);
}
