import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// In-memory rate limiting (once per minute)
let lastReindex = 0;
const RATE_LIMIT_MS = 60_000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Check token
  if (token !== process.env.REINDEX_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  const now = Date.now();
  if (now - lastReindex < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastReindex)) / 1000);
    return NextResponse.json(
      { error: `Rate limited. Try again in ${waitSec}s.` },
      { status: 429 }
    );
  }

  // Run seed script
  try {
    lastReindex = now;
    const { stdout, stderr } = await execAsync('node data/seed.mjs --skip-geocode');
    return NextResponse.json({
      success: true,
      message: 'Reindex complete',
      output: stdout,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Reindex failed', details: error.message },
      { status: 500 }
    );
  }
}
