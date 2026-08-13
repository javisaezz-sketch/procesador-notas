/**
 * VIDA & STYLE — Añade esto a tu functions.php (ANTES del hook transition_post_status)
 */

// 1. Permite escribir el meta desde la REST API del procesador
add_action('init', function () {
    register_post_meta('post', '_vs_target_emails', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

// 2. Mostrar email en el metabox (meta o fallback del contenido)
function vs_display_notification_metabox($post) {
    $emails = get_post_meta($post->ID, '_vs_target_emails', true);

    if (empty($emails) && preg_match('/<!--\s*VS_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $emails = trim($m[1]);
    }

    echo '<p><label style="font-weight:bold;">Enviar a (separar por comas):</label></p>';
    echo '<textarea name="vs_target_emails" style="width:100%; height:60px; border-radius:4px; border:1px solid #ccc; font-family:sans-serif;" placeholder="ejemplo@mail.com">' . esc_attr($emails) . '</textarea>';
    echo '<p style="font-size:11px; color:#666; line-height:1.4; margin-top:8px;"><strong>Importante:</strong> Solo se enviará si escribes un email. El campo se vaciará tras el envío para evitar duplicados.</p>';
}

// 3. En tu hook transition_post_status, sustituye la lectura de destinatarios por:
/*
    $destinatarios_raw = get_post_meta($post->ID, '_vs_target_emails', true);

    if (empty($destinatarios_raw) && preg_match('/<!--\s*VS_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $destinatarios_raw = trim($m[1]);
    }
*/

// El procesador inserta <!-- VS_NOTIFY:email@agencia.com --> en el HTML del borrador
// como respaldo si el meta no se guardó por REST API.
