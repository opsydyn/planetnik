import type { DistributionItem } from "@planetnik/report-ui/charts/DistributionChart"
import DistributionChart from "@planetnik/report-ui/charts/DistributionChart"
import type { DonutItem } from "@planetnik/report-ui/charts/DonutChart"
import DonutChart from "@planetnik/report-ui/charts/DonutChart"
import type { HorizontalBarItem } from "@planetnik/report-ui/charts/HorizontalBarChart"
import HorizontalBarChart from "@planetnik/report-ui/charts/HorizontalBarChart"
import "./GenUiBetaBoard.css"

export type GenUiBetaTone = "calm" | "watch" | "alert"

interface GenUiBetaNavCard {
  readonly label: string
  readonly href: string
  readonly description: string
}

interface GenUiBetaTableRow {
  readonly name: string
  readonly context: string
  readonly signal: string
  readonly recommendedAction: string
}

export interface GenUiBetaBoardProps {
  readonly reportName: string
  readonly reportMode: "single_repository" | "landscape"
  readonly betaMessage: string
  readonly readinessTitle: string
  readonly readinessDetail: string
  readonly vocabulary: ReadonlyArray<string>
  readonly pressureSummary: {
    readonly eyebrow: string
    readonly title: string
    readonly metric: string
    readonly tone: GenUiBetaTone
    readonly details: ReadonlyArray<string>
  }
  readonly rankingTitle: string
  readonly rankingItems: ReadonlyArray<HorizontalBarItem>
  readonly severityTitle: string
  readonly severityItems: ReadonlyArray<DonutItem>
  readonly distributionTitle: string
  readonly distributionItems: ReadonlyArray<DistributionItem>
  readonly navigationCards: ReadonlyArray<GenUiBetaNavCard>
  readonly tableTitle: string
  readonly tableRows: ReadonlyArray<GenUiBetaTableRow>
}

function EmptyState({ message }: { message: string }) {
  return <div className="gen-ui-beta-empty">{message}</div>
}

export default function GenUiBetaBoard({
  reportName,
  reportMode,
  betaMessage,
  readinessTitle,
  readinessDetail,
  vocabulary,
  pressureSummary,
  rankingTitle,
  rankingItems,
  severityTitle,
  severityItems,
  distributionTitle,
  distributionItems,
  navigationCards,
  tableTitle,
  tableRows,
}: GenUiBetaBoardProps) {
  return (
    <div className="gen-ui-beta">
      <section className="gen-ui-beta-hero">
        <div>
          <p className="gen-ui-beta-eyebrow">Dedicated Gen UI beta</p>
          <h2 className="gen-ui-beta-title">Planetnik-specific component vocabulary trail</h2>
          <p className="gen-ui-beta-lede">
            This page is an isolated playground for pressure summaries, hotspot rankings, severity breakdowns, impact
            opportunities, suggested navigation cards, and report-shaped charts.
          </p>
        </div>
        <div className="gen-ui-beta-hero-meta">
          <span className="gen-ui-beta-pill">{reportMode === "landscape" ? "Landscape" : "Single repository"}</span>
          <span className="gen-ui-beta-pill">{reportName}</span>
        </div>
      </section>

      <div className="gen-ui-beta-top-grid">
        <article className={`gen-ui-beta-summary-card gen-ui-beta-summary-card--${pressureSummary.tone}`}>
          <p className="gen-ui-beta-card-eyebrow">{pressureSummary.eyebrow}</p>
          <div className="gen-ui-beta-summary-head">
            <h3>{pressureSummary.title}</h3>
            <span className="gen-ui-beta-summary-metric">{pressureSummary.metric}</span>
          </div>
          <ul className="gen-ui-beta-summary-list">
            {pressureSummary.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </article>

        <article className="gen-ui-beta-readiness-card">
          <p className="gen-ui-beta-card-eyebrow">Beta scope</p>
          <h3>{readinessTitle}</h3>
          <p>{readinessDetail}</p>
          <div className="gen-ui-beta-note">{betaMessage}</div>
        </article>
      </div>

      <section className="gen-ui-beta-vocabulary">
        <div className="gen-ui-beta-section-head">
          <h3>Vocabulary under trial</h3>
          <p>The future A2UI catalog should speak Planetnik, not generic dashboard-speak.</p>
        </div>
        <div className="gen-ui-beta-chip-row">
          {vocabulary.map((item) => (
            <span key={item} className="gen-ui-beta-chip">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="gen-ui-beta-chart-grid">
        <article className="gen-ui-beta-chart-card">
          <div className="gen-ui-beta-section-head">
            <h3>{rankingTitle}</h3>
            <p>Trial the ranked chart surface before we let the agent assemble it dynamically.</p>
          </div>
          {rankingItems.length > 0 ? (
            <HorizontalBarChart
              data={rankingItems}
              valueLabel={reportMode === "landscape" ? "lines of code" : "risk score"}
              maxItems={8}
              helpText="Existing chart component reused as a future Planetnik catalog target."
            />
          ) : (
            <EmptyState message="No ranking data available for this report yet." />
          )}
        </article>

        <article className="gen-ui-beta-chart-card">
          <div className="gen-ui-beta-section-head">
            <h3>{severityTitle}</h3>
            <p>Use severity as a compact cue for where the conversation should intensify next.</p>
          </div>
          {severityItems.length > 0 ? (
            <DonutChart
              data={severityItems}
              valueLabel="signals"
              helpText="A future A2UI surface can pair this with guidance and next actions."
            />
          ) : (
            <EmptyState message="Severity data is not available for this report mode yet." />
          )}
        </article>
      </section>

      <section className="gen-ui-beta-split-grid">
        <article className="gen-ui-beta-chart-card">
          <div className="gen-ui-beta-section-head">
            <h3>{distributionTitle}</h3>
            <p>Distribution views help the agent explain opportunity, pressure, and follow-up choices together.</p>
          </div>
          {distributionItems.length > 0 ? (
            <DistributionChart
              data={distributionItems}
              helpText="Useful for impact opportunities, repo pressure stacks, and compare-style flows."
            />
          ) : (
            <EmptyState message="No distribution data available for this report yet." />
          )}
        </article>

        <article className="gen-ui-beta-nav-card">
          <div className="gen-ui-beta-section-head">
            <h3>Suggested navigation cards</h3>
            <p>
              These are the sort of follow-up actions the agent should offer instead of leaving the user at a dead end.
            </p>
          </div>
          <div className="gen-ui-beta-nav-grid">
            {navigationCards.map((item) => (
              <a key={item.href} href={item.href} className="gen-ui-beta-nav-item">
                <span className="gen-ui-beta-nav-label">{item.label}</span>
                <span className="gen-ui-beta-nav-description">{item.description}</span>
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="gen-ui-beta-table-card">
        <div className="gen-ui-beta-section-head">
          <h3>{tableTitle}</h3>
          <p>Tables are part of the vocabulary too — not every good A2UI surface should end in confetti charts.</p>
        </div>
        {tableRows.length > 0 ? (
          <div className="gen-ui-beta-table-wrap">
            <table className="gen-ui-beta-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Context</th>
                  <th>Signal</th>
                  <th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={`${row.name}-${row.context}`}>
                    <td>{row.name}</td>
                    <td>{row.context}</td>
                    <td>{row.signal}</td>
                    <td>{row.recommendedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No table rows available for this report yet." />
        )}
      </section>
    </div>
  )
}
