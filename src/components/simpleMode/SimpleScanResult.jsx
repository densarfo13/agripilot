/**
 * SimpleScanResult.jsx — Simple Mode scan-result renderer.
 *
 * Hard-split partner of StandardScanResult. Renders only:
 *   Plant / Problem / Do this / Next + [DONE] [SCAN AGAIN]
 *
 * No confidence percentages, no provider name, no raw taxonomy, no
 * long explanation. The card uses hedged language
 * (possible / likely / needs review) — never "confirmed" / "guaranteed".
 *
 * This file wraps the existing SimpleModeScanCard so the
 * spec-mandated component name `SimpleScanResult` exists as a stable
 * named symbol the diagnostic + gate can attest.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import SimpleModeScanCard from './SimpleModeScanCard.jsx';

export default function SimpleScanResult(props) {
  const navigate = useNavigate();
  const onScanAgain = () => { try { navigate('/scan'); } catch { /* swallow */ } };
  const onSavePlant = () => { try { navigate('/my-plants'); } catch { /* swallow */ } };
  const onCreateTask = () => { try { navigate('/tasks'); } catch { /* swallow */ } };
  return (
    <SimpleModeScanCard
      plantName={props.plantName}
      problemLabel={props.problemLabel}
      doThis={props.doThis}
      nextStep={props.nextStep}
      onSavePlant={props.onSavePlant || onSavePlant}
      onCreateTask={props.onCreateTask || onCreateTask}
      onScanAgain={props.onScanAgain || onScanAgain}
      testId="simple-scan-result"
    />
  );
}
