-- Taxonomy version 1: initial values from SPEC-calculation-model v0.2.
-- This is production reference data, so it lives in a migration (not seed.sql).
-- Icelandic labels are drafts pending Daniel's review.

insert into public.taxonomy_versions (version, published_at, notes) values
  (1, '2026-10-20T00:00:00Z', 'Initial taxonomy: calc spec v0.2 §2 (patterns, planes, modalities, muscles) and §4.4 (effort levels).');

-- §2.1 Movement patterns
insert into public.movement_patterns (position, key, region, label_en, label_is) values
  ( 1, 'squat',    'lower',    'Squat',           'Hnébeygja'),
  ( 2, 'lunge',    'lower',    'Lunge',           'Framstig'),
  ( 3, 'hinge',    'lower',    'Hinge',           'Mjaðmabeygja'),
  ( 4, 'h_push',   'upper',    'Horizontal push', 'Lárétt pressa'),
  ( 5, 'v_push',   'upper',    'Vertical push',   'Lóðrétt pressa'),
  ( 6, 'h_pull',   'upper',    'Horizontal pull', 'Lárétt tog'),
  ( 7, 'v_pull',   'upper',    'Vertical pull',   'Lóðrétt tog'),
  ( 8, 'carry',    'systemic', 'Carry',           'Burður'),
  ( 9, 'core',     'core',     'Core',            'Miðja'),
  (10, 'rotation', 'core',     'Rotation',        'Snúningur'),
  (11, 'jump',     'lower',    'Jump',            'Hopp');

-- §2.2 Planes
insert into public.planes (position, key, label_en, label_is) values
  (1, 'sagittal',    'Sagittal',    'Sagittalplan'),
  (2, 'frontal',     'Frontal',     'Ennisplan'),
  (3, 'transverse',  'Transverse',  'Þverplan'),
  (4, 'multiplanar', 'Multiplanar', 'Fjölplana');

-- §2.3 Monostructural modalities. default_unit is how the modality is most
-- often prescribed; an exercise can override it.
insert into public.modalities (position, key, default_unit, label_en, label_is) values
  (1, 'run',       'distance_m', 'Run',       'Hlaup'),
  (2, 'row',       'distance_m', 'Row',       'Róður'),
  (3, 'bike',      'calories',   'Bike',      'Hjól'),
  (4, 'ski',       'distance_m', 'Ski',       'Skíðavél'),
  (5, 'jump_rope', 'reps',       'Jump rope', 'Sippuband'),
  (6, 'swim',      'distance_m', 'Swim',      'Sund'),
  (7, 'sled',      'distance_m', 'Sled',      'Sleði');

-- §2.4 Muscle groups (list to be finalised in Step 2)
insert into public.muscles (position, key, region, label_en, label_is) values
  ( 1, 'quads',         'lower', 'Quads',           'Framanvert læri'),
  ( 2, 'hamstrings',    'lower', 'Hamstrings',      'Aftanvert læri'),
  ( 3, 'glutes',        'lower', 'Glutes',          'Rassvöðvar'),
  ( 4, 'adductors',     'lower', 'Adductors',       'Innanvert læri'),
  ( 5, 'calves',        'lower', 'Calves',          'Kálfar'),
  ( 6, 'chest',         'upper', 'Chest',           'Brjóstvöðvar'),
  ( 7, 'lats',          'upper', 'Lats',            'Breiðasti bakvöðvi'),
  ( 8, 'upper_back',    'upper', 'Upper back',      'Efra bak'),
  ( 9, 'shoulders',     'upper', 'Shoulders',       'Axlir'),
  (10, 'biceps',        'upper', 'Biceps',          'Tvíhöfði'),
  (11, 'triceps',       'upper', 'Triceps',         'Þríhöfði'),
  (12, 'forearms_grip', 'upper', 'Forearms & grip', 'Framhandleggir og grip'),
  (13, 'abs',           'core',  'Abs',             'Kviðvöðvar'),
  (14, 'obliques',      'core',  'Obliques',        'Skáir kviðvöðvar'),
  (15, 'lower_back',    'core',  'Lower back',      'Mjóbak');

-- §4.4 Effort levels (approved mapping)
insert into public.effort_levels (position, key, label_en, label_is, rpe_min, rpe_max, rpe_calc, rir_min, rir_max) values
  (1, 'easy',     'Easy',     'Létt',     3, 4,  4,   4, null),
  (2, 'moderate', 'Moderate', 'Miðlungs', 5, 6,  6,   2, 3),
  (3, 'hard',     'Hard',     'Erfitt',   7, 8,  8,   0, 1),
  (4, 'max',      'Max',      'Hámark',   9, 10, 9.5, 0, 0);
