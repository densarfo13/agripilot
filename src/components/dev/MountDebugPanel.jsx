/**
 * MountDebugPanel — thin wrapper that renders DebugSignalPanel
 * only when dev mode is active. Drop into your app root layout:
 *
 *   import MountDebugPanel from '@/components/dev/MountDebugPanel';
 *   // inside AppShell:
 *   <MountDebugPanel />
 *
 * Production builds tree-shake this to a no-op because
 * DebugSignalPanel itself checks `import.meta.env.DEV`.
 *
 * If you want to force the panel on in a production build (e.g.
 * for a QA demo), pass `force={true}`.
 */

import DebugSignalPanel from './DebugSignalPanel.jsx';

export default function MountDebugPanel(props = {}) {
  return <DebugSignalPanel {...props} />;
}
