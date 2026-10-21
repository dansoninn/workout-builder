// Locked equipment list, approved by Daniel 2026-10-21 (Step 2).
// Order here is display order. Bodyweight is not equipment: an exercise with
// no equipment is a bodyweight exercise.

export const EQUIPMENT = [
  { key: "barbell", label: "Barbell" },
  { key: "trap_bar", label: "Trap bar" },
  { key: "dumbbell", label: "Dumbbell" },
  { key: "kettlebell", label: "Kettlebell" },
  { key: "medicine_ball", label: "Medicine ball" },
  { key: "slam_ball", label: "Slam ball" },
  { key: "sandbag", label: "Sandbag" },
  { key: "weight_plate", label: "Weight plate" },
  { key: "bench", label: "Bench" },
  { key: "box", label: "Plyo box" },
  { key: "pull_up_bar", label: "Pull-up bar" },
  { key: "rings", label: "Gymnastic rings" },
  { key: "parallettes", label: "Parallettes" },
  { key: "dip_station", label: "Dip station" },
  { key: "climbing_rope", label: "Climbing rope" },
  { key: "jump_rope", label: "Jump rope" },
  { key: "ghd", label: "GHD" },
  { key: "ab_mat", label: "Ab mat" },
  { key: "resistance_band", label: "Resistance band" },
  { key: "cable_machine", label: "Cable machine" },
  { key: "landmine", label: "Landmine" },
  { key: "sled", label: "Sled" },
  { key: "rower", label: "Rower" },
  { key: "ski_erg", label: "Ski erg" },
  { key: "air_bike", label: "Air bike" },
  { key: "bike_erg", label: "Bike erg" },
] as const;

export type EquipmentKey = (typeof EQUIPMENT)[number]["key"];
