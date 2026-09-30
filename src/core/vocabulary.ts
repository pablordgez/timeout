import { normalize } from "./lexicon";
import { random, shuffle } from "./random";
import type { Locale } from "./types";

// Editorial familiarity bands, not a claim about measured corpus frequency.
const everyday = {
  es: `abeja acero actor agua aire ala album amigo amor ancho animal año arbol arena arroz arte avion azul baile bajo banco barco barro bebe beso blanco boca bolsa bosque brazo bueno burro caballo cabeza cable caja calle cama camino campo canal cara carne carro carta casa casco cena centro cerca cerdo cielo cine cinco cinta ciudad clase clima coche cocina cola color comer compra conejo copa coral correr cosa costa crema cruz cuadro cuatro cuerpo cuero cuento curva dedo deporte dia diente dinero disco doctor dolor dos dulce escuela enero espejo estrella familia fecha feliz feria fiesta flor fondo foto frase frio fruta fuego gato gente golpe gorro grande grano gris grupo guante guerra guitarra hablar harina hecho hermano hielo hijo hoja hombre hora hotel huevo invierno isla jardin joven juego juguete jugo junio lago lana lapiz leche leer lengua leon letra libro limon linea lista llave lluvia loco luna lunes luz madera madre mano mapa mar marco marzo mesa metal metro miedo miel minuto mono monte motor mucho mujer mundo museo nadar nariz negro nieve niño noche nombre norte nube numero nuevo ojo ola oro oso otoño oveja padre pajaro palabra pan papel pared parte paso pato patio pausa pecho pelo pelota pensar pequeño pera perro persona pez piano pie piedra piel pierna playa plato pluma poco pollo polvo poner puerta pueblo puente queso radio rama rana raton receta red regalo regla reina reloj rey rio rojo ropa rosa rueda ruido saber sal sala salir salto salud semana semilla señal ser serie siete silla sitio sobre sol sopa suelo sueño tarde taza teatro techo tela tener tierra tigre tiempo tipo tocar tomar tomate torre trabajo tren trigo uno usar uva vaca vaso vela verde verano viaje vida viento viejo vino vista vivir voz vuelo zapato zona`,
  en: `actor air animal apple arm art aunt autumn baby back bag ball banana bank barn base bath beach bear bed bee bell bike bird black blue boat body bone book boot bottle bowl box boy bread bridge bright brother brown brush bus butter cable cake camera camp candle cap car card care carrot cat chair cheese child circle city class clean clock cloud coat cold colour color cook corn cow crab cream cross cup cut dance dark day deer desk dog door down dream dress drink duck ear earth east eat egg eight eye face fair fall family farm father feather feet field fire fish five floor flower fly food foot forest fork four fox friend frog fruit game garden gate girl glass glove goat gold good grape grass green ground group hair hand happy hat head heart heat heavy hill home honey horse hospital hot hotel house ice island jacket jam jet job juice jump key king kitchen knee lake lamp land leaf left leg lemon letter light lion list little long lunch mail man map market meal meat milk moon morning mother mountain mouse mouth music name near neck nest net new night nine noise north nose note ocean old orange owl page paint pair pan paper park party path pear pen people pet phone piano picture pig pink pipe place plain plane plant plate play pool potato queen quiet rabbit radio rain rat read red rice ride right ring river road rock roof room root rope rose round row ruler run sad safe salt sand school sea seat seed seven sheep shell ship shirt shoe short show side sign sing sister six sky sleep slow small smile snow soap sock soft soil son song soup south space spoon spring square star station steam stone stop store story street strong sugar summer sun sweet swim table tail tall tea team teeth ten thing three tiger time toe tomato tongue tooth top town toy train tree trip truck two uncle under up very voice walk wall warm wash watch water wave week west wheel white wide wind window wing winter wolf woman wood word work world year yellow young zebra zoo`,
};
const familiar = {
  es: `abismo acento acido adorno adulto aguja ajedrez alcalde aldea alfabeto alfombra algodon alianza alma altura amistad ancla angulo anillo anuncio araña arco armario aroma ascensor asunto ataque autor avenida ayuda azucar bandera belleza biblioteca billete botella brisa bronce burbuja calma camion campaña cantante capital capitan caracol carbon caricia castillo cebolla celula ceniza ciencia circo cobre cometa comercio compas concierto consejo corazon corona cristal cuchara cuchillo cultura danza destino detalle dibujo dibujo director distancia eco edificio elefante energia ensayo entrada equipo espacio estatua estufa examen exito fabrica fantasma fibra figura firma fortuna frontera funcion futuro galaxia gallina garaje gigante gobierno gota guardia hada helado herida historia hogar horno hueso humor idea idioma imagen insecto instante instrumento justicia karate kayak kilo kiwi labio ladrillo lagrima lampara libre libertad licencia locura lucha magia maleta manzana maquina memoria mentira mensaje milagro modelo moneda misterio montaña musculo natal naturaleza nido noticia novela oficina oreja origen otoño paciencia palacio paloma pañuelo paraiso pareja pasillo paisaje perfume planeta poesia poeta premio problema producto pulso receta refugio retrato ritmo robot rompecabezas sabio secreto selva sendero sentido silencio simbolo sombra suerte tambor tesoro tinta toalla tortuga turismo universo valle vapor vecino ventana verdad violin visita voluntad waterpolo web whisky wifi xilofono`,
  en: `advice alarm anchor angle answer arrow artist atom attack author balance beauty blanket border brain branch bronze bubble bucket button captain castle century chain chance change chapter chase chest chimney choice church clay climate coast college colony comedy comet company compass concert copper corner cotton county craft crown crystal culture curtain custom danger desert design diamond distance dragon drawing duty echo energy engine entrance event example factory failure faith farmer fashion fence figure flame flight force fortune freedom frost future galaxy ghost giant glory goal golden grain guide habit hammer health history hobby honour hope human image insect iron jewel journey judge ladder language lawyer leather lesson library life lock magic magnet marble medicine memory message metal method mirror model money monkey mystery nature needle novel nurse object office order palace pattern peace pepper planet pocket poem poet police power prince prison promise purple puzzle reason record rhythm ribbon robot rocket royal scene science shadow shape silver skill smoke soldier sound spirit sport stage statue storm stream strength string symbol talent temple ticket title tower travel treasure truth tunnel turtle union value village vision visitor voyage wealth weather wonder wool youth`,
};
const commonSets = {
  es: new Set(everyday.es.split(/\s+/).map(normalize)),
  en: new Set(everyday.en.split(/\s+/).map(normalize)),
};
const familiarSets = {
  es: new Set(familiar.es.split(/\s+/).map(normalize)),
  en: new Set(familiar.en.split(/\s+/).map(normalize)),
};
export type WordBand = 0 | 1 | 2;
export function wordBand(
  entry: { w: string; g: string; p?: string },
  locale: Locale,
): WordBand {
  const w = normalize(entry.w);
  if (commonSets[locale].has(w)) return 0;
  if (familiarSets[locale].has(w)) return 1;
  return 2;
}
export const vocabularyMix = (difficulty: string): readonly number[] =>
  difficulty === "easy"
    ? [0.9, 0.1, 0]
    : difficulty === "hard"
      ? [0.3, 0.4, 0.3]
      : [0.6, 0.3, 0.1];
export function vocabularyOrder<T extends { w: string; g: string; p?: string }>(
  entries: T[],
  locale: Locale,
  difficulty: string,
  seed: number,
): T[] {
  const bins = [0, 1, 2].map(
    (band) =>
      shuffle(
        entries.filter((e) => wordBand(e, locale) === band),
        seed ^ ((band + 1) * 0x9e3779b9),
      ).items,
  );
  const mix = vocabularyMix(difficulty),
    out: T[] = [];
  let rng = seed;
  // A weighted shuffle interleaves bands without sorting hundreds of thousands of words.
  while (bins.some((b, i) => b.length && mix[i] > 0)) {
    const active = bins.map((b, i) => (b.length ? mix[i] : 0)),
      total = active.reduce((a, b) => a + b, 0);
    const [r, next] = random(rng);
    rng = next;
    let v = r * total,
      band = 0;
    while (band < 2 && v >= active[band]) {
      v -= active[band];
      band++;
    }
    out.push(bins[band].pop()!);
  }
  return out;
}
