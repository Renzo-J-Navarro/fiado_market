ALTER TABLE stores
  ADD COLUMN contact_email VARCHAR(120) NULL,
  ADD COLUMN status ENUM('PENDING','ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE';

UPDATE stores s
JOIN users u ON u.store_id=s.id AND u.role='ADMIN'
SET s.contact_email=u.email;

ALTER TABLE users
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users SET active=FALSE WHERE role='ADMIN';
