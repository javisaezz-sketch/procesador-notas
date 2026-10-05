const assert = require('assert');
const { decidirCorreoEntrante } = require('../lib/respuestaAgencia.cjs');

const javi = {
  subject: 'Re: La Glam del Buen Vivir ha publicado tu nota en Instagram',
  from: { value: [{ address: 'javi.gomez@viacomunicacion.com', name: 'Javi Gómez' }] },
};
const noe = {
  subject: 'Re: La Glam del Buen Vivir ha publicado tu nota en Instagram',
  from: { value: [{ address: 'noenavessl@gmail.com' }] },
};
const nota = {
  subject: 'Fwd: 7 nights. One final week at Pacha Ibiza this season.',
  from: { value: [{ address: 'javisaezz@gmail.com' }] },
};
const sinAsunto = {
  subject: '',
  from: { value: [{ address: 'noenavessl@gmail.com' }] },
};
const automatica = {
  subject: 'Respuesta automática: Glamcloset ha publicado tu nota',
  from: { value: [{ address: 'agencia@ejemplo.com' }] },
};

assert.strictEqual(decidirCorreoEntrante(javi), 'reenviar');
assert.strictEqual(decidirCorreoEntrante(noe), 'borrar');
assert.strictEqual(decidirCorreoEntrante(nota), 'procesar');
assert.strictEqual(decidirCorreoEntrante(sinAsunto), 'procesar');
assert.strictEqual(decidirCorreoEntrante(automatica), 'reenviar');
assert.strictEqual(decidirCorreoEntrante({}), 'procesar');

console.log('OK');
