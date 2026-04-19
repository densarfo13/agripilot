/**
 * SecondaryTaskList — up to two "next up" tasks under the primary.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function SecondaryTaskList({ tasks = [] }) {
  const { t } = useAppSettings();

  return (
    <section style={S.section} data-testid="secondary-task-list">
      <h3 style={S.title}>{t('actionHome.secondary.title')}</h3>
      {tasks.length === 0 ? (
        <p style={S.muted}>{t('actionHome.secondary.empty')}</p>
      ) : (
        <ul style={S.list}>
          {tasks.slice(0, 2).map((task) => (
            <li key={task.id} style={S.item}>
              <div style={S.itemTitle}>{task.title}</div>
              {task.detail && <div style={S.itemDetail}>{task.detail}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const S = {
  section: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
  },
  title: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem' },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  itemTitle: { fontSize: '0.9375rem', fontWeight: 600 },
  itemDetail: { fontSize: '0.8125rem', color: '#9FB3C8', marginTop: '0.125rem' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
};
