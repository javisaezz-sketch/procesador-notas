require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const {
  anadirReglasTituloAlPrompt,
  normalizarTerminoEstructuraEnPrompt,
  promptIncluyeReglasTitulo,
} = require('../lib/reglasTitulo.cjs');

const PROMPTS_LOCALES = {
  travelicius: 'prompt-travelicius.txt',
  femnegoci: 'prompt-femnegoci.txt',
};

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const { data: medios, error } = await supabase
    .from('medios')
    .select('id, slug, prompt_personalidad')
    .order('id');

  if (error) {
    throw new Error(error.message);
  }

  for (const medio of medios) {
    let prompt = medio.prompt_personalidad ?? '';

    if (PROMPTS_LOCALES[medio.slug]) {
      const ruta = path.join(__dirname, '..', PROMPTS_LOCALES[medio.slug]);
      prompt = fs.readFileSync(ruta, 'utf8');
    } else {
      prompt = normalizarTerminoEstructuraEnPrompt(prompt);
      prompt = anadirReglasTituloAlPrompt(prompt);
    }

    const { error: updateError } = await supabase
      .from('medios')
      .update({ prompt_personalidad: prompt })
      .eq('id', medio.id);

    if (updateError) {
      throw new Error(`${medio.slug}: ${updateError.message}`);
    }

    console.log(
      `✅ ${medio.slug} — reglas título: ${promptIncluyeReglasTitulo(prompt) ? 'sí' : 'no'} (${prompt.length} chars)`,
    );
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
