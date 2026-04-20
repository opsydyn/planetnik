import ReportA2uiSurface from "../intelligence/ReportA2uiSurface"

interface GenUiBetaA2uiProps {
  readonly slug: string
  readonly baseHref: string
}

export default function GenUiBetaA2ui({ slug, baseHref }: GenUiBetaA2uiProps) {
  return (
    <ReportA2uiSurface
      slug={slug}
      baseHref={baseHref}
      title="True A2UI renderer trail"
      description={
        <>
          This beta-only surface is rendered by <code>@copilotkit/a2ui-renderer</code> from a runtime-fetched Planetnik
          contract, with local client-side controls and hosted-safe action callbacks.
        </>
      }
      loadingMessage="Fetching the runtime-rendered beta surface contract… the pressure systems are still forming."
      emptyMessage={
        <>
          Try the <strong>Controls</strong> tab and stage a follow-up context, or use a navigation button to trigger a
          real A2UI action.
        </>
      }
      showLastAction
    />
  )
}
