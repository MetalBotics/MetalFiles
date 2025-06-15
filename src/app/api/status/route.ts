import { NextRequest, NextResponse } from 'next/server';
import { downloadTokens } from '../tokenStorage';

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    let totalFiles = 0;
    let expiredFiles = 0;
    let validFiles = 0;
    const files: Array<{
      originalName: string;
      size: number;
      expiresAt: string;
      isExpired: boolean;
      timeRemaining: string;
    }> = [];
    
    const validTokens: Array<{
      id: string;
      fileName: string;
      downloadUrl: string;
      expiresAt: string;
      token: string;
    }> = [];

    const entries = await downloadTokens.entries();
    for (const [token, data] of entries) {
      totalFiles++;
      const isExpired = now > data.expiresAt;
      
      if (isExpired) {
        expiredFiles++;
      } else {
        validFiles++;        // Add to valid tokens for download URLs
        validTokens.push({
          id: token, // Use token directly as ID for consistency
          fileName: data.originalName,
          downloadUrl: `/download/${token}`,
          expiresAt: new Date(data.expiresAt).toISOString(),
          token: token
        });
      }

      const timeRemaining = isExpired 
        ? 'Expired' 
        : `${Math.round((data.expiresAt - now) / (1000 * 60 * 60))} hours`;

      files.push({
        originalName: data.originalName,
        size: data.size,
        expiresAt: new Date(data.expiresAt).toISOString(),
        isExpired,
        timeRemaining
      });
    }    return NextResponse.json({
      success: true,
      stats: {
        totalFiles,
        validFiles,
        expiredFiles
      },
      files: files.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)),
      validTokens: validTokens.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    });
  } catch (error) {
    console.error('Error getting file status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get file status'
    }, { status: 500 });
  }
}
