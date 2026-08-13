/**
 * TRAVELICIUS — Añade esto a tu functions.php (ANTES del hook transition_post_status)
 */

add_action('init', function () {
    register_post_meta('post', '_trv_target_email', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

// En trv_render_email_field, leer fallback del contenido:
/*
function trv_render_email_field($post) {
    $value = get_post_meta($post->ID, '_trv_target_email', true);

    if (empty($value) && preg_match('/<!--\s*TRV_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $value = trim($m[1]);
    }
    ...
}
*/

// En transition_post_status, leer fallback:
/*
    $destinatarios_raw = get_post_meta($post->ID, '_trv_target_email', true);

    if (empty($destinatarios_raw) && preg_match('/<!--\s*TRV_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $destinatarios_raw = trim($m[1]);
    }
*/
