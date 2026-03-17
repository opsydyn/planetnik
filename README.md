# Płanetnik

> read the weather of the machine

**Płanetnik** is a tool for documenting and analysing the architecture of complex software systems.

Built in the spirit of pragmatic architectural analytics, **Płanetnik** helps teams understand large codebases directly from the source. No long workshops. No endless interviews. Just show the code.

Płanetnik extracts structural signals from source repositories and turns them into usable insight about system shape, technical debt, coupling, complexity, ownership, drift, and entropy.

Where other tools stop at raw metrics, Płanetnik aims to reveal the **weather system** of the codebase:
the pressure fronts, storm zones, fault lines, unstable regions, and slow entropic decay that shape software delivery over time.

---

## what is płanetnik?

In Polish folklore, a **płanetnik** is a being associated with clouds, storms, hail, and shifting weather.

For this project, that metaphor becomes a way to think about software systems.

Large codebases have weather:

- pressure builds
- turbulence spreads
- local changes become system-wide storms
- fragile areas attract repeated disruption
- hidden structural debt shapes the forecast
- entropy pulls structure away from its intended form

**Płanetnik** exists to make that weather visible.

---

## why płanetnik?

Modern systems are often too large, too entangled, and too fast-moving to understand through documents alone.

Płanetnik provides a pragmatic and relatively inexpensive way to examine source code repositories and derive meaningful architectural insight from what is actually there, not what people remember, assume, or hope is true.

It helps you answer questions like:

- where is the codebase growing fastest?
- which parts of the system are most coupled?
- where is complexity starting to gather?
- which boundaries are healthy, and which are breaking down?
- what areas are structurally fragile?
- where does technical debt behave like a recurring storm front?
- where is entropy eroding architectural intent?
- how do code structure and team structure interact?
- what hidden forces are driving delivery pain?

---

## what płanetnik helps you see

Płanetnik helps make visible:

- **size**  
  how big different parts of the system are, and where growth is concentrated

- **complexity**  
  where cognitive load and implementation burden are increasing

- **coupling**  
  which modules, domains, or services pull too hard on each other

- **hotspots**  
  where structural risk, churn, and change pressure overlap

- **ownership**  
  how code and people interactions align or conflict

- **drift**  
  where the architecture is moving away from its intended shape

- **entropy**  
  where disorder is accumulating through unmanaged change, weakened boundaries, duplicated logic, and unclear responsibility

- **turbulence**  
  where the system experiences repeated instability, friction, and operational strain

- **team topology signals**  
  how delivery structure and software structure influence one another

---

## approach

Płanetnik follows a simple principle:

> Do not begin with stories. begin with the code.

The tool borrows from the spirit of code spelunking tools such as `grep`, but adds structure, modelling, and analysis on top of source-code searches.

Rather than treating the repository as an opaque blob, Płanetnik helps organise and interpret what is found:

- source patterns
- file groups
- module boundaries
- dependency signals
- historical pressure points
- ownership clues
- architectural zones
- areas of structural erosion

The result is a richer architectural picture built from evidence already present in the repository.

---

## core ideas

### 1. show the code

The fastest path to architectural truth often starts with direct inspection of the repository.

### 2. software has weather

Technical debt is not always a buried ruin.
Sometimes it is atmospheric:
diffuse, recurring, mobile, and only obvious when the pressure changes.

### 3. entropy is always at work

Without active design, systems drift.
Boundaries soften.
Responsibility spreads.
Local fixes accumulate.
The architecture becomes harder to reason about.

Płanetnik helps teams see that entropic movement before it becomes a full storm.

### 4. structure matters

Files, directories, modules, packages, domains, and boundaries all leave traces.
Płanetnik helps interpret those traces.

### 5. architecture should be observable

Architecture should not live only in slide decks and memory.
It should be measurable, inspectable, and reviewable.

### 6. socio-technical systems leave patterns

Code shape, change patterns, ownership, and team interaction often reinforce each other.
Płanetnik helps surface those relationships.

### 7. evidence beats ceremony

Rich architectural insight does not always require expensive process.
A great deal can be learned by examining the codebase with care, structure, and the right lens.

---

## the weather model

Płanetnik treats software systems as environments shaped by interacting forces.

### pressure

delivery demand, backlog load, rushed change, and local compromise

### turbulence

frequent breakage, unclear boundaries, unstable dependencies, and repeated rework

### storm fronts

areas where high change, high coupling, and high complexity converge

### drift

the slow movement away from intended architecture, domain boundaries, or operational clarity

### entropy

the background tendency of systems to decay into disorder unless actively maintained

### visibility

the ability to observe structural reality rather than rely on intuition alone

This is not just metaphor.
It is a practical lens for understanding why large systems become harder to change.

---

## use cases

Płanetnik is useful when you want to:

- document the architecture of a large codebase
- understand a legacy system
- prepare for domain decomposition
- examine monolith boundaries
- identify hotspots and unstable areas
- support modernisation efforts
- validate architectural assumptions
- detect erosion of intended boundaries
- make technical debt easier to discuss in concrete terms
- support engineering leadership with grounded structural insight
- improve conversations around ownership and team design
- detect where entropy is outpacing maintenance

---

## who it is for

Płanetnik is built for:

- architects
- staff and principal engineers
- tech leads
- platform teams
- engineering managers
- modernisation teams
- anyone trying to understand what a system is really doing beneath the surface

---

## philosophy

Płanetnik is not a replacement for engineering judgement.

It is a way to ground judgement in evidence.

It does not promise perfect truth.
It provides a better forecast.

Its goal is not to eliminate uncertainty, but to make hidden structure, mounting pressure, and entropic risk more legible.

---

## design goals

- **pragmatic**  
  useful on real repositories without massive setup

- **fast**  
  designed for iterative analysis, not slow ceremonial reporting

- **grounded**  
  based on the source itself

- **polyglot-friendly**  
  applicable across mixed-language codebases

- **architecture-aware**  
  focused on structural insight, not just code metrics

- **socio-technical**  
  aware that systems are shaped by both code and people

- **composable**  
  suitable for pipelines, automation, and repeatable analysis

- **entropy-conscious**  
  built to help teams spot decay before it hardens into chronic failure

---

## how it compares

Płanetnik sits somewhere between:

- source code search
- static architectural analysis
- repository intelligence
- socio-technical mapping
- lightweight architecture documentation
- technical debt observability

It is not just a metrics tool.
It is not just a grep wrapper.
It is not just a visualiser.

It is an attempt to make the **weather of the system** legible.

---

## example questions

- where are storm fronts forming in the codebase?
- which modules attract repeated change pressure?
- where is coupling strongest?
- which areas combine high size, high churn, and high complexity?
- where are boundaries porous or breaking down?
- where is entropy accumulating fastest?
- which teams are exposed to the most architectural turbulence?
- what parts of the system feel calm, but are structurally unstable underneath?
- what is the likely cost of leaving this area untouched for another quarter?

---

## roadmap

Planned capabilities may include:

- structural scans
- hotspot analysis
- dependency and coupling maps
- ownership overlays
- architectural fitness checks
- trend and drift reporting
- entropy indicators
- machine-readable outputs for pipelines
- rich terminal and web-based reports

---

## project status

Płanetnik is currently under active design and development.

The long-term aim is to build a modern architectural analysis engine with a strong focus on:

- source-first insight
- technical debt visibility
- architecture observability
- socio-technical awareness
- entropy detection
- pragmatic adoption

---

## name

The name **Płanetnik** comes from Polish folklore, where a płanetnik is associated with storms and changing weather.

That image felt right for this project.

Software systems develop pressure.
Debt gathers like clouds.
Complexity moves across boundaries.
Entropy wears away structure.
Instability rarely appears out of nowhere.

Płanetnik exists to help teams read that forecast.

---

## tagline

**Płanetnik**  
**read the weather of the machine**
