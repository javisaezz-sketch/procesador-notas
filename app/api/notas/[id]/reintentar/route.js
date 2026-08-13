import { NextResponse } from 'next/server';
import { reintentarNota } from '@/lib/notasPrensa';

export async function POST(_request, { params }) {
  try {
    const { id } = await params;
    const notaId = Number(id);

    if (!notaId || Number.isNaN(notaId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de nota inválido' },
        { status: 400 },
      );
    }

    const nota = await reintentarNota(notaId);

    return NextResponse.json({
      ok: true,
      message: 'Nota devuelta a la cola de procesamiento',
      nota,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al reintentar',
      },
      { status: 500 },
    );
  }
}
