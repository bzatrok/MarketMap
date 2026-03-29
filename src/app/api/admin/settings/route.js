import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getAllSettings, setSettings } from '@/lib/settings';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = getAllSettings();
  return NextResponse.json(settings);
}

export async function PUT(request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  setSettings(body);
  return NextResponse.json({ success: true });
}
