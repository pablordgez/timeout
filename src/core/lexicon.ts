import es from "../data/es.json.gz?url";
import en from "../data/en.json.gz?url";
import type { Locale } from "./types";
import { normalize } from "./word-normalization";
export { normalize } from "./word-normalization";
export interface Word {
  w: string;
  g: string;
  p: string;
}
export const words: Record<Locale, Word[]> = { es: [], en: [] };
const loaded: Partial<Record<Locale, Promise<void>>> = {};
export function loadLexicon(locale: Locale): Promise<void> {
  return (loaded[locale] ??= (async () => {
    const url = locale === "es" ? es : en;
    let bytes: Uint8Array<ArrayBuffer>;
    if (url.startsWith("data:"))
      bytes = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
    else {
      const response = await fetch(url);
      if (!response.ok) throw Error("Unable to load local lexicon");
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    // Dev servers or custom hosts may transparently decode Content-Encoding.
    const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
    const stream = new Blob([bytes]).stream();
    const decoded = compressed
      ? stream.pipeThrough(new DecompressionStream("gzip"))
      : stream;
    words[locale] = JSON.parse(await new Response(decoded).text());
  })().catch((error) => {
    delete loaded[locale];
    throw error;
  }));
}
const cache: Partial<Record<Locale, Set<string>>> = {};
export function accepted(locale: Locale) {
  if (!words[locale].length) return new Set<string>();
  return (cache[locale] ??= new Set(words[locale].map((v) => normalize(v.w))));
}
export function clueWords(locale: Locale) {
  return words[locale].filter(
    (v) => v.g && normalize(v.w).length >= 3 && normalize(v.w).length <= 15,
  );
}
const common: Record<Locale, string> = {
  es: "abeja acero actor agudo album altar amigo ancho angel antes apoyo aroma arroz autor avion ayuda baile banco barco barro bello bolsa borde bravo brazo bueno burla cable calor campo canal canto capaz carne carro carta casco causa cerca cielo cifra cinco cinta clima cobre coche coral corte costa crema cuero culpa curva danza deber dicho disco dolor drama dulce enero falta falso fecha feria fibra firma fondo frase fuego ganar gasto golpe gordo grano grave grupo hecho hielo hogar horno hueso humor ideal igual joven jugar junio justo lapiz larga lento libro limon lista llave lleno local lucha lunes lunar madre magia malo marco marzo mayor menos metal miedo mirar monte moral motor mover mucho mundo museo nadar nadie negro nivel noche norte novio nuevo ocios oeste orden oreja padre papel parar pared parte paseo patio pausa pecho pedir pegar pelea perro pieza pilar pinto pista playa plazo pleno poder poeta polvo poner punto queso radio rama rango rasgo raton recto regla reina reloj resto ritmo robar rodeo rojo ronda rubio rueda ruido rural saber sabio salir salto salud selva señal serie siete silla sobre socio solar sonar tarde tarea techo temer tener tigre tocar tomar torre total trato trigo unido union usar valor vapor vaso verde viaje viejo villa virus vista vivir vuelo voz vuelo mujer feliz curso suelo sueño lucha planta"
    .split(" ")
    .filter((w) => normalize(w).length === 5)
    .join(" "),
  en: "about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry apart apple apply arena argue arise array aside asset audio avoid award aware badly baker basic basis beach begin being below bench birth black blame blind block blood board brain brand bread break breed brief bring broad broke brown build built buyer cable carry catch cause chain chair chalk charm chart chase cheap check chest chief child civil claim class clean clear click climb clock close cloth cloud coach coast count court cover craft crash cream crime cross crowd crown daily dance dated dealt death debut delay depth dirty doubt dozen draft drama drawn dream dress drink drive eagle early earth eight elbow elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fault field fifth fifty fight final first flame flash fleet flesh float flood floor flour fluid focus force forth forty forum found frame fresh front frost fruit ghost giant given glass globe glory grace grade grain grand grape grass great green greet group guard guest guide happy harsh heart heavy hello hobby honey horse hotel house human humor ideal image imply index inner input issue ivory joint judge juice known label labor large laser later laugh layer learn leave legal lemon level light limit local logic loose lower lucky lunch magic major maker march match mayor meant medal metal might minor model money month moral motor mount mouse mouth movie music never night noise north novel nurse ocean offer often order other outer owner paint panel paper party pause peace phase phone photo piano piece pilot pitch place plain plane plant plate point pound power press price pride prime print prior prize proof proud queen quick quiet quite radio raise range rapid ratio reach react ready realm refer relax reply right rival river robot rough round route royal rural scale scene scope score sense serve seven shade shake shall shape share sharp sheep sheet shelf shell shift shine shirt shock short shown sight since sixth skill sleep slice slide small smart smile smoke solid solve sorry sound south space spare speak speed spell spend spice split sport staff stage stand start state steam steel steep still stock stone store storm story strip stuck study stuff style sugar suite sunny super sweet swing table taken taste teach teeth thank their theme there thick thing think third those three throw tight tired title today topic total touch tough tower trace track trade train treat trend trial trick tried truck truly trust truth twice under union unity until upper upset urban usual valid value video virus visit vital voice waste watch water wheel where which while white whole whose woman world worry worse worst worth would write wrong wrote young youth zebra"
    .split(" ")
    .join(" "),
};
export function targets(locale: Locale) {
  const set = accepted(locale);
  const preferred = [...new Set(common[locale].split(" "))].filter((w) =>
    set.has(normalize(w)),
  );
  return preferred.length > 20
    ? preferred
    : clueWords(locale)
        .filter((v) => normalize(v.w).length === 5 && v.p === "noun")
        .slice(0, 1000)
        .map((v) => normalize(v.w));
}
