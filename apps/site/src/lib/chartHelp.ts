export const chartHelp = {
  home: {
    languageMix:
      "Shows which languages dominate total lines of code. If one language owns most of the system, concentrate standards, review depth, and refactoring effort there first.",
    languageBars:
      "Use this ranking to compare language footprint directly. Large secondary bars often signal integration or maintenance costs that the top-level summary can hide.",
  },
  landscape: {
    languageMix:
      "Shows which languages dominate the repositories in this landscape. Use the biggest slices to focus standards, staffing, and quality work where the org carries the most code.",
    topRepositories:
      "Ranks repositories by main lines of code. Start here to spot the systems that will dominate maintenance cost, review effort, and structural risk.",
    contributorActivity:
      "Shows which contributors are active across the most repositories or commits. Use it to distinguish broad organisational glue from isolated repo-local activity.",
    topology:
      "Shows cross-repository contributor coordination built from shared-file work. Dense clusters suggest collaboration hotspots; bridges often reveal fragile knowledge paths between repos.",
    tags:
      "Shows how repository tags group the landscape. Use it to see whether the org structure and the repo portfolio are balanced or overly concentrated in a few categories.",
  },
  overview: {
    mainLanguageMix:
      "Shows how main-scope lines of code are split by language. A dominant slice usually marks where architecture decisions and code health work will pay off fastest.",
    mainLanguageTreemap:
      "Each block represents a language footprint by size. Use it to spot outsized stacks that deserve targeted ownership, standards, or modernization work.",
    mainLanguageBars:
      "Compares main-scope language size directly. Prioritize quality gates and refactoring capacity on the languages with the largest bars.",
    testLanguageBars:
      "Shows where test code actually lives. If important production languages have small or missing test bars, add safety there before making large changes.",
  },
  commits: {
    yearlyTrends:
      "Tracks commits and contributors over time so you can separate growth, slowdown, and staffing shifts. Investigate years where change volume rises faster than contributor coverage.",
    activeContributors:
      "Shows how many contributors stayed active across the timeline. Use drops here to spot knowledge concentration and rising delivery risk.",
    byExtension:
      "Highlights which file types absorb the most change. High-commit extensions usually deserve stronger tests, clearer ownership, and closer hotspot review.",
  },
  contributors: {
    activitySegments:
      "Shows how the contributor base splits between rookies, active maintainers, and inactive contributors. A heavy rookie or inactive share usually means onboarding or continuity risk.",
    knowledgeDistribution:
      "Shows how widely knowledge is spread across components. Healthy systems have more balanced coverage and fewer extreme specialists.",
    topContributors:
      "Ranks contributors by total commits. If a few bars dominate, review ownership, backup coverage, and offboarding risk in those areas.",
  },
  concerns: {
    distribution:
      "Shows how much code each concern touches. Large concerns often deserve explicit boundaries and ownership because they can become cross-cutting maintenance drag.",
    topConcerns:
      "Ranks concerns by size so you can focus on the largest cross-cutting areas first. The biggest bars are usually where cleanup or modularization has the best payoff.",
  },
  duplication: {
    blockDistribution:
      "Shows how duplicate blocks are distributed by size. Large or numerous blocks are good candidates for extraction before change spreads more copy-paste risk.",
    mostDuplicatedFiles:
      'Ranks files by duplicate-block count. Start with files that are both highly duplicated and actively changed, because they compound future maintenance cost.',
  },
  components: {
    knowledgeCoverage:
      "Shows whether components rely on one owner, thin backup, or broader coverage. Single-owner-heavy systems need cross-training before velocity or resilience suffers.",
    sizeTreemap:
      "Shows component size as relative area. Large blocks deserve extra scrutiny because architecture friction there affects a bigger share of the codebase.",
    sizeBars:
      "Ranks components by lines of code. Use it to find oversized components that may need decomposition, boundary tightening, or stronger ownership.",
    busFactor:
      "Plots component size against contributor count. Large components with few contributors are the highest knowledge-risk candidates to rebalance.",
  },
  fileSize: {
    distribution:
      "Shows how files cluster by size band. A long tail of very large files usually signals review friction and refactoring opportunities.",
    largestFiles:
      "Ranks the biggest files by lines of code. Start with large files that also appear in hotspots, churn, or duplication views.",
  },
  dependencies: {
    matrix:
      "Shows static component dependencies across the selected decomposition. Dense crossing patterns usually point to boundary erosion or hidden coordination costs.",
    incoming:
      "Ranks components others depend on most. Heavily depended-on components need stable interfaces and careful change control.",
    outgoing:
      "Ranks components with the most outward dependencies. High outgoing dependence often signals orchestration components or blurred responsibilities.",
  },
  coupling: {
    mudChart:
      "Shows how static dependencies, temporal co-change, coordination overlap, and knowledge exposure combine into system pressure. Start with the outer orbit nodes that show high risk and then inspect which dimension dominates their load.",
    dimensionMix:
      "Shows the average coupling mix across the selected component model. If one slice dominates, make the next improvement cycle target that class of problem first.",
    dominantBreakdown:
      "Shows which coupling dimension dominates each component. A healthy model spreads risk instead of clustering too many components under one failure mode.",
    riskTierMix:
      "Shows how the current component set splits across coupling risk tiers. If the high or critical share grows, reduce system pressure in those boundaries before pushing more change through them.",
    topComponents:
      "Ranks the components with the highest systemic coupling risk. Start with high-risk items that also have clear explainability reasons and existing hotspot evidence.",
  },
  topology: {
    forceGraph:
      "Shows contributor links as a collaboration network. Dense clusters indicate tightly shared ownership, while isolated bridges highlight fragile cross-team touch points.",
  },
  temporalDependencies: {
    forceGraph:
      "Shows files that tend to change together in the current period and search scope. Tight clusters are good candidates for co-locating, simplifying, or extracting behind clearer boundaries.",
    strongestPairs:
      "Ranks the pairs with the highest shared-commit overlap. Start here when you want concrete coupling evidence for refactoring discussions.",
    hotspotFiles:
      "Ranks files that appear across the most coupling pairs. These files often act as coordination magnets and deserve boundary or ownership review.",
  },
  unitSize: {
    risk:
      "Shows how unit sizes split across risk bands. A large risky slice suggests review effort should shift toward breaking units into smaller, clearer pieces.",
    distribution:
      "Shows the full spread of unit sizes. Use it to see whether size problems are isolated outliers or a systemic habit across the codebase.",
  },
  fileAge: {
    overview:
      "Shows how files split across age bands. Older risky areas often need extra care because change has more history and hidden assumptions behind it.",
    distribution:
      "Shows the age spread of files so you can tell whether legacy risk is concentrated or widespread. Pair old age with churn and dependencies to prioritize safely.",
  },
  unitComplexity: {
    risk:
      "Shows how many units fall into each complexity risk band. If higher-risk slices grow, tighten review expectations and target simplification work there.",
    distribution:
      "Shows the overall complexity spread. A fat high-end tail usually means complexity is systemic rather than a few isolated outliers.",
    locVsComplexity:
      "Compares unit size and McCabe complexity together. Large, complex points deserve attention first because they are harder to change and easier to misunderstand.",
  },
  contributorDetail: {
    heatmap:
      "Shows when this contributor was active day by day. Look for long inactive periods, bursts, or sustained concentration that might affect ownership continuity.",
    activity:
      "Shows commit volume over time for this contributor. Spikes often align with feature pushes or firefighting, while long declines can indicate knowledge drift.",
    languageFootprint:
      "Shows which languages this contributor changed most. A very narrow footprint signals specialization; a broad one signals wider coordination value.",
    componentFootprint:
      "Ranks the components this contributor touched most. Use it to understand real ownership, backup depth, and likely offboarding impact.",
    collaborators:
      "Shows who shares the most files with this contributor. Strong ties often reveal de facto team boundaries and coordination hotspots.",
  },
  metrics: {
    locMix:
      "Shows how total LOC splits across main, test, generated, deployment, and support code. Use it to see whether maintenance effort is being carried by the right kinds of code.",
    mainLocByExtension:
      "Shows which extensions dominate production code. Large slices identify the languages where quality rules and refactoring effort matter most.",
  },
  controls: {
    status:
      "Shows how goals and controls are currently passing, failing, or tolerated. Treat failed slices as immediate policy breaks and tolerant slices as emerging debt.",
    goals:
      "Shows where controls are concentrated by goal. Goals with many failed or tolerant entries usually need the next round of engineering attention.",
  },
  churn: {
    commitsVsContributors:
      "Compares how often files change against how many people change them. Files high on both axes are common coordination hotspots.",
    sizeVsFrequency:
      "Compares file size to change frequency. Large, frequently changed files are strong refactoring candidates because risk compounds with every edit.",
    mostChanged:
      "Ranks files by total commits. Use it as an entry point, then cross-check duplication, complexity, and ownership before planning fixes.",
  },
  hotspots: {
    severity:
      "Shows how much of the ranked queue is critical, high, medium, or low severity. A large critical slice means the backlog needs risk reduction before more feature work.",
    byKind:
      "Shows whether hotspots are concentrated in files, units, or components. Fixing the dominant kind usually gives the fastest system-wide relief.",
    dominantRisk:
      "Shows which risk dimension most often drives the queue. Use it to decide whether the next investment should target structure, churn, coordination, or knowledge spread.",
    topItems:
      "Ranks the most urgent hotspots by score. Start with items that have both high score and a clear suggested action, then validate them against upcoming roadmap work.",
  },
  impact: {
    dimensionMix:
      "Shows which forms of structural impact dominate the current system. Use the biggest bars to decide whether the next round of staff-level work should simplify complexity, reshape boundaries, spread knowledge, reduce coordination drag, or enable safer future change.",
    topOpportunities:
      "Ranks the highest-leverage structural opportunities. Start with items that combine high impact score, strong reasons, and a suggested action you can turn into a concrete engineering move.",
    conceptMappings:
      "Maps the staff-level ideas to concrete Planetnik evidence. Use it to explain why an item matters in system terms rather than only in ticket or commit volume terms.",
    snacking:
      "Shows activity-heavy work with weak structural leverage. Treat these as warning signs that engineering energy may be getting pulled into visible motion instead of lasting system improvement.",
  },
} as const
