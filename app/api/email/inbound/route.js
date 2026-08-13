import { NextResponse } from 'next/server';
import {
  extraerImagenesDeMailparser,
  guardarNotaDesdeEmail,
} from '@/lib/ingestNota';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let remitente = '';
    let asunto = '';
    let texto = '';
    let html = '';
    let messageId = '';
    const imagenes = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();

      remitente = String(formData.get('sender') || formData.get('from') || '');
      asunto = String(formData.get('subject') || 'Sin asunto');
      texto = String(formData.get('body-plain') || formData.get('stripped-text') || '');
      html = String(formData.get('body-html') || formData.get('stripped-html') || '');
      messageId = String(formData.get('Message-Id') || formData.get('message-id') || '');

      for (const [key, value] of formData.entries()) {
        if (!key.startsWith('attachment') || typeof value === 'string') continue;
        if (!(value instanceof File)) continue;

        const buffer = Buffer.from(await value.arrayBuffer());
        imagenes.push({
          filename: value.name || 'adjunto.jpg',
          contentType: value.type || 'image/jpeg',
          buffer,
          origen: 'adjunto',
        });
      }
    } else {
      const body = await request.json();
      remitente = body.sender || body.from || '';
      asunto = body.subject || 'Sin asunto';
      texto = body.text || body['body-plain'] || '';
      html = body.html || body['body-html'] || '';
      messageId = body.messageId || body['Message-Id'] || '';
    }

    const resultado = await guardarNotaDesdeEmail({
      remitente,
      asunto,
      texto,
      html,
      imagenes,
      messageId,
    });

    return NextResponse.json({
      ok: true,
      notaId: resultado.nota.id,
      imagenes: resultado.imagenes.length,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Webhook de email activo. Usa POST para recibir notas.',
  });
}
