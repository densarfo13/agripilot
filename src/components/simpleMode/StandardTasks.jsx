/**
 * StandardTasks.jsx — Standard Mode Tasks renderer (hard-split partner
 * of SimpleTasks).
 *
 * Re-exports the existing src/pages/AllTasksPage as the named symbol
 * `StandardTasks` so the runtime diagnostic + governance gate can
 * attest which renderer is active. AllTasksPage IS the full standard
 * tasks dashboard (cards / filters / list); this file is a thin
 * marker that pins its identity.
 */

import React from 'react';
import AllTasksPage from '../../pages/AllTasksPage.jsx';

export default function StandardTasks() {
  return <AllTasksPage />;
}
