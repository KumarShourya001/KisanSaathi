# Business case

> **Read this first.** Every figure below is either measured from the built
> system, or an assumption stated as an assumption. Nothing is a market number
> presented as fact. Where a figure needs a citation before it goes on a slide,
> it says so. Judges at an entrepreneurship hackathon puncture fabricated TAMs
> in one question; they cannot puncture arithmetic they can inspect.

---

## 1. The problem, in business terms

Two public digital infrastructures exist and are being built out: ABDM on the
health side, AgriStack on the agriculture side. Both are large public
investments. Neither can answer a question that requires the other's data.

The specific commercial consequence: acute pesticide exposure clusters are
detected late, treated as unexplained illness, and produce avoidable
hospitalisation, avoidable lost labour days, and avoidable deaths. Detection
today is retrospective and often journalistic rather than systemic.

**We are not building a health product or an agriculture product. We are
building the join.** That positioning matters commercially: it means we are not
competing with either incumbent stack, we are making both more valuable.

## 2. Who pays, and who does not

**Farmers and patients do not pay.** Any model that charges them fails on
adoption, and in a health context it fails on ethics. Rule this out explicitly
and say so out loud.

**The buyer is public administration.** Specifically:

| Buyer | Budget line | Why they buy |
|---|---|---|
| District / state health administration | National Health Mission, which already funds ASHA digital tooling | Earlier detection reduces hospitalisation cost and reportable deaths |
| State agriculture department | Extension services budget | Safer application practice is already an extension mandate |
| District administration | Disaster and public health preparedness | Heat advisories have an existing owner |

**Grant and CSR funding is the bridge to procurement.** Agricultural safety and
rural health both have active funding lines, and a public-sector sales cycle is
long enough that grant funding is what pays for the pilot that makes the
procurement case.

## 3. Revenue model

**Per-block annual licence, bundled with training.**

The unit is the block rather than the user, because the block is the unit the
correlation engine actually operates on and the unit administration budgets
against. Bundling training is not padding: in this context deployment cost *is*
training, not servers.

Three tiers, as a starting position to be tested against a real procurement
officer:

| Tier | Includes | Positioning |
|---|---|---|
| Pilot | One district, 12 months, training, support | Priced at or near cost. The goal is the evidence, not the margin |
| District | All blocks, dashboards, advisory routing, quarterly review | The core commercial unit |
| State | Multi-district, ABDM and AgriStack integration, SLA | Where the economics get good |

**Deliberately excluded revenue stream.** Insurers would pay for this risk data.
Selling health-derived signals to insurers leads directly to farmers being
priced out of cover based on where they live and what they spray. We have ruled
it out. Put that on the slide: naming a revenue stream and rejecting it is a
stronger signal than not thinking of it.

## 4. Unit economics

This is the part that is measured rather than assumed, and it is unusually
favourable.

**Measured from the built system:**

| Item | Measured |
|---|---|
| Client payload, gzipped | 129 KB |
| Correlation engine, 10 blocks | 2.0 ms |
| Full correlations request, warm | 38 ms |
| Database rows for one district, 60 days | ~700 |

**Infrastructure cost, derived from those measurements and public list prices
(verify current pricing before quoting):**

- Hosting and serverless functions: free tier covers a pilot district. The
  first paid tier is roughly USD 20 per month and covers far more than one
  district.
- Postgres: free tier covers a pilot. First paid tier roughly USD 19 per month.
- Weather: one call per block per day. A district of ~12 blocks is ~360 calls
  per month, inside the free tier. A whole state of a few thousand blocks needs
  a paid tier in the low tens of dollars per month.

**The conclusion that matters:** software and infrastructure cost for a pilot
district is effectively zero, and for a whole state is tens of dollars per
month. This is a direct consequence of two engineering decisions:

1. The engine is **rules, not inference**. There is no GPU bill, no per-token
   cost, and no retraining cost. A model-based product would have all three.
2. The client is **offline-first and 129 KB**. There is no per-user streaming
   cost and no requirement for connectivity we would have to subsidise.

**Therefore the cost structure is dominated by people, not compute:** training
ASHA and agri workers, field support, and integration work with state systems.
That is a services-shaped cost base, which caps gross margin lower than pure
SaaS but makes the product defensible and the pricing explainable to a
government buyer who is used to buying training.

## 5. Market sizing

**Do not put a TAM on a slide without sourcing it.** Build the number in front
of the judges instead, from figures you can cite:

```
addressable blocks
  x  annual licence per block
  =  serviceable market
```

Figures you will need, each with a citation before use:

| Input | Where to source it |
|---|---|
| Number of blocks / tehsils in India | Local Government Directory (lgdirectory.gov.in) |
| Number of ASHA workers | National Health Mission published figures |
| Districts with significant cotton or high-pesticide cropping | Agriculture Census / state crop data |
| Recorded pesticide poisoning incidence | National Crime Records Bureau and state health data, both with known under-reporting |

**Beachhead, not TAM.** The honest opening position is not "all of India". It is
**cotton-growing districts of Vidarbha**, where the problem is documented, the
crop concentration is high, and the 2017 Yavatmal cluster gives you a named
reference case. Win one district, produce evidence, expand along the crop belt.
A judge will trust a defined beachhead more than a large TAM.

## 6. Why this wins where others have not

| Alternative | Why it has not solved this |
|---|---|
| ABDM alone | Has the symptoms, cannot see the applications |
| AgriStack alone | Has the applications, cannot see the symptoms |
| Manual district reporting | Retrospective, weeks late, no baseline to compare against |
| A general analytics or BI tool | Requires both datasets to already be joined, which is the actual hard part |
| An ML-based health surveillance product | Needs labelled data that does not exist for this join, and cannot explain a flag to a district officer |

**The moat is not the algorithm.** The rules are a few hundred lines and anyone
could reimplement them. The moat is:

1. **The join key discipline.** Getting structured, block-keyed data captured by
   two different workforces who do not currently share a system.
2. **The field workflow.** Offline capture that a low-literacy worker will
   actually use every day. This is the part that fails in practice.
3. **Integration position.** Once you sit between the two stacks in one state,
   you are the default for the next.

## 7. What is in the MVP, and what is not

**In the MVP, built and verified:**

- Offline capture on a cheap Android phone, 21 ms to durable, survives force-kill
- Idempotent sync with a device-issued ID, verified against duplicate submission
- Rule-based correlation across both feeds with explainable output
- Composite heat-plus-exposure rule
- Ranked officer console with recommended action per flag
- Three languages, voice input and read-aloud output
- Live weather integration
- DPDP-shaped consent artifact

**Deliberately out of the MVP:**

| Cut | Why |
|---|---|
| Image-based diagnosis | No labelled dataset, fragile, and invites clinical validation questions no prototype can answer |
| Drug supply chain tracking | Different product, different buyer |
| Insurance and smart contracts | Ruled out on ethics, see section 3 |
| Native Android app | The PWA installs, works offline, and costs nothing to distribute |
| ML anomaly detection | See section 6. The upgrade path exists once a pilot produces ground truth |

**Next after the MVP, in order:**

1. Verified LGD block codes replacing demo codes
2. Consent withdrawal propagation and automated retention purge
3. AgriStack third-party access or a state data-sharing agreement
4. ABDM sandbox integration for the FHIR path
5. Advisory dispatch that actually reaches a worker, via SMS or IVR, because
   the officer console assumes a smartphone the last mile may not have
6. One district, one season, ground truth, threshold validation

## 8. Go to market

**Phase 1, evidence.** One district in Vidarbha. Grant or CSR funded. Deliver
the pilot at cost. The output that matters is not revenue, it is a defensible
claim about detection lead time versus the status quo.

**Phase 2, reference sale.** Convert the pilot district into a paid district
contract, using the pilot's own health administration as the reference.

**Phase 3, state.** State-level licence with ABDM and AgriStack integration.

**Distribution advantage worth naming:** it is a PWA. Rollout to a new block is
a URL and a training session, not an app store, not a device procurement, not
an IT deployment. That is a real reduction in the cost of the thing that
usually kills rural software rollouts.

## 9. Risks, stated honestly

| Risk | Severity | Mitigation |
|---|---|---|
| AgriStack third-party access never opens | High | State-level data-sharing agreement, or direct capture by agri extension workers, which the MVP already supports |
| Thresholds do not generalise beyond the pilot district | High | They are per-block and baseline-relative by design, but this needs a real season of data to confirm. Do not claim otherwise |
| ASHA workers do not adopt daily capture | High | The whole UX bet: offline, voice, four taps, read-aloud. Measure adoption in the pilot, not in the demo |
| Public procurement cycles are long | Medium | Grant funding bridges it. Plan for 12 to 18 months, not 3 |
| False positives erode officer trust | Medium | Suppression below 8 baseline records, quiet blocks shown explicitly, every flag carries its arithmetic |
| A state builds it internally | Medium | Likely, and not necessarily bad. Position for integration and licensing rather than for exclusivity |

## 10. The ask

For a hackathon, be specific about what you want next rather than naming a
funding figure you have not modelled:

> One district partnership and one season of data. We have a working, deployed
> system and no ground truth. Everything we cannot yet claim is downstream of
> that one thing.

That is a more credible ask than a valuation, and it is true.
