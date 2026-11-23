// Catálogo para reconocer el texto libre: marcas y modelos frecuentes en Ecuador, versiones y equipamiento.
// No es una base de especificaciones (esas se investigan en fuentes reales); solo sirve para entender el texto.

/** Marca → modelos (el más largo primero dentro de cada marca se resuelve en el analizador). */
export const MODELOS: Record<string, string[]> = {
  Chevrolet: ['Grand Vitara SZ', 'Grand Vitara', 'Vitara', 'Aveo Family', 'Aveo Emotion', 'Aveo Activo', 'Aveo', 'Spark GT', 'Spark',
    'Sail', 'Optra', 'Corsa Evolution', 'Corsa', 'Cruze', 'Captiva', 'Tracker', 'Trailblazer', 'D-Max', 'Luv D-Max', 'Luv',
    'Onix', 'Beat', 'Sonic', 'Esteem', 'Forsa', 'Swift', 'Rodeo', 'Blazer', 'N300', 'Colorado', 'Equinox', 'Groove'],
  Suzuki: ['Grand Vitara', 'Vitara', 'Jimny', 'Swift', 'SX4', 'Celerio', 'Alto', 'Ertiga', 'S-Presso', 'Baleno', 'Forsa', 'Samurai'],
  Toyota: ['Land Cruiser Prado', 'Land Cruiser', 'Hilux', 'Fortuner', 'Corolla', 'Yaris', 'RAV4', 'Rav 4', 'Prius', 'Rush', 'Avanza', '4Runner', 'Tercel', 'Starlet'],
  Kia: ['Picanto', 'Rio', 'Río', 'Cerato', 'Sportage', 'Sorento', 'Soluto', 'Soul', 'Stonic', 'Seltos', 'Carnival', 'Pregio', 'Sonet'],
  Hyundai: ['Grand i10', 'i10', 'Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta', 'Getz', 'Atos', 'Verna', 'Venue', 'H1', 'H100'],
  Nissan: ['Sentra', 'Versa', 'March', 'Tiida', 'X-Trail', 'Kicks', 'Qashqai', 'Navara', 'Frontier', 'Pathfinder', 'Almera', 'Patrol', 'D21'],
  Mazda: ['BT-50', 'CX-3', 'CX-30', 'CX-5', 'CX-7', 'Mazda 2', 'Mazda 3', 'Mazda 6', 'Allegro', '323', '626', 'B2200', 'B2600'],
  Renault: ['Sandero Stepway', 'Sandero', 'Logan', 'Duster', 'Kwid', 'Clio', 'Symbol', 'Stepway', 'Koleos', 'Captur', 'Oroch', 'Twingo', 'Megane'],
  Peugeot: ['206', '207', '208', '301', '307', '308', '2008', '3008', '405', '406', 'Partner'],
  Fiat: ['Palio', 'Premio', 'Uno', 'Siena', 'Punto', 'Strada', 'Mobi', 'Argo', 'Fiorino', 'Spazio', 'Duna'],
  Ford: ['Ranger', 'Explorer', 'Escape', 'EcoSport', 'Fiesta', 'Focus', 'F-150', 'Edge', 'Bronco', 'Courier', 'Ka'],
  Volkswagen: ['Gol', 'Golf', 'Jetta', 'Polo', 'Vento', 'Voyage', 'Saveiro', 'Amarok', 'Tiguan', 'T-Cross', 'Escarabajo', 'Fox', 'Passat'],
  Mitsubishi: ['L200', 'Montero Sport', 'Montero', 'Outlander', 'ASX', 'Lancer', 'Mirage', 'Space Star', 'Pajero'],
  Honda: ['Civic', 'CR-V', 'HR-V', 'Fit', 'City', 'Accord', 'Pilot', 'WR-V'],
  'Great Wall': ['Wingle 5', 'Wingle 7', 'Wingle', 'Haval H6', 'Haval H2', 'Haval', 'Voleex', 'Poer'],
  Chery: ['Tiggo 2', 'Tiggo 3', 'Tiggo 4', 'Tiggo 7', 'Tiggo', 'QQ', 'Arrizo', 'Fulwin', 'Van Pass'],
  JAC: ['S2', 'S3', 'S4', 'J4', 'T6', 'T8', 'JS2', 'JS4'],
  Daewoo: ['Matiz', 'Lanos', 'Nubira', 'Cielo', 'Racer', 'Tico'],
  Citroën: ['C3', 'C4', 'C-Elysée', 'Berlingo', 'C5'],
  Jeep: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Liberty'],
  BYD: ['F0', 'F3', 'S1', 'Song', 'Tang', 'Yuan', 'Dolphin', 'Seagull'],
  DFSK: ['Glory 500', 'Glory 580', 'Glory', 'C31', 'C35', 'K01'],
  Skoda: ['Fabia', 'Octavia', 'Rapid', 'Kodiaq', 'Kamiq'],
  Subaru: ['Forester', 'Impreza', 'XV', 'Outback', 'Legacy'],
  Isuzu: ['D-Max', 'Rodeo', 'Trooper', 'Amigo'],
  Dodge: ['Journey', 'Durango', 'Caliber', 'Ram'],
}

/** Alias en el texto → marca oficial. */
export const ALIAS_MARCA: Record<string, string> = {
  chevrolet: 'Chevrolet', chevy: 'Chevrolet', chevrolett: 'Chevrolet', suzuki: 'Suzuki', toyota: 'Toyota', kia: 'Kia',
  hyundai: 'Hyundai', hiunday: 'Hyundai', nissan: 'Nissan', mazda: 'Mazda', renault: 'Renault', peugeot: 'Peugeot',
  peugot: 'Peugeot', fiat: 'Fiat', ford: 'Ford', volkswagen: 'Volkswagen', vw: 'Volkswagen', wolkswagen: 'Volkswagen',
  mitsubishi: 'Mitsubishi', honda: 'Honda', 'great wall': 'Great Wall', greatwall: 'Great Wall', chery: 'Chery',
  jac: 'JAC', daewoo: 'Daewoo', citroen: 'Citroën', jeep: 'Jeep', byd: 'BYD', dfsk: 'DFSK', skoda: 'Skoda',
  subaru: 'Subaru', isuzu: 'Isuzu', dodge: 'Dodge',
}

/** Cuando el texto trae solo el modelo: marca más probable en Ecuador (p. ej., «Vitara» → Chevrolet). */
export const MARCA_POR_MODELO: Record<string, string> = {
  vitara: 'Chevrolet', 'grand vitara': 'Chevrolet', aveo: 'Chevrolet', spark: 'Chevrolet', sail: 'Chevrolet', optra: 'Chevrolet',
  corsa: 'Chevrolet', luv: 'Chevrolet', 'd-max': 'Chevrolet', dmax: 'Chevrolet', esteem: 'Chevrolet', forsa: 'Chevrolet',
  hilux: 'Toyota', corolla: 'Toyota', yaris: 'Toyota', fortuner: 'Toyota', rav4: 'Toyota', picanto: 'Kia', rio: 'Kia',
  sportage: 'Kia', cerato: 'Kia', soluto: 'Kia', tucson: 'Hyundai', accent: 'Hyundai', getz: 'Hyundai', elantra: 'Hyundai',
  i10: 'Hyundai', sentra: 'Nissan', versa: 'Nissan', 'x-trail': 'Nissan', navara: 'Nissan', frontier: 'Nissan',
  logan: 'Renault', sandero: 'Renault', duster: 'Renault', kwid: 'Renault', palio: 'Fiat', uno: 'Fiat', premio: 'Fiat',
  siena: 'Fiat', ranger: 'Ford', ecosport: 'Ford', fiesta: 'Ford', gol: 'Volkswagen', jetta: 'Volkswagen', golf: 'Volkswagen',
  l200: 'Mitsubishi', montero: 'Mitsubishi', lancer: 'Mitsubishi', civic: 'Honda', 'cr-v': 'Honda', jimny: 'Suzuki',
  swift: 'Suzuki', 'bt-50': 'Mazda', wingle: 'Great Wall', tiggo: 'Chery', matiz: 'Daewoo',
}

/** Versiones / acabados que suelen escribirse después del modelo. */
export const VERSIONES = ['XT', 'XS', 'XR', 'XL', 'XLE', 'XLT', 'LX', 'EX', 'EX-L', 'LE', 'GL', 'GLS', 'GLX', 'GT', 'GTI', 'DLX', 'STD',
  'SE', 'SEL', 'LS', 'LT', 'LTZ', 'RS', 'SR', 'SRV', 'SV', 'SX', 'ST', 'Sport', 'Premium', 'Limited', 'Base', 'Plus', 'Activo',
  'Emotion', 'Family', 'Expression', 'Dynamique', 'Privilege', 'Berlina', 'Hatchback', 'Sedán', 'Sedan', 'Clásico', 'Clasico',
  'Full', 'CRDi', 'TDI', 'Turbo', 'CS', 'CD', 'Doble Cabina', 'Cabina Simple', 'Cabina Sencilla']

/** Frases del texto → equipamiento con nombre estándar (en orden de importancia para el título). */
export const EQUIPAMIENTO: [RegExp, string][] = [
  [/\b(techo corredizo|techo solar|sunroof|quemacocos|techo panor[aá]mico)\b|\btecho\b/, 'Techo corredizo'],
  [/\b(pantalla|radio android|android auto|carplay|radio t[aá]ctil|radio touch)\b/, 'Pantalla Android'],
  [/\bc[aá]mara\b/, 'Cámara de retro'],
  [/\b(aire acondicionado|a\/a|a\/c|aire|climatizador|ac)\b/, 'Aire acondicionado'],
  [/\baros\b|\brines\b/, 'Aros deportivos'],
  [/\bsensor(es)?\b/, 'Sensores de parqueo'],
  [/\b(vidrios el[eé]ctricos|alzavidrios)\b/, 'Vidrios eléctricos'],
  [/\b(seguros el[eé]ctricos|cierre centralizado)\b/, 'Cierre centralizado'],
  [/\b(espejos el[eé]ctricos)\b/, 'Espejos eléctricos'],
  [/\b(airbags?|bolsas de aire)\b/, 'Airbags'],
  [/\b(asientos de cuero|tapicer[ií]a de cuero|cuero)\b/, 'Asientos de cuero'],
  [/\b(alarma)\b/, 'Alarma'],
  [/\b(bluetooth)\b/, 'Bluetooth'],
  [/\b(control crucero|crucero)\b/, 'Control crucero'],
  [/\b(mandos al volante)\b/, 'Mandos al volante'],
  [/\b(direcci[oó]n hidr[aá]ulica|hidr[aá]ulica)\b/, 'Dirección hidráulica'],
  [/\b(neblineros|antiniebla)\b/, 'Neblineros'],
  [/\b(abs)\b/, 'Frenos ABS'],
  [/\b(llantas nuevas)\b/, 'Llantas nuevas'],
  [/\b(7 asientos|7 pasajeros|tercera fila)\b/, '7 asientos'],
  [/\b(barras de techo|barras)\b/, 'Barras de techo'],
  [/\b(gancho|enganche|tiro)\b/, 'Gancho de remolque'],
]

export const COLORES = ['blanco', 'negro', 'plateado', 'plata', 'gris', 'rojo', 'azul', 'verde', 'amarillo', 'beige', 'café',
  'cafe', 'dorado', 'naranja', 'vino', 'celeste', 'morado', 'champagne', 'perla']

export const PROCEDENCIAS: Record<string, string> = {
  argentin: 'Argentina', brasil: 'Brasil', colombian: 'Colombia', ecuatorian: 'Ecuador', japon: 'Japón', corean: 'Corea',
  chilen: 'Chile', mexican: 'México', chin: 'China', venezolan: 'Venezuela', americano: 'Estados Unidos', gringo: 'Estados Unidos',
}

/**
 * Nombres comerciales de Ecuador → nombre con el que el modelo aparece en Wikipedia
 * (p. ej., el Mazda Allegro es el Mazda 323; el Chevrolet Esteem es el Suzuki Baleno).
 */
export const ARTICULO_EQUIVALENTE: Record<string, string> = {
  'mazda allegro': 'Mazda 323',
  'chevrolet vitara': 'Suzuki Vitara',
  'chevrolet grand vitara': 'Suzuki Grand Vitara',
  'chevrolet grand vitara sz': 'Suzuki Grand Vitara',
  'chevrolet aveo family': 'Chevrolet Aveo',
  'chevrolet aveo emotion': 'Chevrolet Aveo',
  'chevrolet aveo activo': 'Chevrolet Aveo',
  'chevrolet luv d-max': 'Isuzu D-Max',
  'chevrolet d-max': 'Isuzu D-Max',
  'chevrolet luv': 'Isuzu Faster',
  'chevrolet esteem': 'Suzuki Baleno',
  'chevrolet forsa': 'Suzuki Cultus',
  'chevrolet swift': 'Suzuki Swift',
  'chevrolet optra': 'Daewoo Lacetti',
  'chevrolet corsa evolution': 'Chevrolet Corsa',
  'fiat premio': 'Fiat Duna',
  'kia pregio': 'Kia Pregio',
  'renault sandero stepway': 'Renault Sandero',
}
