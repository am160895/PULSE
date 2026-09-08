-- The third and final missing piece of Founding Scout, found only by testing the real
-- end-to-end award path after 0006/0007 fixed the config table, function, enum value, and
-- sequence_number column: migration 0004 (as originally written, not just as partially
-- applied) never inserted a 'badges' catalog row for FOUNDING_SCOUT, even though it added
-- the enum value. user_badges.badge_code has a foreign key to badges(code), so every real
-- award attempt was failing with a foreign-key violation on this exact constraint - one
-- layer deeper than the enum/column issues already fixed, and only reachable once those
-- were. Applied directly to the live database already (a plain data insert, not DDL) and
-- verified with a real end-to-end award (sequence_number 2); this migration exists so a
-- fresh database ends up in the same state.
insert into badges (code, name, description, motif, sort_order)
values ('FOUNDING_SCOUT', 'Founding Scout', 'One of the first 100 people to make a real contribution to PULSE.', 'founding-seal', 9)
on conflict (code) do nothing;
