import React, { useState } from 'react';
import { FileText, Copy, Download, Printer, Loader, Check } from 'lucide-react';
import { TIRE_COMPOUNDS } from '../data/constants';
import { buildBrief, briefToMarkdown } from '../models/brief';
import { formatRaceTime } from '../models/strategy';

const mono = { fontFamily: "'JetBrains Mono', monospace" };

const Card = ({ children, style, className }) => (
  <div className={className} style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

const Section = ({ title, children }) => (
  <div style={{ marginTop: 18 }}>
    <h4 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>{title}</h4>
    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
  </div>
);

const ActionButton = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: 'var(--app-bg-alt)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', cursor: 'pointer',
  }}>
    <Icon size={14} /> {label}
  </button>
);

/**
 * One-click, decision-ready summary of the simulator: the call, why, what
 * would change it, the in-race contingency and the assumptions. Exports as
 * Markdown or prints to PDF.
 */
export default function StrategyBrief({ circuit, options, userPlans, optimal }) {
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [briefKey, setBriefKey] = useState(null);
  // Fingerprint of everything the brief depends on, to flag it as stale.
  const inputsKey = JSON.stringify([circuit.name, circuit.basePace, options, userPlans.map(p => p.stints)]);

  const generate = () => {
    setBusy(true);
    // Let the spinner paint before ~10k simulated races run.
    setTimeout(() => {
      setBrief(buildBrief({ circuit, options, userPlans, optimal }));
      setBriefKey(inputsKey);
      setBusy(false);
    }, 30);
  };

  const markdown = brief ? briefToMarkdown(brief) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) { /* clipboard blocked; download still works */ }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy-brief-${circuit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Inputs changed since the brief was generated: it's stale.
  const stale = brief && briefKey !== inputsKey;

  return (
    <Card style={{ marginBottom: 24 }} className={brief ? 'print-area' : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Strategy Brief</span>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {brief && (
            <>
              <ActionButton icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy Markdown'} onClick={copy} />
              <ActionButton icon={Download} label=".md" onClick={download} />
              <ActionButton icon={Printer} label="Print / PDF" onClick={() => window.print()} />
            </>
          )}
          <button onClick={generate} disabled={busy} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: 'var(--accent)', color: '#fff', border: 'none', cursor: busy ? 'wait' : 'pointer',
          }}>
            {busy ? <Loader size={14} style={{ animation: 'pulse 1s infinite' }} /> : <FileText size={14} />}
            {brief ? 'Regenerate' : 'Generate brief'}
          </button>
        </div>
      </div>
      {!brief && (
        <p className="no-print" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Turns everything above into a one-page recommendation: the call, why, what would change it, the in-race
          safety-car plan, and the assumptions. Copy it as Markdown or save it as a PDF.
        </p>
      )}

      {brief && (
        <div>
          {stale && (
            <div className="no-print" style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>
              Inputs have changed since this brief was generated. Regenerate to update it.
            </div>
          )}
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 14 }}>
            Race Strategy Brief: {brief.circuit}
          </h3>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{brief.laps} laps · {brief.sims.toLocaleString()} simulated races per plan</div>

          <div style={{
            marginTop: 16, padding: 16, borderRadius: 10,
            background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-text)', letterSpacing: '1px' }}>RECOMMENDATION</div>
            <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 2, margin: '10px 0' }}>
              {brief.call.stints.map((s, i) => (
                <div key={i} style={{ flex: s.laps, background: TIRE_COMPOUNDS[s.compound].color }} />
              ))}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', ...mono }}>{brief.call.plan}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {brief.call.stops}-stop · expected {formatRaceTime(brief.call.expected)} · range {formatRaceTime(brief.call.p10)}–{formatRaceTime(brief.call.p90)} ·
              fastest in {(brief.call.winRate * 100).toFixed(0)}% of races
            </div>
          </div>

          <Section title="Why">
            <ul style={{ paddingLeft: 18 }}>
              {brief.runnerUp && (
                <li>Beats the next-best strategy ({brief.runnerUp.plan}) by <strong>{brief.runnerUp.margin.toFixed(1)}s</strong> on average.</li>
              )}
              {brief.runnerUp?.tooClose && (
                <li>That margin is within simulation noise: either plan is defensible, so decide on track position and tyre availability.</li>
              )}
              {brief.cleanRaceDisagrees
                ? <li>In a clean race {brief.cleanRaceDisagrees.plan} is faster, but it loses more when a safety car falls badly. This plan is the better bet once incidents are priced in.</li>
                : <li>It is also the fastest plan in a clean race, so the call doesn't depend on luck.</li>}
            </ul>
          </Section>

          <Section title="In-race contingency">
            <ul style={{ paddingLeft: 18 }}>
              {brief.contingency.map(c => (
                <li key={c.stop}>
                  Stop {c.stop} (planned lap {c.planned}, onto {TIRE_COMPOUNDS[c.nextCompound].label}): if a safety car comes out on
                  laps <strong>{c.windowFrom}–{c.windowTo}</strong>, box immediately for a cheap stop.
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What would change the call">
            {brief.sensitivity.length === 1 ? (
              <p>No safety-car rate between 0 and 3 per race changes the recommendation. The call is robust.</p>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {brief.sensitivity.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '3px 16px 3px 0', color: 'var(--text-muted)', whiteSpace: 'nowrap', ...mono }}>
                        {s.from === s.to ? s.from : `${s.from}–${s.to}`} SC/race
                      </td>
                      <td style={{ padding: '3px 0', color: 'var(--text-primary)', fontWeight: s.name === brief.call.name ? 700 : 400, ...mono }}>{s.plan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Assumptions">
            <ul style={{ paddingLeft: 18 }}>
              {brief.assumptions.map(a => <li key={a}>{a}</li>)}
            </ul>
          </Section>

          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 16 }}>Generated by Undercut. Model estimates, not team data.</p>
        </div>
      )}
    </Card>
  );
}
