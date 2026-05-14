import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/storage';
import { GlobalConfig } from '@/lib/types';

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Partial<GlobalConfig>;

  const current = await getConfig();
  const updated: GlobalConfig = {
    maxBotsPerMessage: Number(body.maxBotsPerMessage ?? current.maxBotsPerMessage),
    delayMin: Number(body.delayMin ?? current.delayMin),
    delayMax: Number(body.delayMax ?? current.delayMax),
    emojiPool: Array.isArray(body.emojiPool) ? body.emojiPool : current.emojiPool,
    useRandomEmoji: body.useRandomEmoji ?? current.useRandomEmoji,
  };

  // Sanity checks
  if (updated.maxBotsPerMessage < 1) updated.maxBotsPerMessage = 1;
  if (updated.delayMin < 0) updated.delayMin = 0;
  if (updated.delayMax < updated.delayMin) updated.delayMax = updated.delayMin;

  await saveConfig(updated);
  return NextResponse.json(updated);
}
