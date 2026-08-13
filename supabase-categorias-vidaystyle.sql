-- Categorías WordPress de Vida&Style (medio id: 4)
-- Slugs verificados desde https://vidaystyle.com/wp-json/wp/v2/categories

UPDATE medios SET categorias_json = '[
  {"slug": "musica", "nombre": "Cultura"},
  {"slug": "familia", "nombre": "Family&Planes"},
  {"slug": "design", "nombre": "Home&Design"},
  {"slug": "nightlife-clubbing", "nombre": "Nightlife & Clubbing"},
  {"slug": "motor", "nombre": "Tech&Motor"},
  {"slug": "travel", "nombre": "Travel"},
  {"slug": "wellness", "nombre": "Wellness&Mindset"}
]'::jsonb
WHERE id = 4;
