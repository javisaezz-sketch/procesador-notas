import { NextResponse } from 'next/server';
import { descartarNota } from '@/lib/notasPrensa';

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

    const nota = await descartarNota(notaId);

    return NextResponse.json({
      ok: true,
      message: 'Nota descartada',
      nota,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al descartar',
      },
      { status: 500 },
    );
  }
}
