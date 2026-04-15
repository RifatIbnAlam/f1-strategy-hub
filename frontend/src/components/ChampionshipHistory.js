import React from 'react';
import ChampionshipHistoryPreview from '../preview';
import { DRIVER_CHAMPIONS } from '../data/championshipHistory';

export default function ChampionshipHistory() {
  return <ChampionshipHistoryPreview champions={DRIVER_CHAMPIONS} />;
}
