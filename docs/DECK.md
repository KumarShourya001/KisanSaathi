# Round 1 deck outline

For the four people writing the deck. Everything here is drawn from what was
actually built and measured, so nothing on a slide should be a claim the
prototype cannot back.

Twelve slides. If the format allows fewer, cut 9 and 11 first.

---

## 1. The gap, not the product

One slide, almost no words.

> A farmer in Yavatmal sprays organophosphate on Tuesday.
> On Friday, six people in that village report rashes and breathing trouble.
>
> The health system sees six rashes with no cause.
> The agriculture system sees a spray record with no consequence.
> **Neither system can see the other.**

Ground it: the 2017 Yavatmal poisoning cluster among cotton farmers. **Have
someone pull a citable source for the casualty figures before this goes on a
slide.** Do not put a number up that you cannot source.

## 2. What we built

> Rural Bridge joins the two feeds on a shared village-and-date key and raises
> an explainable flag with a recommended action.

Screenshot: the Ner flag detail screen. This is the hero image of the whole
deck. Use it big.

## 3. The insight that is ours

The composite rule.

> Heat drives sweating and a higher respiratory rate. Both increase dermal and
> inhalation uptake of the same compound. A block under both a spray spike and
> a heatwave is at compounded risk.
>
> A health system cannot raise this. An agriculture system cannot raise this.
> Only something sitting between them can.

This is the slide judges will remember. Do not bury it at slide 9.

## 4. How it works

Use the pipeline diagram from `docs/blueprint.html`, or redraw it.

Capture offline → append-only op log → idempotent sync → join on
`(block_id, date)` → three rules → ranked advisory.

Keep it to six boxes. The detail is in `docs/ARCHITECTURE.md` if asked.

## 5. Wireframes

Four screens, phone-shaped, in this order: field home, health capture, sync
drain, flag detail. The eight rendered screens in `docs/blueprint.html` are the
source; screenshot them from the running app so they match what you demo.

Caption each with one line of *why*, not *what*:

- Health capture: "Four categories, never a free-text field. Structured input is
  what makes the join possible."
- Severity: "Described by what the person can still do, not a number a worker
  has to calibrate."
- Sync: "The device-issued ID is on screen, because that ID is the idempotency
  argument."

## 6. Why rules and not a model

> There is no labelled dataset for this join. A model would be trained on data
> we generated, which makes its accuracy a statement about our generator.
>
> Rules are explainable to a district officer with the numbers attached,
> auditable by anyone who reads the file, and run in 2 ms.
> The upgrade path is a pilot that produces ground truth.

Put the actual thresholds on the slide. Specificity reads as competence.

## 7. Privacy by construction

Pull from `docs/PRIVACY.md`.

> The correlation engine operates on block-level aggregates and has never
> needed a patient identity. Records leave the device with an age band and a
> block. Never a name, never an ABHA number.
>
> Purpose limitation is enforced by the schema, not by policy: there is no
> column for a name.

Then a short DPDP mapping table, and **name two gaps you have not closed**
(children's consent, withdrawal propagation). A team that names its own gaps
reads as one that has read the Act.

## 8. It actually runs

The numbers, all measured:

| | |
|---|---|
| JavaScript, gzipped | 127 KB |
| Capture to durable, offline | 21 ms median |
| Correlation engine, 10 blocks | 2.0 ms |
| Full correlations endpoint, warm | 38 ms |
| Sync idempotency | 3 identical posts, 1 row, 3 audit entries |
| Engine discrimination | flags 4 rigged blocks, silent on the near-miss and 6 quiet blocks |

Add the Lighthouse score once you have run it against the live URL. Put whatever
number comes back, not a target.

## 9. Real versus simulated

The honesty table from the README, unedited.

Volunteering this is worth more than any individual integration. Put it in the
deck rather than waiting to be asked.

## 10. Business model

> Full version in [BUSINESS.md](BUSINESS.md), including measured unit
> economics, the beachhead market, competition and risks. This slide is the
> compressed version. At an entrepreneurship hackathon, give this section two
> slides rather than one.

**Who does not pay:** farmers and patients. Any model that charges them fails
on adoption and on ethics.

**The realistic buyer is public.** District and state health administration,
under National Health Mission budgets that already fund ASHA digital tooling,
and state agriculture departments running extension services. The unit is a
per-block, per-year licence bundled with training, because deployment cost in
this context is training, not servers.

**Cost structure is unusually favourable.** The whole prototype runs on free
tiers. At district scale the marginal cost is a small Postgres instance and a
serverless bill measured in single-digit dollars per month. The platform is
cheap precisely because the engine is rules rather than inference.

**Grant and CSR funding** is the realistic bridge to procurement: agricultural
safety and rural health both have active funding lines.

**One line you should draw explicitly:** insurers would pay for this risk data.
Selling health-derived signals to insurers is a straight line to farmers being
priced out of cover based on where they live. Say on the slide that you have
ruled it out. Judges notice a team that names a revenue stream and rejects it.

## 11. What a pilot needs

- Verified LGD block codes, replacing the demo codes
- AgriStack third-party API access, or a state-level data-sharing agreement
- ABDM sandbox onboarding for the FHIR path
- Ground truth from one district for one season, to validate the thresholds
- Legal review of the consent artifact against the current DPDP rules

Ending on what you do not have yet is a strength, not a weakness, provided the
list is specific.

## 12. Try it

Large QR code to the live URL. Repo link underneath.

> "Open it on your phone. Turn on airplane mode. It still works."

---

## Rules for the whole deck

- **Every number on a slide must be one you measured.** If you did not run it,
  it does not go up.
- **Say "TypeScript serverless functions", not FastAPI**, if the architecture
  slide shows FastAPI as the production target. Show both and label which is
  deployed.
- **Say "Web Speech API", not Sarvam.** Sarvam is the intended production
  recogniser and sits behind a one-file adapter. Citing Bhashini as domain
  awareness is fine; claiming either is running is not.
- **No stock photos of farmers.** Use the actual product screenshots.
- **The 2017 Yavatmal reference needs a source** before it appears anywhere.
