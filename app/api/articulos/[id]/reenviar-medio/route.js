import { NextResponse } from 'next/server';
import { reenviarArticuloAMedio } from '@/lib/notasPrensa';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);

    if (!articuloId || Number.isNaN(articuloId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de artículo inválido' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const medioId = Number(body.medioId);

    if (!medioId || Number.isNaN(medioId)) {
      return NextResponse.json(
        { ok: false, error: 'Debes seleccionar un medio de destino' },
        { status: 400 },
      );
    }

    const resultado = await reenviarArticuloAMedio(articuloId, medioId);

    return NextResponse.json({
      ok: true,
      message: `Nota encolada para ${resultado.medio.nombre}. Gemini generará un artículo nuevo en los próximos minutos.`,
      medio: resultado.medio,
      nota: resultado.nota,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al reenviar la nota',
      },
      { status: 500 },
    );
  }
}
