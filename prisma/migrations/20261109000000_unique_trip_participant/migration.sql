-- Existing duplicate invitations are merged deterministically: owner first,
-- then confirmed participant, then stable ID. Preserve the selected participant ID.
DELETE FROM participants WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY trip_id, lower(trim(email))
      ORDER BY is_owner DESC, is_confirmed DESC, id ASC
    ) AS duplicate_number FROM participants
  ) WHERE duplicate_number > 1
);
UPDATE participants SET email = lower(trim(email));
CREATE UNIQUE INDEX "participants_trip_id_email_key" ON "participants"("trip_id", "email");
