import type { Community, District, Listing, ListingPhoto } from '../models/marketplace.models';

const photo = (src: string, alt: string, credit: string): ListingPhoto => ({ src, alt, credit });

const backpack = photo(
  'https://images.unsplash.com/photo-1588072432837-0e9495d22363?auto=format&fit=crop&w=900&q=85',
  'Mochila escolar floreada de frente y abierta; cremalleras visibles. Foto: CDC en Unsplash.',
  'CDC en Unsplash',
);
const fan = photo(
  'https://images.unsplash.com/photo-1682562837524-16133e2e8cf3?auto=format&fit=crop&w=900&q=85',
  'Ventilador doméstico usado en una sala, rejilla y base visibles. Foto: Pshyduc. Photo en Unsplash.',
  'Pshyduc. Photo en Unsplash',
);
const chair = photo(
  'https://images.unsplash.com/photo-1781699157635-b0f11cbcdb83?auto=format&fit=crop&w=900&q=85',
  'Silla auxiliar amarilla usada junto a un ventilador doméstico. Foto: yoonzooo kang en Unsplash.',
  'yoonzooo kang en Unsplash',
);
const bicycle = photo(
  'https://images.unsplash.com/photo-1693438129189-cb04cc0d153d?auto=format&fit=crop&w=900&q=85',
  'Bicicleta urbana usada fotografiada de perfil en un patio, cuadro completo visible. Foto: Yelitsa Suazo en Unsplash.',
  'Yelitsa Suazo en Unsplash',
);
const books = photo(
  'https://images.unsplash.com/photo-1700426833922-94e0de183ddb?auto=format&fit=crop&w=900&q=85',
  'Libros usados apilados sobre un escritorio, cubiertas y lomos visibles. Foto: Хитрун Полина en Unsplash.',
  'Хитрун Полина en Unsplash',
);
const lamp = photo(
  'https://images.unsplash.com/photo-1713879429592-bd55b09d8015?auto=format&fit=crop&w=900&q=85',
  'Lámpara de escritorio usada sobre una mesa, detalle de la base y luz natural. Foto: Steffen Petermann en Unsplash.',
  'Steffen Petermann en Unsplash',
);

const limaDistricts: readonly { id: District['id']; name: string }[] = [
  { id: 'ancon', name: 'Ancón' },
  { id: 'ate', name: 'Ate' },
  { id: 'barranco', name: 'Barranco' },
  { id: 'brena', name: 'Breña' },
  { id: 'carabayllo', name: 'Carabayllo' },
  { id: 'chaclacayo', name: 'Chaclacayo' },
  { id: 'chorrillos', name: 'Chorrillos' },
  { id: 'cieneguilla', name: 'Cieneguilla' },
  { id: 'comas', name: 'Comas' },
  { id: 'el-agustino', name: 'El Agustino' },
  { id: 'independencia', name: 'Independencia' },
  { id: 'jesus-maria', name: 'Jesús María' },
  { id: 'la-molina', name: 'La Molina' },
  { id: 'la-victoria', name: 'La Victoria' },
  { id: 'lima', name: 'Lima (Cercado)' },
  { id: 'lince', name: 'Lince' },
  { id: 'los-olivos', name: 'Los Olivos' },
  { id: 'lurigancho', name: 'Lurigancho (Chosica)' },
  { id: 'lurin', name: 'Lurín' },
  { id: 'magdalena-del-mar', name: 'Magdalena del Mar' },
  { id: 'miraflores', name: 'Miraflores' },
  { id: 'pachacamac', name: 'Pachacámac' },
  { id: 'pucusana', name: 'Pucusana' },
  { id: 'pueblo-libre', name: 'Pueblo Libre' },
  { id: 'puente-piedra', name: 'Puente Piedra' },
  { id: 'punta-hermosa', name: 'Punta Hermosa' },
  { id: 'punta-negra', name: 'Punta Negra' },
  { id: 'rimac', name: 'Rímac' },
  { id: 'san-bartolo', name: 'San Bartolo' },
  { id: 'san-borja', name: 'San Borja' },
  { id: 'san-isidro', name: 'San Isidro' },
  { id: 'san-juan-de-lurigancho', name: 'San Juan de Lurigancho' },
  { id: 'san-juan-de-miraflores', name: 'San Juan de Miraflores' },
  { id: 'san-luis', name: 'San Luis' },
  { id: 'san-martin-de-porres', name: 'San Martín de Porres' },
  { id: 'san-miguel', name: 'San Miguel' },
  { id: 'santa-anita', name: 'Santa Anita' },
  { id: 'santa-maria-del-mar', name: 'Santa María del Mar' },
  { id: 'santa-rosa', name: 'Santa Rosa' },
  { id: 'santiago-de-surco', name: 'Santiago de Surco' },
  { id: 'surquillo', name: 'Surquillo' },
  { id: 'villa-el-salvador', name: 'Villa El Salvador' },
  { id: 'villa-maria-del-triunfo', name: 'Villa María del Triunfo' },
];

const districtExamples: Partial<Record<District['id'], Pick<District, 'demoOfferCount' | 'communityCount' | 'neighbors' | 'pinColor'>>> = {
  miraflores: { demoOfferCount: 2, communityCount: 1, neighbors: ['surquillo', 'san-isidro', 'barranco'], pinColor: '#FFF1BE' },
  barranco: { demoOfferCount: 2, communityCount: 1, neighbors: ['miraflores', 'surquillo'], pinColor: '#F2E7FB' },
  surquillo: { demoOfferCount: 4, communityCount: 1, neighbors: ['miraflores', 'san-isidro', 'san-borja', 'barranco'], pinColor: '#E8DCF4' },
  'san-isidro': { demoOfferCount: 2, communityCount: 1, neighbors: ['miraflores', 'surquillo', 'san-borja'], pinColor: '#E9DEF5' },
  'san-borja': { demoOfferCount: 1, communityCount: 1, neighbors: ['surquillo', 'san-isidro'], pinColor: '#FBF0C9' },
  'pueblo-libre': { demoOfferCount: 1, communityCount: 1, neighbors: ['san-isidro'], pinColor: '#F8EFCF' },
};
const districtColors = ['#FFF1BE', '#F2E7FB', '#E8DCF4', '#E9DEF5', '#FBF0C9', '#F8EFCF'] as const;

export const DEMO_DISTRICTS: readonly District[] = limaDistricts.map((district, index) => {
  const example = districtExamples[district.id];
  const abbreviation = district.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toLocaleUpperCase('es-PE');
  return {
    ...district,
    abbreviation,
    demoOfferCount: example?.demoOfferCount ?? 0,
    communityCount: example?.communityCount ?? 0,
    neighbors: example?.neighbors ?? [],
    pinColor: example?.pinColor ?? districtColors[index % districtColors.length],
  };
});

export const DEMO_COMMUNITIES: readonly Community[] = [
  { id: 'surquillo-intercambia', name: 'Surquillo intercambia', districtId: 'surquillo', memberCount: 186, demoOfferCount: 4, isVerified: true, verificationSummary: 'Se comprobó quién administra el grupo y su relación con Surquillo. Eso no verifica cada publicación ni garantiza un intercambio.' },
  { id: 'miraflores-circular', name: 'Miraflores circular', districtId: 'miraflores', memberCount: 242, demoOfferCount: 2, isVerified: true, verificationSummary: 'Se comprobó quién administra el grupo y su relación con Miraflores. Eso no verifica cada publicación ni garantiza un intercambio.' },
  { id: 'barranco-comparte', name: 'Barranco comparte', districtId: 'barranco', memberCount: 129, demoOfferCount: 2, isVerified: true, verificationSummary: 'Se comprobó quién administra el grupo y su relación con Barranco. Eso no verifica cada publicación ni garantiza un intercambio.' },
  { id: 'san-isidro-circular', name: 'San Isidro circular', districtId: 'san-isidro', memberCount: 204, demoOfferCount: 2, isVerified: true, verificationSummary: 'Se comprobó quién administra el grupo y su relación con San Isidro. Eso no verifica cada publicación ni garantiza un intercambio.' },
  { id: 'san-borja-intercambia', name: 'San Borja intercambia', districtId: 'san-borja', memberCount: 171, demoOfferCount: 1, isVerified: true, verificationSummary: 'Se comprobó quién administra el grupo y su relación con San Borja. Eso no verifica cada publicación ni garantiza un intercambio.' },
  { id: 'pueblo-libre-comparte', name: 'Pueblo Libre comparte', districtId: 'pueblo-libre', memberCount: 114, demoOfferCount: 1, isVerified: true, verificationSummary: 'Se comprobó quién administra el grupo y su relación con Pueblo Libre. Eso no verifica cada publicación ni garantiza un intercambio.' },
];

export const DEMO_LISTINGS: readonly Listing[] = [
  { id: 'mochila-floreada', title: 'Mochila escolar floreada', description: 'Forro limpio y cremalleras funcionando; cabe un cuaderno A4.', kind: 'object', category: 'school', condition: 'Buen estado', districtId: 'surquillo', distanceKm: 1.4, photos: [backpack], accepts: ['object'], acceptanceSummary: 'Mochila escolar o útiles', ownerName: 'Camila R. · perfil de ejemplo' },
  { id: 'ventilador-tres-velocidades', title: 'Ventilador de mesa, 3 velocidades', description: 'Rejilla y base completas. Tiene marcas en la base; se puede probar.', kind: 'object', category: 'home', condition: 'Funciona con marcas de uso', districtId: 'surquillo', distanceKm: 2.1, photos: [fan], accepts: ['service'], acceptanceSummary: 'Ajuste de bicicleta', ownerName: 'Diego M. · perfil de ejemplo' },
  { id: 'silla-auxiliar', title: 'Silla auxiliar mostaza', description: 'Estructura firme; una pequeña marca en una pata, visible en la foto.', kind: 'object', category: 'home', condition: 'Funciona con marcas de uso', districtId: 'surquillo', distanceKm: 3.2, photos: [chair], accepts: ['object'], acceptanceSummary: 'Lámpara de escritorio', ownerName: 'Rosa L. · perfil de ejemplo' },
  { id: 'libros-diseno', title: 'Libros de diseño, 4 títulos', description: 'Lomos en buen estado. Algunas anotaciones a lápiz en dos páginas.', kind: 'object', category: 'books', condition: 'Funciona con marcas de uso', districtId: 'miraflores', distanceKm: 1.8, photos: [books], accepts: ['object', 'service'], acceptanceSummary: 'Maceta mediana o arreglo de ropa', ownerName: 'Jorge V. · perfil de ejemplo' },
  { id: 'lampara-escritorio', title: 'Lámpara de escritorio articulada', description: 'Luz cálida, interruptor y cable probados. Desgaste leve en la pintura.', kind: 'object', category: 'home', condition: 'Funciona con marcas de uso', districtId: 'miraflores', distanceKm: 2.6, photos: [lamp], accepts: ['object'], acceptanceSummary: 'Organizador de escritorio', ownerName: 'Ana P. · perfil de ejemplo' },
  { id: 'bicicleta-urbana', title: 'Bicicleta urbana rodado 26', description: 'Cambios funcionales; rasguño de 3 cm en el cuadro (se aprecia en la foto).', kind: 'object', category: 'mobility', condition: 'Funciona con marcas de uso', districtId: 'barranco', distanceKm: 1.2, photos: [bicycle], accepts: ['service', 'object'], acceptanceSummary: 'Mantenimiento de laptop o casco urbano', ownerName: 'Lucía T. · perfil de ejemplo' },
  { id: 'set-libros-infantiles', title: 'Set de cuentos infantiles', description: 'Seis cuentos completos, páginas limpias. Para niñas y niños desde 5 años.', kind: 'object', category: 'school', condition: 'Buen estado', districtId: 'pueblo-libre', distanceKm: 0.9, photos: [books], accepts: ['object'], acceptanceSummary: 'Juegos de mesa para niños', ownerName: 'Mariela G. · perfil de ejemplo' },
  { id: 'ventilador-barranco', title: 'Ventilador compacto de mesa', description: 'Tres velocidades; leve desgaste en la base. Está encendido en las fotos.', kind: 'object', category: 'home', condition: 'Funciona con marcas de uso', districtId: 'barranco', distanceKm: 2.3, photos: [fan], accepts: ['object'], acceptanceSummary: 'Libros de poesía', ownerName: 'Iván C. · perfil de ejemplo' },
  { id: 'reparacion-bicicleta', title: 'Ajuste básico de bicicleta', description: 'Regulo frenos y cambios; puedo ir en bicicleta por la zona.', kind: 'service', category: 'services', condition: 'Buen estado', districtId: 'san-isidro', distanceKm: 2.4, photos: [bicycle], accepts: ['object'], acceptanceSummary: 'Plantas o macetas pequeñas', ownerName: 'Marco D. · perfil de ejemplo' },
  { id: 'libros-ensayo', title: 'Libros de ensayo y fotografía', description: 'Tres libros. Cubiertas con marcas leves y páginas completas.', kind: 'object', category: 'books', condition: 'Funciona con marcas de uso', districtId: 'san-isidro', distanceKm: 1.6, photos: [books], accepts: ['service'], acceptanceSummary: 'Ajuste de persiana', ownerName: 'Valeria C. · perfil de ejemplo' },
  { id: 'silla-sanborja', title: 'Silla auxiliar de madera', description: 'Firme y estable; rayón visible en el asiento, no afecta el uso.', kind: 'object', category: 'home', condition: 'Funciona con marcas de uso', districtId: 'san-borja', distanceKm: 1.7, photos: [chair], accepts: ['object'], acceptanceSummary: 'Estante pequeño', ownerName: 'Elena F. · perfil de ejemplo' },
  { id: 'lampara-barranco', title: 'Lámpara con brazo flexible', description: 'Foco LED incluido. Probada antes de publicar; marcas menores en el pie.', kind: 'object', category: 'home', condition: 'Funciona con marcas de uso', districtId: 'surquillo', distanceKm: 1.9, photos: [lamp], accepts: ['service'], acceptanceSummary: 'Clases básicas de dibujo', ownerName: 'Pablo E. · perfil de ejemplo' },
];
