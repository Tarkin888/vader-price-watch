
-- Drop defaults that reference enum types
ALTER TABLE collection ALTER COLUMN category DROP DEFAULT;
ALTER TABLE collection ALTER COLUMN grading DROP DEFAULT;

-- Convert columns to text
ALTER TABLE collection ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE collection ALTER COLUMN grading TYPE text USING grading::text;

-- Set new defaults
ALTER TABLE collection ALTER COLUMN category SET DEFAULT 'UNKNOWN';
ALTER TABLE collection ALTER COLUMN grading SET DEFAULT 'RAW-NM';

-- Update category values to cardback codes
UPDATE collection SET category = 'SW-12' WHERE category = '12 BACK';
UPDATE collection SET category = 'SW-20' WHERE category = '20 BACK';
UPDATE collection SET category = 'SW-21' WHERE category = '21 BACK';
UPDATE collection SET category = 'ESB-41' WHERE category = 'ESB';
UPDATE collection SET category = 'ROTJ-65' WHERE category = 'ROTJ';
UPDATE collection SET category = 'PAL-TL' WHERE category = 'TRILOGO';
UPDATE collection SET category = 'SW-12' WHERE category = 'SECRET OFFER';
UPDATE collection SET category = 'SW-12' WHERE category = 'FETT STICKER';
UPDATE collection SET category = 'UNKNOWN' WHERE category = 'OTHER';

-- Update grading values to grade tier codes
UPDATE collection SET grading = 'RAW-NM' WHERE grading = 'Not Graded';
UPDATE collection SET grading = 'AFA-75' WHERE grading = 'AFA 75';
UPDATE collection SET grading = 'AFA-80' WHERE grading = 'AFA 80';
UPDATE collection SET grading = 'AFA-85' WHERE grading = 'AFA 85';
UPDATE collection SET grading = 'AFA-90+' WHERE grading = 'AFA 90+';
UPDATE collection SET grading = 'UKG-80' WHERE grading = 'UKG 80';
UPDATE collection SET grading = 'UKG-85' WHERE grading = 'UKG 85';
UPDATE collection SET grading = 'CAS-80' WHERE grading = 'CAS 80';
UPDATE collection SET grading = 'CAS-85' WHERE grading = 'CAS 85';

-- Drop old enum types
DROP TYPE IF EXISTS collection_category CASCADE;
DROP TYPE IF EXISTS collection_grading CASCADE;
