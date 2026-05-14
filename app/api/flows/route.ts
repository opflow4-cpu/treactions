import { NextRequest, NextResponse } from 'next/server';
import { getFlows, saveFlows } from '@/lib/storage';
import { Flow } from '@/lib/flow-types';

export async function GET() {
  const flows = await getFlows();
  return NextResponse.json(flows);
}

export async function POST(req: NextRequest) {
  let body: Partial<Flow>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
  }

  const flows = await getFlows();

  const newFlow: Flow = {
    id: `flow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: body.name.trim(),
    active: body.active ?? false,
    botId: body.botId ?? '',
    blocks: body.blocks ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  flows.push(newFlow);

  try {
    await saveFlows(flows);
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao salvar: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  return NextResponse.json(newFlow, { status: 201 });
}
