-- ============================================================
-- MonkeyTrueque · Datos de demostración (usuarios + productos)
-- ============================================================
-- Cómo usarlo:
--   1. Arranca el catálogo al menos una vez (Flyway crea las tablas).
--   2. En MySQL Workbench: File > Open SQL Script > este archivo > ⚡ Ejecutar.
--   3. Recarga la web: los productos ya aparecen.
-- Se puede ejecutar varias veces: INSERT IGNORE no duplica nada.
--
-- Usuarios que crea (usuario / contraseña):
--   demo_usuario   / Usuario123*    (Mateo Rojas, usuario normal)
--   demo_vecina    / Vecina123*     (Lucía Fernández, usuario normal)
--   demo_moderador / Moderador123*  (Valeria Torres, moderador)
-- Las contraseñas se guardan con BCrypt, igual que cuando alguien se registra en la web.
-- ============================================================

SET NAMES utf8mb4;
USE monkey_catalog;

-- 1) Cuentas para iniciar sesión (tabla app_users)
INSERT IGNORE INTO app_users (user_id, username, password_hash) VALUES
  ('11111111-1111-1111-1111-000000000001', 'demo_usuario',   '$2a$10$S8EVQWAPej1j5RR1t99VLu20q8XH.131h4Z2to5hoefxYjlHIPBV.'),
  ('11111111-1111-1111-1111-000000000002', 'demo_vecina',    '$2a$10$7rKhE9aFLc2FYwiaB9Jo0e65.XkkUhx/lp70Q6HK0XmrtHpTcnpwK'),
  ('11111111-1111-1111-1111-000000000003', 'demo_moderador', '$2a$10$acxAZnGInRhr00G3fSR21.jKxzLKcYaVli1yGlBWrDVqWGFg9uCPu');

-- 2) Perfil público de cada cuenta (tabla user_profiles)
INSERT IGNORE INTO user_profiles (user_id, display_name, district_id, description) VALUES
  ('11111111-1111-1111-1111-000000000001', 'Mateo Rojas',     'barranco',  'Me gusta la bici y los libros de diseño.'),
  ('11111111-1111-1111-1111-000000000002', 'Lucía Fernández', 'surquillo', 'Ordenando la casa: todo en buen estado.'),
  ('11111111-1111-1111-1111-000000000003', 'Valeria Torres',  'lince',     'Moderadora de la comunidad.');

-- 3) Rol de moderador (tabla moderation_staff)
INSERT IGNORE INTO moderation_staff (user_id, role, added_by) VALUES
  ('11111111-1111-1111-1111-000000000003', 'moderator', 'Datos-Demo.sql');

-- 4) Productos publicados (tabla listings): 22 en total
--    listing_mode: trade = trueque · sale = venta · gift = regalo
--    accepts: qué acepta a cambio (object = objeto, service = servicio)
INSERT IGNORE INTO listings
  (id, owner_id, owner_name, title, description, kind, listing_mode, sale_price, category, item_condition,
   district_id, acceptance_summary, accepts, photos_json, available, moderation_hidden)
VALUES
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Mochila escolar en buen estado', 'Mochila amplia, limpia y con cierres funcionando. Ideal para el inicio de clases.',
   'object', 'trade', NULL, 'school', 'Buen estado', 'surquillo', 'Útiles escolares o libros', 'object',
   '[{"src":"https://images.unsplash.com/photo-1588072432837-0e9495d22363?auto=format&fit=crop&w=900&q=85","alt":"Mochila escolar floreada","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Lámpara de escritorio', 'Lámpara articulada y funcional. Tiene marcas leves de uso en la base.',
   'object', 'sale', 35.00, 'home', 'Funciona con marcas de uso', 'miraflores', 'Pago al contado', 'object',
   '[{"src":"https://images.unsplash.com/photo-1713879429592-bd55b09d8015?auto=format&fit=crop&w=900&q=85","alt":"Lámpara de escritorio sobre una mesa","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000003', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Bicicleta urbana rodado 26', 'Cambios funcionales y frenos revisados. Tiene un rasguño pequeño en el cuadro.',
   'object', 'trade', NULL, 'mobility', 'Funciona con marcas de uso', 'barranco', 'Mantenimiento de laptop o casco urbano', 'object,service',
   '[{"src":"https://images.unsplash.com/photo-1693438129189-cb04cc0d153d?auto=format&fit=crop&w=900&q=85","alt":"Bicicleta urbana de perfil en un patio","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Libros de diseño y fotografía', 'Tres libros en buen estado; uno tiene algunas anotaciones a lápiz.',
   'object', 'trade', NULL, 'books', 'Buen estado', 'pueblo-libre', 'Maceta mediana o clases de dibujo', 'object,service',
   '[{"src":"https://images.unsplash.com/photo-1700426833922-94e0de183ddb?auto=format&fit=crop&w=900&q=85","alt":"Libros apilados sobre un escritorio","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000005', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Ventilador compacto de mesa', 'Ventilador de tres velocidades. Lo regalo porque me mudo y ya no lo necesito.',
   'object', 'gift', NULL, 'home', 'Funciona con marcas de uso', 'surquillo', 'Solo que lo recojas', 'object',
   '[{"src":"https://images.unsplash.com/photo-1682562837524-16133e2e8cf3?auto=format&fit=crop&w=900&q=85","alt":"Ventilador doméstico de mesa","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE);

-- 4b) 15 productos más (en total 20)
INSERT IGNORE INTO listings
  (id, owner_id, owner_name, title, description, kind, listing_mode, sale_price, category, item_condition,
   district_id, acceptance_summary, accepts, photos_json, available, moderation_hidden)
VALUES
  ('22222222-2222-2222-2222-000000000006', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Audífonos inalámbricos', 'Audífonos over-ear con bluetooth. La batería dura todo el día y el sonido es muy claro.',
   'object', 'sale', 120.00, 'electronics', 'Buen estado', 'san-isidro', 'Pago al contado', 'object',
   '[{"src":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85","alt":"Audífonos negros sobre fondo amarillo","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000007', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Zapatillas deportivas talla 40', 'Zapatillas rojas para correr, usadas pocas veces. Me quedaron chicas.',
   'object', 'trade', NULL, 'clothing', 'Buen estado', 'santiago-de-surco', 'Zapatillas talla 38 o ropa deportiva', 'object',
   '[{"src":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85","alt":"Zapatilla deportiva roja","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000008', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Cámara instantánea Polaroid', 'Cámara que imprime la foto al momento. Funciona perfecto; no incluye rollos.',
   'object', 'trade', NULL, 'electronics', 'Funciona con marcas de uso', 'barranco', 'Audífonos o clases de fotografía', 'object,service',
   '[{"src":"https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=85","alt":"Cámara instantánea blanca","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000009', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Laptop para estudiar', 'Laptop de 13 pulgadas, ideal para clases virtuales y ofimática. Incluye cargador.',
   'object', 'sale', 1450.00, 'electronics', 'Funciona con marcas de uso', 'jesus-maria', 'Pago al contado', 'object',
   '[{"src":"https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85","alt":"Laptop abierta con luz morada","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000010', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Sofá de tres cuerpos verde', 'Sofá de terciopelo verde, cómodo y sin roturas. Hay que recogerlo en el departamento.',
   'object', 'sale', 650.00, 'home', 'Buen estado', 'miraflores', 'Pago al contado', 'object',
   '[{"src":"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85","alt":"Sofá verde en una sala","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000011', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Banco alto de madera', 'Banco de madera para cocina o barra. Firme, con algunas marcas de pintura.',
   'object', 'gift', NULL, 'home', 'Funciona con marcas de uso', 'pueblo-libre', 'Solo que lo recojas', 'object',
   '[{"src":"https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=85","alt":"Banco alto de madera clara","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000012', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Suculenta con maceta', 'Planta suculenta sana en maceta de cerámica. Necesita poca agua.',
   'object', 'gift', NULL, 'decor', 'Buen estado', 'surquillo', 'Solo que la cuides', 'object',
   '[{"src":"https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=85","alt":"Suculenta en maceta celeste","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000013', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Pelota de básquet', 'Pelota de básquet número 7, buen agarre. Se usó en cancha techada.',
   'object', 'trade', NULL, 'sports', 'Funciona con marcas de uso', 'san-borja', 'Pelota de fútbol o paleta de frontón', 'object',
   '[{"src":"https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=85","alt":"Pelota de básquet junto al aro","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000014', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Perfume de 100 ml', 'Perfume original, usado solo dos veces. Me regalaron otro igual.',
   'object', 'sale', 180.00, 'beauty', 'Buen estado', 'lince', 'Pago al contado', 'object',
   '[{"src":"https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=900&q=85","alt":"Frasco de perfume negro","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000015', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Casaca de cuero talla M', 'Casaca negra de cuero sintético, forro interior en buen estado.',
   'object', 'trade', NULL, 'clothing', 'Buen estado', 'san-miguel', 'Casaca jean o zapatillas talla 42', 'object',
   '[{"src":"https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85","alt":"Casaca de cuero negra","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000016', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Pack de 8 libros de emprendimiento', 'Libros de negocios y startups, en inglés. Buen estado, sin subrayar.',
   'object', 'trade', NULL, 'books', 'Buen estado', 'la-molina', 'Novelas o libros de cocina', 'object',
   '[{"src":"https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=85","alt":"Pila de libros de emprendimiento","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000017', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Guitarra acústica', 'Guitarra acústica con cuerdas nuevas. Tiene un rayón pequeño en la parte de atrás.',
   'object', 'trade', NULL, 'other', 'Funciona con marcas de uso', 'chorrillos', 'Clases de guitarra o un teclado', 'object,service',
   '[{"src":"https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=85","alt":"Persona tocando guitarra acústica","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000018', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Juguetes y peluches para bebé', 'Lote de peluches y juguetes de estimulación, todo lavado. Mi bebé ya creció.',
   'object', 'gift', NULL, 'babies', 'Buen estado', 'los-olivos', 'Solo que los recojas', 'object',
   '[{"src":"https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=85","alt":"Bebé jugando con peluches","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000019', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Figuras de colección Mario Bros', 'Cuatro figuras: Mario, Luigi, Peach y Yoshi. Para colección, sin cajas.',
   'object', 'trade', NULL, 'toys', 'Buen estado', 'san-juan-de-lurigancho', 'Videojuegos o figuras de anime', 'object',
   '[{"src":"https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=85","alt":"Figuras de Mario, Peach y Luigi","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000020', '11111111-1111-1111-1111-000000000002', 'Lucía Fernández',
   'Poncho tejido a mano', 'Poncho de hilo color crema, tejido a mano. Talla única.',
   'object', 'sale', 60.00, 'clothing', 'Buen estado', 'lima', 'Pago al contado', 'object',
   '[{"src":"https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=85","alt":"Poncho tejido color crema en un gancho","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE);

-- 4c) 2 productos de Mateo con fotos propias.
--     Las fotos están en frontend/public/assets/demo/ y las sirve la propia web (no Cloudinary).
INSERT IGNORE INTO listings
  (id, owner_id, owner_name, title, description, kind, listing_mode, sale_price, category, item_condition,
   district_id, acceptance_summary, accepts, photos_json, available, moderation_hidden)
VALUES
  ('22222222-2222-2222-2222-000000000021', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Mesa de ping pong Donic Team 303', 'Mesa de tenis de mesa plegable con ruedas y malla incluida. Se usó en interiores; la superficie está en buen estado.',
   'object', 'trade', NULL, 'sports', 'Funciona con marcas de uso', 'san-isidro', 'Bicicleta estática o equipo de gimnasio', 'object',
   '[{"src":"/assets/demo/mesa-ping-pong.jpg","alt":"Mesa de ping pong negra con malla","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE),

  ('22222222-2222-2222-2222-000000000022', '11111111-1111-1111-1111-000000000001', 'Mateo Rojas',
   'Máquina expendedora de snacks', 'Máquina expendedora con 7 bandejas, teclado y lector de pagos. Ideal para oficina o instituto.',
   'object', 'sale', 3500.00, 'other', 'Funciona con marcas de uso', 'san-isidro', 'Pago al contado', 'object',
   '[{"src":"/assets/demo/maquina-snacks.jpg","alt":"Máquina expendedora roja llena de snacks","credit":"Foto de demostración","publicId":null}]',
   TRUE, FALSE);

-- 4d) Fotos de perfil de Mateo y Lucía.
--     La foto se guarda en el perfil (user_profiles) y también en sus publicaciones
--     (listings.owner_image_url) y chats (monkey_exchange.conversations), donde se copia.
UPDATE user_profiles SET image_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&crop=faces&w=400&h=400&q=85'
 WHERE user_id = '11111111-1111-1111-1111-000000000001';
UPDATE user_profiles SET image_url = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&crop=faces&w=400&h=400&q=85'
 WHERE user_id = '11111111-1111-1111-1111-000000000002';
UPDATE listings l JOIN user_profiles p ON p.user_id = l.owner_id
   SET l.owner_image_url = p.image_url
 WHERE l.owner_id IN ('11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-000000000002');
UPDATE monkey_exchange.conversations c JOIN user_profiles p ON p.user_id = c.owner_id
   SET c.owner_image_url = p.image_url
 WHERE c.owner_id IN ('11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-000000000002');
UPDATE monkey_exchange.conversations c JOIN user_profiles p ON p.user_id = c.visitor_id
   SET c.visitor_image_url = p.image_url
 WHERE c.visitor_id IN ('11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-000000000002');

-- 5) Comprobar lo que se creó
SELECT u.username, p.display_name FROM app_users u JOIN user_profiles p ON p.user_id = u.user_id
 WHERE u.username LIKE 'demo_%';
SELECT COUNT(*) AS total_productos FROM listings WHERE id LIKE '22222222-%';
SELECT title, listing_mode, sale_price, owner_name FROM listings WHERE id LIKE '22222222-%' ORDER BY id;
