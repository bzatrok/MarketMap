import client from '@/lib/meilisearch';
import { buildFilterArray } from '@/lib/filters';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get('q') || '';
  const days = searchParams.get('days')?.split(',').filter(Boolean) || [];
  const provinces = searchParams.get('provinces')?.split(',').filter(Boolean) || [];
  const type = searchParams.get('type') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '2000', 10), 2000);

  const filter = buildFilterArray({ days, provinces, type });

  const index = client.index('markets');
  const results = await index.search(q, {
    filter,
    limit,
  });

  return NextResponse.json(results);
}
