import { NextRequest, NextResponse } from 'next/server';
import { downloadTokens } from '../tokenStorage';
import { aliases, normalizeAlias, isValidAlias } from '../aliasStorage';
import { apiRateLimiter, checkRateLimit } from '../rateLimiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(apiRateLimiter, request);
    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.retryAfter || 60;
      return NextResponse.json(
        { error: 'Rate limit exceeded.', retryAfter },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const aliasRaw = String((body as any).alias || '').trim();
    const token = String((body as any).token || '').trim();
    if (!aliasRaw || !token) {
      return NextResponse.json({ error: 'alias and token are required' }, { status: 400 });
    }

    const alias = normalizeAlias(aliasRaw);
    if (!isValidAlias(alias)) {
      return NextResponse.json({ error: 'Invalid alias format' }, { status: 400 });
    }

    // Ensure token exists and is not expired
    const tokenData = await downloadTokens.get(token);
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid download token' }, { status: 404 });
    }
    if (Date.now() > tokenData.expiresAt) {
      await downloadTokens.delete(token);
      return NextResponse.json({ error: 'Download token has expired' }, { status: 410 });
    }

    // Check collisions with tokens and existing aliases
    const tokenCollision = await downloadTokens.get(alias);
    const aliasCollision = await aliases.get(alias);
    if (tokenCollision || aliasCollision) {
      return NextResponse.json({ error: 'Alias already in use' }, { status: 409 });
    }

    await aliases.set(alias, token);

    const forwardedProto = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
    const host = request.headers.get('host') || request.nextUrl.host;
    const aliasUrl = `${protocol}://${host}/download/${alias}`;

    return NextResponse.json({ success: true, alias, aliasUrl }, { status: 201 });
  } catch (error) {
    console.error('Alias creation error:', error);
    return NextResponse.json({ error: 'Failed to create alias' }, { status: 500 });
  }
}

