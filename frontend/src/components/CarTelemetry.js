import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Loader } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { getCarData } from '../services/openf1';

/**
 * Turn OpenF1 car_data samples (~3.7 Hz) into a distance-based trace.
 * OpenF1 has no distance channel, so distance is integrated from speed using
 * the trapezoid rule between consecutive timestamps (the same approach
 * FastF1's add_distance() uses).
 */
export function buildDistanceTrace(samples, lapStartIso) {
  if (!samples?.length) return [];
  const t0 = new Date(lapStartIso).getTime();
  const sorted = [...samples].sort((a, b) => new Date(a.date) - new Date(b.date));
  let distance = 0;
  let prev = null;
  return sorted.map(s => {
    const t = new Date(s.date).getTime();
    if (prev) {
      const dt = (t - prev.t) / 1000;
      distance += ((prev.speed + s.speed) / 2 / 3.6) * dt;
    }
    prev = { t, speed: s.speed };
    return {
      time: +((t - t0) / 1000).toFixed(2),
      distance: Math.round(distance),
      speed: s.speed,
      throttle: Math.min(Math.max(s.throttle, 0), 100),
      brake: s.brake > 0 ? 100 : 0,
      gear: s.n_gear,
      rpm: s.rpm,
    };
  });
}

function summarise(trace) {
  if (!trace.length) return null;
  const n = trace.length;
  const fullThrottle = trace.filter(p => p.throttle >= 98).length / n;
  const braking = trace.filter(p => p.brake > 0).length / n;
  let brakeZones = 0;
  for (let i = 1; i < n; i++) if (trace[i].brake && !trace[i - 1].brake) brakeZones++;
  return {
    topSpeed: Math.max(...trace.map(p => p.speed)),
    minSpeed: Math.min(...trace.map(p => p.speed)),
    avgSpeed: trace.reduce((a, p) => a + p.speed, 0) / n,
    fullThrottle,
    braking,
    brakeZones,
    distance: trace[n - 1].distance,
  };
}

const tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 };

const Channel = ({ data, dataKey, color, height, domain, unit, step, label }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', margin: '8px 0 2px 4px' }}>
      {label}
    </div>
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} syncId="car-telemetry" margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
        <XAxis dataKey="distance" type="number" domain={['dataMin', 'dataMax']} stroke="var(--text-muted)" fontSize={10}
          tickFormatter={v => `${(v / 1000).toFixed(1)}km`} />
        <YAxis stroke="var(--text-muted)" fontSize={10} domain={domain} width={40} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={v => `${v} m`}
          formatter={(v) => [`${v}${unit}`, label]}
        />
        <Line type={step ? 'stepAfter' : 'monotone'} dataKey={dataKey} stroke={color} dot={false}
          strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default function CarTelemetry({ sessionKey, driverNumber, lap, color }) {
  const lapEnd = lap?.date_start && lap?.lap_duration
    ? new Date(new Date(lap.date_start).getTime() + lap.lap_duration * 1000).toISOString()
    : null;
  const enabled = !!(sessionKey && driverNumber && lap?.date_start && lapEnd);

  const { data: samples, loading, error } = useApi(
    () => getCarData(sessionKey, driverNumber, lap.date_start, lapEnd),
    [sessionKey, driverNumber, lap?.lap_number],
    enabled
  );

  const trace = useMemo(() => buildDistanceTrace(samples, lap?.date_start), [samples, lap]);
  const stats = useMemo(() => summarise(trace), [trace]);

  if (!enabled) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Telemetry needs a timed lap with a start timestamp.</div>;
  }
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader size={14} style={{ animation: 'pulse 1s infinite' }} /> Fetching car telemetry for lap {lap.lap_number}...
      </div>
    );
  }
  if (error || !trace.length) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No car telemetry available for lap {lap.lap_number}.</div>;
  }

  const statItems = [
    ['Top speed', `${stats.topSpeed} km/h`],
    ['Min speed', `${stats.minSpeed} km/h`],
    ['Avg speed', `${stats.avgSpeed.toFixed(0)} km/h`],
    ['Full throttle', `${(stats.fullThrottle * 100).toFixed(0)}%`],
    ['On brakes', `${(stats.braking * 100).toFixed(0)}%`],
    ['Braking zones', stats.brakeZones],
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 8 }}>
        {statItems.map(([k, v]) => (
          <div key={k} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--app-bg-alt)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{v}</div>
          </div>
        ))}
      </div>
      <Channel data={trace} dataKey="speed" color={color} height={180} domain={[0, 'auto']} unit=" km/h" label="SPEED" />
      <Channel data={trace} dataKey="throttle" color="#00C853" height={90} domain={[0, 100]} unit="%" label="THROTTLE" />
      <Channel data={trace} dataKey="brake" color="#FF1E1E" height={70} domain={[0, 100]} unit="" label="BRAKE" step />
      <Channel data={trace} dataKey="gear" color="#D4A800" height={90} domain={[0, 8]} unit="" label="GEAR" step />
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
        OpenF1 car_data sampled at ~3.7 Hz. Distance is integrated from speed ({(stats.distance / 1000).toFixed(2)} km this lap),
        so it can drift slightly from the official track length. Brake is an on/off channel.
      </div>
    </div>
  );
}
