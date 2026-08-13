/**
 * GLAM CLOSET — Añade a functions.php (igual que Travelicius / Vida&Style)
 */

add_action('init', function () {
    register_post_meta('post', '_gc_target_email', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

// Metabox (adapta el título a tu snippet existente):
/*
function gc_render_email_field($post) {
    $value = get_post_meta($post->ID, '_gc_target_email', true);

    if (empty($value) && preg_match('/<!--\s*GC_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $value = trim($m[1]);
    }

    echo '<input type="text" name="gc_target_email" value="' . esc_attr($value) . '" ... />';
}
*/

// En transition_post_status al publicar:
/*
    $destinatarios_raw = get_post_meta($post->ID, '_gc_target_email', true);

    if (empty($destinatarios_raw) && preg_match('/<!--\s*GC_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $destinatarios_raw = trim($m[1]);
    }
*/

// save_post:
/*
    if (array_key_exists('gc_target_email', $_POST)) {
        update_post_meta($post_id, '_gc_target_email', sanitize_text_field($_POST['gc_target_email']));
    }
*/
