import type { CodeCityArchitectureBrief as CodeCityArchitectureBriefModel } from "./brief.js"

export type CodeCityArchitectureBriefProps = {
  readonly brief: CodeCityArchitectureBriefModel
  readonly onCopy: () => void
  readonly copied: boolean
}

export type CodeCityArchitectureBrief = CodeCityArchitectureBriefModel

export function CodeCityArchitectureBrief({
  brief,
  onCopy,
  copied,
}: CodeCityArchitectureBriefProps) {
  return (
    <section className="code-city__brief" aria-label="Architecture brief">
      <div className="code-city__brief-copy">
        <p className="code-city__eyebrow">Shareable summary</p>
        <h2>{brief.title}</h2>
        <p>{brief.lead}</p>
      </div>
      <dl>
        {brief.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              <span>{fact.value}</span>
              {fact.evidence.length > 0 ? (
                <ul aria-label={`${fact.label} evidence`}>
                  {fact.evidence.map((evidence) => (
                    <li key={`${evidence.label}:${evidence.href}`}>
                      <a href={evidence.href}>{evidence.label}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <div className="code-city__brief-actions">
        <p><strong>Next action:</strong> {brief.nextAction}</p>
        <button type="button" onClick={onCopy}>Copy brief</button>
      </div>
      <p className="code-city__brief-status" role="status">
        {copied
          ? "Brief copied to the clipboard."
          : "Copy failed. Select the brief text to copy it manually."}
      </p>
    </section>
  )
}

export default CodeCityArchitectureBrief
