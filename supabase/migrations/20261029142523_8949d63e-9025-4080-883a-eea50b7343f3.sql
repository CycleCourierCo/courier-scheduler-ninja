WITH m(issue_id, rname) AS (VALUES
 ('756180ba-3ed0-42a4-a958-94e9b4e00820','Gear cable replacement (per shifter, external)'),
 ('c682bc8a-488c-473b-ae19-dcd74dcae5fd','Tubeless refresh - sealant top-up (per wheel)'),
 ('ea0e2763-2130-4edf-9187-0f82a437520f','Tubeless refresh - sealant top-up (per wheel)'),
 ('a00ef118-4f8b-4c4b-b38d-35776daf5618','Wheel true - minor (lateral only)'),
 ('c5929f8e-b705-454c-a2f6-b17bed1be9a1','Hydraulic disc pad replacement (per caliper)'),
 ('f7b6769e-24e0-4ee8-9e8a-e656946e9133','Wheel true - minor (lateral only)'),
 ('4c67da62-6cd0-4497-9cea-80069432c21c','Rim brake inner/outer cable replacement (per brake, external)'),
 ('abc2f621-a9eb-4ebd-b5d6-4d6687d2e703','Wheel true - minor (lateral only)'),
 ('db46f142-40cc-43b9-b6f1-4f9c02734ec4','Wheel true - minor (lateral only)'),
 ('20edc913-122c-4c32-9d83-bb57672ef4c0','Hydraulic disc pad replacement (per caliper)'),
 ('aacecf31-4a9f-448a-a5e8-86cfaf92bd58','Chain replacement (incl. wear check, sizing, join)'),
 ('8853dd40-fecc-4f8c-a01f-94d4bfa188c3','Wheel true - minor (lateral only)'),
 ('8715d5cd-408f-4b5f-bde7-5f3e8a3598cd','Wheel true - minor (lateral only)'),
 ('24e33eb3-fe69-4011-be84-72e1aa7d8b7f','Hydraulic disc pad replacement (per caliper)'),
 ('6fa339a3-3d8f-4836-8146-324b37cbebc3','Chain replacement (incl. wear check, sizing, join)'),
 ('2dd2d730-259b-45a8-b8a5-20ad3d8bb9e3','Bar tape wrap (both sides)')
)
UPDATE public.inspection_issues ii SET repair_id = x.repair_id, labour_cost = x.price, estimated_cost = COALESCE(ii.parts_cost,0) + x.price
FROM (SELECT m.issue_id::uuid AS id, lt.repair_id,
  GREATEST(COALESCE(lt.min_charge_gbp,15), CEIL(lt.labour_minutes*75/60.0/5)*5) AS price
  FROM m JOIN public.inspection_issues i2 ON i2.id=m.issue_id::uuid
  JOIN public.bicycle_inspections bi ON bi.id=i2.inspection_id
  JOIN public.labour_times lt ON lt.bike_type=bi.bike_type AND lt.repair_name=m.rname) x
WHERE ii.id = x.id AND ii.repair_id IS NULL;