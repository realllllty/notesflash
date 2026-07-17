ALTER TABLE notes ADD COLUMN mutation_id TEXT;

CREATE INDEX idx_notes_mutation_guard ON notes(id, version, mutation_id);
