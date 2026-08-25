<?php
/**
 * PROCESADOR DE NOTAS — Imagen destacada vía REST API
 *
 * Añade este bloque a functions.php en TODOS los medios WordPress:
 * - GlamCloset (glamcloset.cat)
 * - Travelicius (travelicius.es)
 * - Vida&Style (vidaystyle.com)
 * - Fem Negoci (femnegoci.es)
 *
 * Permite que el panel asigne featured_media al crear/actualizar borradores.
 * Sin esto, algunos temas/plugins ignoran featured_media en la REST API.
 */

add_action('init', function () {
    register_post_meta('post', '_thumbnail_id', [
        'type' => 'integer',
        'single' => true,
        'show_in_rest' => true,
        'auth_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

add_filter('rest_pre_insert_post', function ($prepared, $request) {
    if (!$request instanceof WP_REST_Request) {
        return $prepared;
    }

    $featured = $request->get_param('featured_media');

    if ($featured !== null && $featured !== '') {
        $prepared->meta_input = array_merge(
            (array) ($prepared->meta_input ?? []),
            ['_thumbnail_id' => (int) $featured]
        );
    }

    return $prepared;
}, 10, 2);

add_filter('rest_pre_update_post', function ($prepared, $request) {
    if (!$request instanceof WP_REST_Request) {
        return $prepared;
    }

    $featured = $request->get_param('featured_media');

    if ($featured !== null && $featured !== '') {
        $prepared->meta_input = array_merge(
            (array) ($prepared->meta_input ?? []),
            ['_thumbnail_id' => (int) $featured]
        );
    }

    return $prepared;
}, 10, 2);
