import { NextResponse } from 'next/server';
import { getPipelineEstado } from '@/lib/pipelineEstado';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const estado = await getPipelineEstado();

    return NextResponse.json({
      ok: true,
      estado,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'No se pudo leer el estado del pipeline',
      },
      { status: 500 },
    );
  }
}
