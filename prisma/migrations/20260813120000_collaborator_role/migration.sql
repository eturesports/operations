-- A rank between VIEWER and EDITOR: may change what is already there —
-- roster links, player details, college profiles — but may not bring a
-- player record into existence or take one away.
--
-- Postgres appends the value to the end of the enum's declaration order,
-- which does not matter here: nothing sorts by it. The ordering that
-- decides permissions is the RANK map in src/lib/permissions.ts.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COLLABORATOR';
