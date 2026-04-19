/**
 * LanguageRegionGate — renders FirstLaunchConfirm when the app
 * hasn't yet captured a confirmed language + region, otherwise
 * passes children through.
 *
 * Wrap the app root:
 *   <AppSettingsProvider>
 *     <LanguageRegionGate>
 *       <App />
 *     </LanguageRegionGate>
 *   </AppSettingsProvider>
 */
import { useEffect, useState } from 'react';
import FirstLaunchConfirm, { isFirstLaunchComplete } from './onboarding/FirstLaunchConfirm.jsx';

export default function LanguageRegionGate({ children }) {
  const [done, setDone] = useState(() => isFirstLaunchComplete());

  // Re-check on mount in case another tab confirmed earlier.
  useEffect(() => {
    if (!done && isFirstLaunchComplete()) setDone(true);
  }, [done]);

  if (!done) {
    return <FirstLaunchConfirm onComplete={() => setDone(true)} />;
  }
  return children;
}
