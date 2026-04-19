/**
 * SupportSection — renders the shared SupportCard below the Today
 * stream. Uses the app-settings language context so all copy flows
 * through the same translator as the rest of the screen.
 */
import SupportCard from '../SupportCard.jsx';

export default function SupportSection() {
  return (
    <section data-testid="support-section">
      <SupportCard />
    </section>
  );
}
