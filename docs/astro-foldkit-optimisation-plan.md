# Optimising `@opsydyn/astro-foldkit`

**Date:** 2026-11-11
**Dogfood target:** `apps/foldkit-site`, the complexity report
**Baseline:** astro-foldkit 0.10.0, Astro 7.4.11, FoldKit 0.170.0

Everything below is measured on the pilot page, not reasoned about. The
measurements come first because they reorder the obvious priorities.

## Where the cost actually is

The pilot page after the payload split and chart pre-rendering:

| | |
|---|---|
| HTML | 83,198 raw / **11,934 gzip** |
| JavaScript | **377 KB decoded**, 17 requests |
| Rows chunk, fetched after paint | 620,714 raw / 52,541 gzip |

The HTML is now small. **The JavaScript is 32× the HTML**, and that is the
whole Core Web Vitals story — it is what TBT and INP are made of.

What the 377 KB is:

| chunk | KB | what it is |
|---|---|---|
| `schema.js` | **129** | Effect Schema |
| `client.js` | **116** | FoldKit runtime |
| `submodel.js` | 47 | FoldKit submodel |
| `interruptible.js` | 24 | FoldKit commands |
| `dataGrid.js` | 32 | our grid |
| `donut` + `scatter` + `render` + rest | ~29 | our charts |

**316 KB of the 377 KB is framework; about 60 KB is ours.** Per-island code
splitting already works — the donut is its own 8 KB chunk — and the runtime is
shared across all four islands rather than duplicated. Those are the things a
bundler usually gets wrong, and they are already right.

### What does not move the needle

Two things worth saying plainly, because they look like levers and are not:

**CLS and LCP do not change with pre-rendering, on localhost.** Measured on the
same page built both ways: CLS 0 either way, 0 layout shifts recorded, FCP 64 ms
pre-rendered and 72 ms not. The reason is in the numbers above — the last JS
response ends 8 ms *before* FCP. On a free network the JS wins the race and
there is nothing left to shift. Pre-rendering buys content-before-JS, and the
size of that prize is exactly the JS delivery time, which is zero here and
seconds on a cold 3G connection. Claiming a CWV win from these numbers would be
dishonest; the honest claim is that it removes a latency-shaped risk.

**Island CSS is already handled correctly.** A stylesheet imported by an island
module is traced through the renderer's module graph, minified and inlined into
every page that uses the island — including a page that ships no JavaScript at
all. Verified with a uniquely-named marker class. This was a suspected gap and
is not one.

## The headline: zero-JS islands already work

A pre-rendered island with **no client directive at all** renders fully and
ships nothing:

| probe page | raw | gzip | marks | islands | `<script>` |
|---|---|---|---|---|---|
| no directive, pre-rendered | 3,071 | **1,103** | 4 arcs | 0 | **0** |
| `client:load`, not pre-rendered | 6,364 | 2,557 | 0 | 1 | 2 |
| `client:load`, pre-rendered | 8,994 | 3,339 | 4 arcs | 1 | 2 |

Astro renders a directive-less component through `renderToStaticMarkup` and
emits no `astro-island` element, so with 0.10.0's `prerender: true` the result
is a complete FoldKit chart as static HTML with zero JavaScript, zero hydration
and zero runtime. Before 0.10.0 the same page produced an empty mount and a
blank chart.

This fell out of the pre-render work as a side effect. It is not documented, it
has no name, and it is the single largest optimisation available to any FoldKit
site, because **most charts in a report are never interacted with.**

## The plan, ranked by measured impact

### 1. Make the zero-JS path first-class — plugin, small

The capability exists; the affordance does not. An author has no way to know
that omitting the directive is a supported, supported-on-purpose choice rather
than a mistake.

- Document it in the README beside `prerender`, with the three-way table above.
- Add a dev-time diagnostic: when an island carries a client directive but its
  config exports no `update`, it can never respond to anything, so the directive
  is pure cost. Warn with the page and component name.
- Consider the inverse diagnostic: `prerender: true` with no directive is the
  zero-JS path and should be stated in the build summary, not inferred.

Dogfood in planetnik: audit the three charts for whether their hover actually
earns 377 KB. The donut's hover changes an arc radius and a legend highlight;
the distribution chart's tooltip is a title attribute away from being CSS-only.
If two of the three lose their directives, the page stops loading the runtime
for them entirely.

### 2. Get Effect Schema out of the island path — FoldKit, large

**129 KB, a third of all JavaScript on the page.** It arrives because
`defineMessageUnion` and the `Model` Schema are Schemas, and every island
declares both.

An island started with `embed` never decodes Flags — that is the hydration
path, and islands do not hydrate. The open question is whether anything reads
`Model.ast` at runtime for an embedded island, or whether the Schema is pure
build-time typing that survives into the bundle because it is a runtime value.

This is a FoldKit question, not a plugin one, but it is the biggest number on
the page and the plugin is where the cost is observed. Worth raising with the
measurement attached.

### 3. Per-island hydration — FoldKit, then plugin

The ask from amendment 8: scope `findDocumentHydration`'s root query to the
container and skip `assertSinglePageApplication` for an embedded caller.

With it, an island could adopt its pre-rendered markup instead of replacing it,
which turns `client:visible` into a real lever: hydrate only what is scrolled
to. Today every island with a directive hydrates at load whatever the user
looks at. Note that `client:visible` only became usable at all in 0.10.0 — an
empty mount measures 0×0 and never intersects.

### 4. `server:defer` support — plugin, medium

Astro's server islands currently defer a FoldKit island's *empty shell*, which
is worse than useless. With `prerender` the renderer already knows how to
produce markup from props; wiring it to the server-island path would let a
report defer an expensive chart without shipping a blank box. Needs an adapter,
so it is for the hosted apps rather than the static report site.

### 5. Props channel — plugin, low priority despite a big raw number

Astro serialises island props into an HTML attribute, wrapping every scalar as
`[0, value]`. On the grid's 7,729 rows that was **619,354 bytes of pure
overhead** — 464,774 from `&quot;` escaping and 154,580 from the wrapping.

It looks like the biggest number in this document, and it is nearly worthless:
under gzip the same overhead costs **7,150 bytes**. Compression eats repetitive
escaping. A `<script type="application/json">` channel, like the one
`definePage` already uses for Flags, would reclaim it — but rank it last and do
it for cleanliness, not speed.

### 6. A documented data-loading recipe — plugin docs, small

The row split built in planetnik is not plugin code and should not be, but it is
the pattern that took the page from 89,638 to 6,302 gzipped — far more than any
rendering decision. It deserves to be a named recipe in the plugin's docs:
inline one page, serve the rest as a prerendered JSON endpoint, fetch on boot,
keep the controls shut until it lands.

## What to do first

Items 1 and 2 are the whole plan, in that order. Item 1 is documentation and a
warning, and removes the runtime entirely for islands that do not need it. Item
2 is 129 KB and needs an upstream conversation. Items 3–6 are real but smaller,
and 5 is nearly cosmetic.

The thing not to do is optimise the HTML further. It is 11,934 bytes against
377,000 bytes of JavaScript.

---

## Executed, 2026-11-11: everything within our control

Three findings changed the plan above while carrying it out. The plan's ranking
was wrong in one important way, and the corrected version is below.

### Effect Schema is a no-go, and here is the proof

`runtime/runtime.js`, on every runtime start, unconditionally:

```js
const ModelJsonCodec = Schema.toCodecJson(Model)
const decodePreservedModel = Schema.decodeUnknownExit(ModelJsonCodec)
const encodePreservedModel = Schema.encodeUnknownSync(ModelJsonCodec)
```

Those three lines run whether or not anything uses them. The decode is reached
only when `preservedModel !== undefined`, which is the live-reload path and
never true in production. The codec is still built, so `Schema.toCodecJson`,
`decodeUnknownExit` and `encodeUnknownSync` are all retained, and `client.js`
imports the Schema module regardless of what an app declares.

So an app cannot shed those 129 KB by writing simpler Models or avoiding
`defineMessageUnion`: the runtime pulls Schema in on its own. **Nothing we can
do from this side.** It is a real upstream item with a precise shape — build
the Model codec lazily, behind the branch that uses it — and it is worth
raising with this measurement, but it is not ours.

### Zero-JS islands pay off far less than claimed, except when they pay off completely

The claim above was that the zero-JS path is "the single largest optimisation
available to any FoldKit site". That is true only of a page where **nothing**
hydrates. The framework is shared, so one hydrating island pays for all of it:

| configuration | JS at load | requests |
|---|---|---|
| four islands hydrate | **377 KB** | 17 |
| three charts static, grid hydrates | **351 KB** | 8 |

Dropping three of four directives saved 26 KB — **7%** — because the grid still
pulls the 316 KB framework. An island going static saves its own chunk and its
serialised props, nothing more, as long as anything else on the page hydrates.

### What actually works: pre-render everything, defer the one interactive island

The grid is genuinely interactive and cannot be static. But it is below the
fold, and `client:visible` became usable in 0.10.0 — before pre-rendering, an
empty mount measured 0×0 and never intersected, so the directive silently never
fired.

So: pre-render all four components, leave the three charts without a directive,
and give the grid `client:visible`.

| | at load | after scrolling to the table |
|---|---|---|
| JavaScript | **0 KB, 0 requests** | 351 KB, 8 requests |
| FCP | 68 ms | |
| Rendered | 200 points, 4 arcs, 4 bars, 25 grid rows, "1 to 25 of 7,729. Page 1 of 310" | |
| Grid searchable | — | yes |

**The whole report renders with no JavaScript at all.** The runtime arrives only
if the reader reaches the table, and only to make it interactive — the table is
already readable before it does.

### Keeping what the charts lost, for 2.4 KB

A static chart cannot run its hover readout. Each mark now carries an SVG
`<title>`, which is a native browser tooltip and costs no runtime: 212 of them
on the page, carrying the same text the readout showed — "1-5 (simple): 5,160
units", "unitN — Lines of Code: 420, McCabe Index: 31".

That is 12,710 gzipped against 10,348 without them. The donut still loses its
hover lift and legend highlight, which were decoration; the information is
preserved.

### Revised ranking

1. **Pre-render everything; give the one interactive island `client:visible`.** Done. 377 KB → 0 KB at load.
2. **Native `<title>` on marks** so static charts keep their information. Done.
3. **Lazy Model codec** — upstream FoldKit, 129 KB, with the proof above.
4. Per-island hydration — upstream; would let several interactive islands defer independently.
5. `server:defer`, props channel, data-loading recipe — as before, all minor against the above.

The earlier advice stands and is now sharper: do not optimise the HTML. It is
12,710 bytes, and the question that mattered was never its size but whether any
JavaScript had to run before the reader could read it.
