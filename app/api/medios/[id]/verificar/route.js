import { NextResponse } from 'next/server';
import { diagnosticarMedio } from '@/lib/publicarArticulo';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const medioId = Number(id);

    if (!medioId || Number.isNaN(medioId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de medio inválido' },
        { status: 400 },
      );
    }

    const diagnostico = await diagnosticarMedio(medioId);

    return NextResponse.json({
      ok: true,
      message: 'Conexión WordPress correcta',
      ...diagnostico,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
