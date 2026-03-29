import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getAllDescriptions } from '@/lib/descriptions';
import { getMarkets } from '@/lib/markets';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const descriptions = getAllDescriptions();
  const { markets } = getMarkets();

  // Merge markets with their description status
  const result = markets.map((m) => {
    const desc = descriptions.find((d) => d.slug === m.id);
    return {
      slug: m.id,
      name: m.name,
      province: m.province,
      type: m.type,
      hasDescription: !!desc,
      generatedAt: desc?.generatedAt || null,
      editedAt: desc?.editedAt || null,
    };
  });

  return NextResponse.json({ markets: result, total: markets.length, withDescriptions: descriptions.length });
}
