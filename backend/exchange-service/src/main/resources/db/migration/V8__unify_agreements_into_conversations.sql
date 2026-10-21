-- Cada acuerdo pertenece a una conversación y una conversación puede tener varios
-- acuerdos a lo largo del tiempo (por ejemplo, una propuesta rechazada y otra aceptada).
ALTER TABLE exchanges
  DROP INDEX idx_exchanges_conversation,
  ADD INDEX idx_exchanges_conversation_created (conversation_id, created_at),
  ADD COLUMN meetup_proposed_by VARCHAR(16) NULL;

-- Las propuestas del flujo anterior no tenían conversación: se crea una por cada
-- par publicación/persona que propuso y se le asignan sus propuestas.
INSERT INTO conversations (id, listing_id, listing_title, listing_mode, owner_id, owner_name, visitor_id, visitor_name, status, created_at, updated_at)
SELECT UUID(), e.listing_id, MAX(e.listing_title), 'trade', MAX(e.owner_id), 'Usuario de MonkeyTrueque', e.proposer_id,
       'Usuario interesado', 'active', MIN(e.created_at), MAX(e.created_at)
FROM exchanges e
WHERE e.conversation_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.listing_id = e.listing_id AND c.visitor_id = e.proposer_id)
GROUP BY e.listing_id, e.proposer_id;

UPDATE exchanges e
JOIN conversations c ON c.listing_id = e.listing_id AND c.visitor_id = e.proposer_id
SET e.conversation_id = c.id
WHERE e.conversation_id IS NULL;

-- El chat propio de cada propuesta pasa al chat de su conversación.
INSERT INTO direct_messages (id, conversation_id, sender_id, body, created_at)
SELECT m.id, e.conversation_id, IF(m.sender = 'owner', e.owner_id, e.proposer_id), m.body, m.created_at
FROM exchange_messages m
JOIN exchanges e ON e.id = m.exchange_id
WHERE NOT EXISTS (SELECT 1 FROM direct_messages d WHERE d.id = m.id);
