import { useMemo, useState } from "react";
import "./SecurityActionCenter.css";

type ActionFilter = "all" | "kev" | "critical" | "patch" | "exploit";

export type SecurityActionItem = {
  id: string;
  advisory: string;
  advisoryHref: string;
  repo: string;
  repoHref?: string;
  manifestPath?: string;
  severity: string;
  package: string;
  ecosystem: string;
  ageDays: number;
  sharedRepoCount: number;
  action: string;
  patchedVersion?: string;
  summary: string;
  knownExploited?: boolean;
  epssPercentile?: number | null;
  epssPercentileLabel?: string;
  hasPatch?: boolean;
  isExploitLikely?: boolean;
};

export type SecurityAdvisoryGroup = {
  id: string;
  advisory: string;
  advisoryHref: string;
  severity: string;
  summary: string;
  packageCount: number;
  repoCount: number;
  openCount: number;
  patchAvailableCount: number;
  knownExploited?: boolean;
  epssPercentile?: number | null;
  epssPercentileLabel?: string;
  isExploitLikely?: boolean;
  affectedRepos: Array<{
    id: string;
    repo: string;
    repoHref?: string;
    manifestPath?: string;
    package: string;
    ecosystem: string;
    ageDays: number;
    action: string;
    patchedVersion?: string;
  }>;
};

export type SecurityActionCenterProps = {
  title?: string;
  description?: string;
  items: ReadonlyArray<SecurityActionItem>;
  advisoryGroups: ReadonlyArray<SecurityAdvisoryGroup>;
};

const filterLabels: Record<ActionFilter, string> = {
  all: "All",
  kev: "KEV",
  critical: "Critical",
  patch: "Patch ready",
  exploit: "Exploit likely",
};

function normalizeSeverity(value: string | undefined) {
  return String(value ?? "low").toLowerCase();
}

function isCriticalSeverity(value: string | undefined) {
  return normalizeSeverity(value) === "critical";
}

function matchesFilter(
  filter: ActionFilter,
  item: {
    severity: string;
    knownExploited?: boolean;
    hasPatch?: boolean;
    isExploitLikely?: boolean;
  },
) {
  switch (filter) {
    case "kev":
      return item.knownExploited === true;
    case "critical":
      return isCriticalSeverity(item.severity);
    case "patch":
      return item.hasPatch === true;
    case "exploit":
      return item.isExploitLikely === true || item.knownExploited === true;
    default:
      return true;
  }
}

function severityClassName(severity: string) {
  const normalized = normalizeSeverity(severity);
  if (normalized === "critical") return "security-badge security-badge--critical";
  if (normalized === "high") return "security-badge security-badge--high";
  if (normalized === "medium") return "security-badge security-badge--medium";
  return "security-badge security-badge--low";
}

export default function SecurityActionCenter({
  title = "Action center",
  description = "Use the filters to isolate the issues that are most likely to bite first, then expand grouped advisories to see the affected repositories.",
  items,
  advisoryGroups,
}: SecurityActionCenterProps) {
  const [activeFilter, setActiveFilter] = useState<ActionFilter>("all");

  const counts = useMemo(() => ({
    all: items.length,
    kev: items.filter((item) => matchesFilter("kev", item)).length,
    critical: items.filter((item) => matchesFilter("critical", item)).length,
    patch: items.filter((item) => matchesFilter("patch", item)).length,
    exploit: items.filter((item) => matchesFilter("exploit", item)).length,
  }), [items]);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(activeFilter, item)),
    [activeFilter, items],
  );

  const filteredGroups = useMemo(
    () => advisoryGroups.filter((group) => matchesFilter(activeFilter, group)),
    [activeFilter, advisoryGroups],
  );

  return (
    <section className="security-action-center">
      <div className="security-action-center__intro">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="security-action-center__chips" role="toolbar" aria-label="Security filters">
        {(Object.keys(filterLabels) as ActionFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            className="security-action-center__chip"
            aria-pressed={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
          >
            <span>{filterLabels[filter]}</span>
            <span className="security-action-center__chip-count">{counts[filter]}</span>
          </button>
        ))}
      </div>

      {filteredItems.length > 0 ? (
        <div className="security-action-center__cards">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className={`security-action-card security-action-card--${normalizeSeverity(item.severity)}`}
            >
              <div className="security-action-card__header">
                <div className="security-action-card__title-wrap">
                  <p className="security-action-card__title">
                    <a href={item.advisoryHref}>{item.advisory}</a>
                  </p>
                  <div className="security-action-card__repo">
                    {item.repoHref ? (
                      <a href={item.repoHref}>{item.repo}</a>
                    ) : (
                      <span>{item.repo}</span>
                    )}
                    {item.manifestPath ? (
                      <span className="security-action-card__path">{item.manifestPath}</span>
                    ) : null}
                  </div>
                </div>
                <div className="security-badge-row">
                  <span className={severityClassName(item.severity)}>{item.severity}</span>
                  {item.knownExploited ? (
                    <span className="security-badge security-badge--kev">KEV</span>
                  ) : null}
                  {item.isExploitLikely ? (
                    <span className="security-badge security-badge--exploit">Exploit likely</span>
                  ) : null}
                  {item.hasPatch ? (
                    <span className="security-badge security-badge--patch">Patch ready</span>
                  ) : null}
                  {item.epssPercentileLabel && item.epssPercentileLabel !== "—" ? (
                    <span className="security-badge security-badge--epss">EPSS {item.epssPercentileLabel}</span>
                  ) : null}
                </div>
              </div>

              <p className="security-action-card__summary">{item.summary}</p>

              <div className="security-action-card__metrics">
                <div className="security-action-card__metric">
                  <span className="security-action-card__metric-label">Package</span>
                  <span className="security-action-card__metric-value">{item.package}</span>
                </div>
                <div className="security-action-card__metric">
                  <span className="security-action-card__metric-label">Ecosystem</span>
                  <span className="security-action-card__metric-value">{item.ecosystem}</span>
                </div>
                <div className="security-action-card__metric">
                  <span className="security-action-card__metric-label">Open</span>
                  <span className="security-action-card__metric-value">{item.ageDays} days</span>
                </div>
                <div className="security-action-card__metric">
                  <span className="security-action-card__metric-label">Repos affected</span>
                  <span className="security-action-card__metric-value">{item.sharedRepoCount}</span>
                </div>
                <div className="security-action-card__metric">
                  <span className="security-action-card__metric-label">Patch</span>
                  <span className="security-action-card__metric-value">{item.patchedVersion && item.patchedVersion !== "—" ? item.patchedVersion : "Review"}</span>
                </div>
              </div>

              <div className="security-action-card__footer">
                <span className="security-action-card__action">{item.action}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="security-action-center__empty">No actionable vulnerabilities match this filter.</div>
      )}

      <div>
        <div className="security-action-center__intro">
          <h3>Grouped advisory drilldowns</h3>
          <p>Expand an advisory to inspect the affected repositories without hauling a giant repo list through a single table cell.</p>
        </div>

        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <details key={group.id} className="security-advisory-group">
              <summary>
                <div className="security-advisory-group__summary-head">
                  <div>
                    <p className="security-advisory-group__title">
                      <a href={group.advisoryHref}>{group.advisory}</a>
                    </p>
                    <p className="security-advisory-group__summary">{group.summary}</p>
                    <div className="security-advisory-group__counts">
                      <span className={severityClassName(group.severity)}>{group.severity}</span>
                      {group.knownExploited ? (
                        <span className="security-badge security-badge--kev">KEV</span>
                      ) : null}
                      {group.isExploitLikely ? (
                        <span className="security-badge security-badge--exploit">Exploit likely</span>
                      ) : null}
                      {group.patchAvailableCount > 0 ? (
                        <span className="security-badge security-badge--patch">{group.patchAvailableCount} patch-ready</span>
                      ) : null}
                      {group.epssPercentileLabel && group.epssPercentileLabel !== "—" ? (
                        <span className="security-badge security-badge--epss">EPSS {group.epssPercentileLabel}</span>
                      ) : null}
                      <span className="security-badge security-badge--metric">{group.repoCount} repos</span>
                      <span className="security-badge security-badge--metric">{group.packageCount} packages</span>
                    </div>
                  </div>
                </div>
              </summary>
              <div className="security-advisory-group__content">
                {group.affectedRepos.map((repo) => (
                  <div key={repo.id} className="security-advisory-group__repo-row">
                    <div>
                      {repo.repoHref ? (
                        <a className="security-advisory-group__repo-link" href={repo.repoHref}>{repo.repo}</a>
                      ) : (
                        <span className="security-advisory-group__repo-link">{repo.repo}</span>
                      )}
                      {repo.manifestPath ? (
                        <div className="security-advisory-group__repo-path">{repo.manifestPath}</div>
                      ) : null}
                    </div>
                    <div className="security-advisory-group__summary">
                      {repo.package} · {repo.ecosystem} · open {repo.ageDays}d
                    </div>
                    <div className="security-advisory-group__repo-meta">
                      {repo.patchedVersion && repo.patchedVersion !== "—" ? (
                        <span className="security-badge security-badge--patch">{repo.patchedVersion}</span>
                      ) : null}
                      <span className="security-advisory-group__repo-action">{repo.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))
        ) : (
          <div className="security-action-center__empty">No advisory drilldowns match this filter.</div>
        )}
      </div>
    </section>
  );
}
