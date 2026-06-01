/**
 * src/modes/simple/SimpleHome.jsx — spec-canonical Simple Home renderer.
 *
 * Hard-split partner of src/modes/standard/StandardHome.jsx. Re-exports
 * the real component (src/components/simpleMode/SimpleHome.jsx) so the
 * spec import path resolves and the governance gate (check-simple-mode-
 * hard-split) can attest both renderers exist on disk without us
 * duplicating the source.
 */
export { default } from '../../components/simpleMode/SimpleHome.jsx';
