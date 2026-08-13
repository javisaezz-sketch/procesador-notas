/**
 * FEM NEGOCI — Añade a functions.php (igual que Travelicius / Vida&Style / Glamcloset)
 */

add_action('init', function () {
    register_post_meta('post', '_fn_target_email', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

// Metabox:
/*
function fn_render_email_field($post) {
    $value = get_post_meta($post->ID, '_fn_target_email', true);

    if (empty($value) && preg_match('/<!--\s*FN_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $value = trim($m[1]);
    }

    echo '<input type="text" name="fn_target_email" value="' . esc_attr($value) . '" ... />';
}
*/

// En transition_post_status al publicar:
/*
    $destinatarios_raw = get_post_meta($post->ID, '_fn_target_email', true);

    if (empty($destinatarios_raw) && preg_match('/<!--\s*FN_NOTIFY:([^>]+)\s*-->/', $post->post_content, $m)) {
        $destinatarios_raw = trim($m[1]);
    }
*/

// save_post:
/*
    if (array_key_exists('fn_target_email', $_POST)) {
        update_post_meta($post_id, '_fn_target_email', sanitize_text_field($_POST['fn_target_email']));
    }
*/
