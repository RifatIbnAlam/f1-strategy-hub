import React, { useState } from 'react';
import ChampionshipHistoryView from './ChampionshipHistoryView';
import { DRIVER_CHAMPIONS, CONSTRUCTOR_CHAMPIONS } from '../data/championshipHistory';
import { Crown, Users } from 'lucide-react';

export default function ChampionshipHistory() {
  const [tab, setTab] = useState('drivers');

  const tabs = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist">
      {[
        { id: 'drivers',      label: 'Drivers',       icon: Crown },
        { id: 'constructors', label: 'Constructors',  icon: Users },
      ].map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => setTab(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8,
            background: tab === t.id ? 'var(--accent-soft)' : 'var(--app-bg-alt)',
            border: `1px solid ${tab === t.id ? 'var(--accent-border)' : 'var(--panel-border)'}`,
            color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <t.icon size={16} />
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChampionshipHistoryView
      champions={tab === 'drivers' ? DRIVER_CHAMPIONS : CONSTRUCTOR_CHAMPIONS}
      mode={tab}
      controls={tabs}
    />
  );
}
