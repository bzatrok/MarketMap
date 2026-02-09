import client from '@/lib/meilisearch';
import { buildFilterArray } from '@/lib/filters';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get('q') || '';
  const days = searchParams.get('days')?.split(',').filter(Boolean) || [];
  const province = searchParams.get('province') || '';
  const type = searchParams.get('type') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);

  const filter = buildFilterArray({ days, province, type });

  const index = client.index('markets');
  const results = await index.search(q, {
    filter,
    limit,
  });

  return NextResponse.json(results);
}
