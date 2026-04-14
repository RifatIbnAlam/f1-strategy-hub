"""
F1 Qualifying Gap Analysis
============================
Analyzes teammate qualifying gaps and generates mini-sector comparisons.
This type of analysis is used to evaluate driver performance
independent of car performance.

Usage:
    python qualifying_gap_analysis.py --year 2025 --races 5
"""

import argparse
import fastf1
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl
from collections import defaultdict
import os

fastf1.Cache.enable_cache('./cache')
mpl.rcParams['font.family'] = 'sans-serif'
mpl.rcParams['figure.facecolor'] = '#0a0a12'
mpl.rcParams['axes.facecolor'] = '#13132b'
mpl.rcParams['text.color'] = '#e0e0e0'
mpl.rcParams['axes.labelcolor'] = '#888888'
mpl.rcParams['xtick.color'] = '#666666'
mpl.rcParams['ytick.color'] = '#666666'

OUTPUT_DIR = '../docs/images'
os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_teammate_pairs(session):
    """Identify teammate pairs from session data."""
    results = session.results
    if results is None or results.empty:
        return []

    teams = results.groupby('TeamName')['Abbreviation'].apply(list).to_dict()
    pairs = []
    for team, drivers in teams.items():
        if len(drivers) >= 2:
            pairs.append((team, drivers[0], drivers[1]))
    return pairs


def analyze_qualifying_gaps(year, num_races=5):
    """
    Analyze teammate qualifying gaps across multiple races.
    Returns a DataFrame with gap data per team per race.
    """
    schedule = fastf1.get_event_schedule(year)
    race_events = schedule[schedule['EventFormat'] != 'testing'].head(num_races)

    all_gaps = []

    for _, event in race_events.iterrows():
        try:
            quali = fastf1.get_session(year, event['EventName'], 'Q')
            quali.load()

            pairs = get_teammate_pairs(quali)

            for team, d1, d2 in pairs:
                try:
                    d1_laps = quali.laps.pick_driver(d1)
                    d2_laps = quali.laps.pick_driver(d2)

                    d1_best = d1_laps.pick_fastest()
                    d2_best = d2_laps.pick_fastest()

                    if d1_best is not None and d2_best is not None:
                        t1 = d1_best['LapTime'].total_seconds()
                        t2 = d2_best['LapTime'].total_seconds()

                        # Gap in percentage
                        faster = min(t1, t2)
                        gap_pct = ((max(t1, t2) - faster) / faster) * 100
                        gap_sec = abs(t1 - t2)

                        faster_driver = d1 if t1 <= t2 else d2
                        slower_driver = d2 if t1 <= t2 else d1

                        all_gaps.append({
                            'race': event['EventName'],
                            'team': team,
                            'faster': faster_driver,
                            'slower': slower_driver,
                            'gap_sec': gap_sec,
                            'gap_pct': gap_pct,
                            'faster_time': faster,
                        })
                except Exception as e:
                    pass

        except Exception as e:
            print(f"Could not load {event['EventName']}: {e}")

    return pd.DataFrame(all_gaps)


def plot_teammate_gaps(gap_df, output_name='teammate_gaps.png'):
    """
    Horizontal bar chart showing average teammate qualifying gaps.
    """
    if gap_df.empty:
        print("No gap data to plot.")
        return

    # Calculate average gap per team
    team_gaps = gap_df.groupby('team').agg({
        'gap_sec': 'mean',
        'gap_pct': 'mean',
    }).sort_values('gap_sec')

    fig, ax = plt.subplots(figsize=(14, 8))

    colors = []
    TEAM_COLORS = {
        'Red Bull Racing': '#3671C6', 'Ferrari': '#E8002D', 'Mercedes': '#27F4D2',
        'McLaren': '#FF8000', 'Aston Martin': '#358C75', 'Alpine': '#FF87BC',
        'Williams': '#1868DB', 'Haas F1 Team': '#B6BABD', 'RB': '#6692FF',
        'Kick Sauber': '#52E252',
    }

    for team in team_gaps.index:
        color = TEAM_COLORS.get(team, '#888888')
        colors.append(color)

    bars = ax.barh(range(len(team_gaps)), team_gaps['gap_sec'] * 1000,
                   color=colors, height=0.6, edgecolor='#0a0a12')

    for bar, gap in zip(bars, team_gaps['gap_sec']):
        ax.text(bar.get_width() + 5, bar.get_y() + bar.get_height()/2,
                f'{gap*1000:.0f}ms ({gap:.3f}s)',
                ha='left', va='center', fontsize=10, color='#e0e0e0')

    ax.set_yticks(range(len(team_gaps)))
    ax.set_yticklabels(team_gaps.index, fontsize=11)
    ax.set_xlabel('Average Qualifying Gap (ms)', fontsize=12)
    ax.set_title('Teammate Qualifying Gaps — Season Average',
                 fontsize=16, fontweight='bold', color='white', pad=15)
    ax.grid(True, axis='x', alpha=0.1)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


def plot_gap_evolution(gap_df, output_name='gap_evolution.png'):
    """
    Line chart showing how teammate gaps evolve across the season.
    """
    if gap_df.empty:
        return

    TEAM_COLORS = {
        'Red Bull Racing': '#3671C6', 'Ferrari': '#E8002D', 'Mercedes': '#27F4D2',
        'McLaren': '#FF8000', 'Aston Martin': '#358C75',
    }

    fig, ax = plt.subplots(figsize=(14, 8))

    for team in gap_df['team'].unique():
        team_data = gap_df[gap_df['team'] == team].reset_index(drop=True)
        color = TEAM_COLORS.get(team, '#888888')

        # Signed gap (positive = driver1 ahead, negative = driver2 ahead)
        ax.plot(range(len(team_data)), team_data['gap_sec'] * 1000,
               marker='o', color=color, linewidth=2, markersize=5,
               label=team, alpha=0.8)

    ax.axhline(y=0, color='#e10600', linestyle='--', alpha=0.3)
    ax.set_xlabel('Race Number', fontsize=12)
    ax.set_ylabel('Gap (ms)', fontsize=12)
    ax.set_title('Teammate Qualifying Gap Trend',
                 fontsize=16, fontweight='bold', color='white', pad=15)
    ax.legend(fontsize=10, framealpha=0.3, loc='upper right')
    ax.grid(True, alpha=0.1)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='F1 Qualifying Gap Analysis')
    parser.add_argument('--year', type=int, default=2025)
    parser.add_argument('--races', type=int, default=5, help='Number of races to analyze')
    args = parser.parse_args()

    print(f"Analyzing {args.year} qualifying data ({args.races} races)...")
    gap_df = analyze_qualifying_gaps(args.year, args.races)

    if not gap_df.empty:
        print(f"Collected {len(gap_df)} gap data points")
        plot_teammate_gaps(gap_df)
        plot_gap_evolution(gap_df)

        # Print summary
        print("\n" + "=" * 60)
        print("  QUALIFYING GAP SUMMARY")
        print("=" * 60)
        for team in gap_df['team'].unique():
            team_data = gap_df[gap_df['team'] == team]
            avg_gap = team_data['gap_sec'].mean()
            print(f"  {team:30s} | Avg gap: {avg_gap*1000:.0f}ms ({avg_gap:.3f}s)")
        print("=" * 60)
    else:
        print("No data collected.")
