-- Drop existing foreign key if exists
ALTER TABLE IF EXISTS games DROP CONSTRAINT IF EXISTS games_competition_id_fkey;

-- Recreate the foreign key constraint with explicit name
ALTER TABLE games
    ADD CONSTRAINT games_competition_id_fkey
    FOREIGN KEY (competition_id)
    REFERENCES competitions(id)
    ON DELETE CASCADE;

-- Ensure index exists for the foreign key
CREATE INDEX IF NOT EXISTS idx_games_competition_id
    ON games(competition_id);