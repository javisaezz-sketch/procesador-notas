import { NextResponse } from 'next/server';
import { cancelarProgramacion } from '@/lib/programarPublicacion';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);
    const body = await request.json().catch(() => ({}));

    if (!articuloId || Number.isNaN(articuloId)) {
      return NextResponse.json({ ok: false, error: 'ID de artículo inválido' }, { status: 400 });
    }

    if (!body.cancelar) {
      return NextResponse.json(
        { ok: false, error: 'Solo se admite cancelar la programación desde esta ruta' },
        { status: 400 },
      );
    }

    const articulo = await cancelarProgramacion(articuloId);
    return NextResponse.json({ ok: true, articulo });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'No se pudo actualizar la programación' },
      { status: 500 },
    );
  }
}
