import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const notaId = Number(id);

    if (!notaId || Number.isNaN(notaId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de nota inválido' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('notas_prensa')
      .select('id, contenido_original, contenido_html')
      .eq('id', notaId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const texto =
      data.contenido_original?.trim() ||
      data.contenido_html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ||
      '';

    return NextResponse.json({ ok: true, texto });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'No se pudo cargar la nota original',
      },
      { status: 500 },
    );
  }
}
