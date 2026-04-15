import React, { useState } from 'react';
import ChampionshipHistoryPreview from '../preview';
import { DRIVER_CHAMPIONS, CONSTRUCTOR_CHAMPIONS } from '../data/championshipHistory';
import { Crown, Users } from 'lucide-react';

export default function ChampionshipHistory() {
  const [tab, setTab] = useState('drivers');

  return (
    <div>
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'drivers',      label: 'Driver Championships',      icon: Crown },
          { id: 'constructors', label: 'Constructor Championships',  icon: Users },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 8,
              background: tab === t.id ? 'var(--accent-soft)' : 'var(--surface-hover)',
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

      <ChampionshipHistoryPreview
        champions={tab === 'drivers' ? DRIVER_CHAMPIONS : CONSTRUCTOR_CHAMPIONS}
        mode={tab}
      />
    </div>
  );
}
