/* Built-in exercise library. Custom exercises live in app state. */
window.EXERCISE_LIBRARY = [
  // Chest
  { id: 'bench-press', name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'incline-bench-press', name: 'Incline Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'db-bench-press', name: 'Dumbbell Bench Press', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'chest-fly-machine', name: 'Pec Deck Fly', muscle: 'Chest', equipment: 'Machine' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscle: 'Chest', equipment: 'Cable' },
  { id: 'chest-press-machine', name: 'Chest Press', muscle: 'Chest', equipment: 'Machine' },
  { id: 'dip', name: 'Dip', muscle: 'Chest', equipment: 'Bodyweight' },
  { id: 'push-up', name: 'Push-up', muscle: 'Chest', equipment: 'Bodyweight' },

  // Back
  { id: 'deadlift', name: 'Deadlift', muscle: 'Back', equipment: 'Barbell' },
  { id: 'barbell-row', name: 'Barbell Row', muscle: 'Back', equipment: 'Barbell' },
  { id: 'db-row', name: 'One-Arm Dumbbell Row', muscle: 'Back', equipment: 'Dumbbell' },
  { id: 'pull-up', name: 'Pull-up', muscle: 'Back', equipment: 'Bodyweight' },
  { id: 'chin-up', name: 'Chin-up', muscle: 'Back', equipment: 'Bodyweight' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscle: 'Back', equipment: 'Cable' },
  { id: 't-bar-row', name: 'T-Bar Row', muscle: 'Back', equipment: 'Barbell' },
  { id: 'chest-supported-row', name: 'Chest-Supported Row', muscle: 'Back', equipment: 'Machine' },
  { id: 'back-extension', name: 'Back Extension', muscle: 'Back', equipment: 'Bodyweight' },

  // Shoulders
  { id: 'overhead-press', name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell' },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'arnold-press', name: 'Arnold Press', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscle: 'Shoulders', equipment: 'Cable' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'face-pull', name: 'Face Pull', muscle: 'Shoulders', equipment: 'Cable' },
  { id: 'shrug', name: 'Shrug', muscle: 'Shoulders', equipment: 'Dumbbell' },

  // Arms
  { id: 'barbell-curl', name: 'Barbell Curl', muscle: 'Arms', equipment: 'Barbell' },
  { id: 'db-curl', name: 'Dumbbell Curl', muscle: 'Arms', equipment: 'Dumbbell' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle: 'Arms', equipment: 'Dumbbell' },
  { id: 'preacher-curl', name: 'Preacher Curl', muscle: 'Arms', equipment: 'Machine' },
  { id: 'cable-curl', name: 'Cable Curl', muscle: 'Arms', equipment: 'Cable' },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', muscle: 'Arms', equipment: 'Cable' },
  { id: 'overhead-triceps-ext', name: 'Overhead Triceps Extension', muscle: 'Arms', equipment: 'Cable' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscle: 'Arms', equipment: 'Barbell' },
  { id: 'close-grip-bench', name: 'Close-Grip Bench Press', muscle: 'Arms', equipment: 'Barbell' },

  // Legs
  { id: 'back-squat', name: 'Back Squat', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'front-squat', name: 'Front Squat', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'goblet-squat', name: 'Goblet Squat', muscle: 'Legs', equipment: 'Dumbbell' },
  { id: 'leg-press', name: 'Leg Press', muscle: 'Legs', equipment: 'Machine' },
  { id: 'hack-squat', name: 'Hack Squat', muscle: 'Legs', equipment: 'Machine' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscle: 'Legs', equipment: 'Dumbbell' },
  { id: 'walking-lunge', name: 'Walking Lunge', muscle: 'Legs', equipment: 'Dumbbell' },
  { id: 'leg-extension', name: 'Leg Extension', muscle: 'Legs', equipment: 'Machine' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'leg-curl', name: 'Lying Leg Curl', muscle: 'Legs', equipment: 'Machine' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', muscle: 'Legs', equipment: 'Machine' },
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', muscle: 'Legs', equipment: 'Machine' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', muscle: 'Legs', equipment: 'Machine' },

  // Glutes
  { id: 'hip-thrust', name: 'Hip Thrust', muscle: 'Glutes', equipment: 'Barbell' },
  { id: 'glute-bridge', name: 'Glute Bridge', muscle: 'Glutes', equipment: 'Bodyweight' },
  { id: 'cable-kickback', name: 'Cable Kickback', muscle: 'Glutes', equipment: 'Cable' },
  { id: 'hip-abduction', name: 'Hip Abduction', muscle: 'Glutes', equipment: 'Machine' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', muscle: 'Glutes', equipment: 'Kettlebell' },

  // Core
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscle: 'Core', equipment: 'Cable' },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'russian-twist', name: 'Russian Twist', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'pallof-press', name: 'Pallof Press', muscle: 'Core', equipment: 'Cable' },
  { id: 'decline-crunch', name: 'Decline Crunch', muscle: 'Core', equipment: 'Bodyweight' },
];
