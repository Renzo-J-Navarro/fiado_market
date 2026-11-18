ALTER TABLE stores
  ADD COLUMN owner_dni CHAR(8) NULL;

UPDATE users u
JOIN stores s ON s.id=u.store_id
SET u.active=TRUE
WHERE u.role='ADMIN' AND s.status='ACTIVE' AND u.password_hash IS NOT NULL;
