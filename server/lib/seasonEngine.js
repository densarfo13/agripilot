function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getStageStarterTasks(cropType, stage, startDate) {
  const crop = String(cropType || '').toLowerCase();
  const stageKey = String(stage || '').toLowerCase();

  const taskSets = {
    planting: {
      default: [
        { title: 'Prepare land', description: 'Clear and prepare the field for planting.', offsetDays: 0 },
        { title: 'Plant crop', description: 'Plant seeds or seedlings at the recommended spacing.', offsetDays: 1 },
        { title: 'Check soil moisture', description: 'Make sure the field has enough moisture after planting.', offsetDays: 2 },
      ],
      maize: [
        { title: 'Prepare maize field', description: 'Clear weeds and prepare rows for maize planting.', offsetDays: 0 },
        { title: 'Plant maize seeds', description: 'Plant maize seeds at the right spacing and depth.', offsetDays: 1 },
        { title: 'Inspect germination area', description: 'Check seed emergence zones and moisture level.', offsetDays: 3 },
      ],
      tomato: [
        { title: 'Prepare tomato beds', description: 'Prepare nursery or raised beds for tomato planting.', offsetDays: 0 },
        { title: 'Transplant tomato seedlings', description: 'Move healthy seedlings to the main field.', offsetDays: 1 },
        { title: 'Inspect transplant stress', description: 'Check wilting, spacing, and soil moisture after transplanting.', offsetDays: 2 },
      ],
      rice: [
        { title: 'Prepare rice field', description: 'Level field and prepare planting area for rice.', offsetDays: 0 },
        { title: 'Plant rice', description: 'Plant or transplant rice according to local practice.', offsetDays: 1 },
        { title: 'Check standing water', description: 'Monitor moisture or water control after planting.', offsetDays: 2 },
      ],
      cassava: [
        { title: 'Prepare cassava mounds', description: 'Prepare ridges or mounds before planting cassava stems.', offsetDays: 0 },
        { title: 'Plant cassava stems', description: 'Plant healthy cassava cuttings at proper angle and depth.', offsetDays: 1 },
        { title: 'Inspect stem establishment', description: 'Check survival and moisture after planting.', offsetDays: 4 },
      ],
    },
    growing: {
      default: [
        { title: 'Inspect crop growth', description: 'Check crop condition and note weak areas.', offsetDays: 0 },
        { title: 'Check weed pressure', description: 'Inspect the field for weeds competing with the crop.', offsetDays: 2 },
        { title: 'Review water needs', description: 'Assess moisture and irrigation requirements.', offsetDays: 3 },
      ],
    },
    harvesting: {
      default: [
        { title: 'Inspect harvest readiness', description: 'Check maturity and prepare for harvest timing.', offsetDays: 0 },
        { title: 'Prepare harvest labor and tools', description: 'Make sure people and tools are ready for harvest.', offsetDays: 1 },
        { title: 'Plan storage or transport', description: 'Prepare storage, bags, or transport after harvest.', offsetDays: 2 },
      ],
    },
  };

  const stageTasks = taskSets[stageKey] || taskSets.planting;
  const selectedTasks = stageTasks[crop] || stageTasks.default || [];

  return selectedTasks.map((task) => ({
    title: task.title,
    description: task.description,
    status: 'pending',
    dueDate: addDays(startDate, task.offsetDays),
  }));
}

export { getStageStarterTasks };
