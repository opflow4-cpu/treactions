import { NextRequest, NextResponse } from 'next/server';
import { getFlows, saveFlows } from '@/lib/storage';
import { Flow } from '@/lib/flow-types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const flows = await getFlows();
  const flow = flows.find((f) => f.id === id);
  if (!flow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(flow);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const flows = await getFlows();
  const idx = flows.findIndex((f) => f.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Partial<Flow>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const allowed: (keyof Flow)[] = ['name', 'active', 'botId', 'blocks'];
  for (const key of allowed) {
    if (key in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (flows[idx] as any)[key] = body[key];
    }
  }
  flows[idx].updatedAt = Date.now();

  try {
    await saveFlows(flows);
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao salvar: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  return NextResponse.json(flows[idx]);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const flows = await getFlows();
  const filtered = flows.filter((f) => f.id !== id);
  if (filtered.length === flows.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await saveFlows(filtered);
  return NextResponse.json({ ok: true });
}
