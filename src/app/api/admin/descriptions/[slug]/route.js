import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getDescription, updateDescriptionContent, deleteDescription, upsertDescription } from '@/lib/descriptions';
import { getMarketBySlug } from '@/lib/markets';
import { getSetting } from '@/lib/settings';
import { formatTypeNL, formatScheduleNL } from '@/lib/i18n';
import OpenAI from 'openai';

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const desc = getDescription(slug);
  if (!desc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(desc);
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  updateDescriptionContent(slug, content.trim(), session.user.email);
  return NextResponse.json({ success: true });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const market = getMarketBySlug(slug);
  if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const model = getSetting('openaiModel') || process.env.OPENAI_MODEL || 'gpt-5-mini';
  const typeLabel = formatTypeNL(market.type);
  const scheduleText = formatScheduleNL(market.schedule);

  const prompt = `Je bent een expert op het gebied van Nederlandse weekmarkten en steden.
Schrijf 2-3 alinea's over de weekmarkt in ${market.cityTown} op ${market.location}, provincie ${market.province}.

Eerste alinea: beschrijf de stad of het dorp kort — wat maakt het bijzonder, wat is de sfeer?
Tweede alinea: beschrijf de markt zelf — wat kun je er vinden, waarom is het de moeite waard om te bezoeken?
Optioneel derde alinea: praktische tips voor bezoekers.

Marktinformatie:
- Type: ${typeLabel}
- Openingstijden: ${scheduleText}
- Locatie: ${market.location}, ${market.cityTown}

Schrijf in een warme, informatieve toon. Geen opsommingstekens, gewoon lopende tekst. Maximaal 200 woorden.`;

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const content = response.choices[0].message.content.trim();
  upsertDescription(slug, content, model);

  return NextResponse.json({ success: true, content });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  deleteDescription(slug);
  return NextResponse.json({ success: true });
}
