-- Reduce OrganizationRole to the two roles WBOS actually uses: OWNER and MANAGER.
--
-- ADMIN, SALES, WAREHOUSE, FINANCE and VIEWER were never assignable: every
-- membership-creating code path (onboarding, the bootstrap seed, the demo seed)
-- writes OWNER, and there is no UI or API for changing a member's role. They
-- existed only as rungs on a numeric ladder in the authorization layer, where
-- SALES and WAREHOUSE shared a rank and therefore silently inherited each
-- other's permissions.
--
-- This migration is written to be safe rather than to assume that. If any row
-- still carries a removed value it is mapped to the nearest surviving role
-- BEFORE the type is narrowed, so the cast below cannot fail:
--   ADMIN                     -> OWNER    (elevated tier)
--   SALES, WAREHOUSE, FINANCE -> MANAGER  (operational tier)
--   VIEWER                    -> MANAGER  (no read-only role remains)
-- On a database where nothing but OWNER was ever written, all three statements
-- update zero rows.

UPDATE "organization_memberships" SET "role" = 'OWNER'   WHERE "role" = 'ADMIN';
UPDATE "organization_memberships" SET "role" = 'MANAGER' WHERE "role" IN ('SALES', 'WAREHOUSE', 'FINANCE');
UPDATE "organization_memberships" SET "role" = 'MANAGER' WHERE "role" = 'VIEWER';

-- PostgreSQL cannot drop a value from an enum, so the type is rebuilt.
ALTER TYPE "OrganizationRole" RENAME TO "OrganizationRole_old";

CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MANAGER');

ALTER TABLE "organization_memberships"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "OrganizationRole" USING ("role"::text::"OrganizationRole"),
  ALTER COLUMN "role" SET DEFAULT 'OWNER';

DROP TYPE "OrganizationRole_old";
