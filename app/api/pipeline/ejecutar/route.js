import { NextResponse } from 'next/server';
import { ejecutarPipeline } from '@/lib/ejecutarPipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  try {
    const resumen = await ejecutarPipeline();

    if (resumen.ocupado) {
      return NextResponse.json(
        {
          ok: false,
          ocupado: true,
          error: 'El pipeline ya está en marcha. Espera un momento y pulsa Actualizar.',
        },
        { status: 409 },
      );
    }

    const nuevas = resumen.emails?.nuevas ?? 0;
    const generados = resumen.articulosGenerados ?? 0;
    const reenviadas = resumen.emails?.reenviadas ?? 0;
    let message = `Pipeline listo. ${nuevas} email${nuevas === 1 ? '' : 's'} nuevo${nuevas === 1 ? '' : 's'}, ${generados} artículo${generados === 1 ? '' : 's'} generado${generados === 1 ? '' : 's'}.`;
    if (reenviadas > 0) {
      message += ` ${reenviadas} respuesta${reenviadas === 1 ? '' : 's'} reenviada${reenviadas === 1 ? '' : 's'} a Noe.`;
    }

    if (resumen.quedanNotas) {
      message += ' Sigo con las que quedan.';
    }

    if (!resumen.ok) {
      message = resumen.fatal?.error || 'El pipeline no ha podido terminar.';
    } else if (resumen.advertencias?.length) {
      message += ' Hay avisos: mira la franja de arriba.';
    }

    return NextResponse.json({
      ok: resumen.ok,
      message,
      resumen: {
        emailsNuevas: nuevas,
        respuestasReenviadas: reenviadas,
        articulosGenerados: generados,
        quedanNotas: resumen.quedanNotas,
        advertencias: resumen.advertencias?.length ?? 0,
      },
    }, { status: resumen.ok ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'No se pudo poner en marcha el pipeline' },
      { status: 500 },
    );
  }
}
