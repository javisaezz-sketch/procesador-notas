const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

function ensureWebSocketPolyfill() {
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
  }
}

function createSupabaseNodeClient(url, key) {
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o la clave de Supabase');
  }

  ensureWebSocketPolyfill();

  return createClient(url, key, {
    realtime: {
      transport: WebSocket,
    },
  });
}

module.exports = { createSupabaseNodeClient, ensureWebSocketPolyfill };
