# Privacy and DPDP design

How Rural Bridge handles personal data, and how those choices map to the
Digital Personal Data Protection Act, 2023.

> This is an engineering design document, not legal advice. Before any pilot
> involving real people, have it reviewed against the current text of the Act
> and its rules. Where the prototype does not yet implement something, this
> document says so rather than implying it does.

---

## The core decision

**The correlation engine operates on block-level aggregates and never needs a
patient identity.**

That is not a shortcut taken to save build time. It is the strongest privacy
position available for this problem, and it happens to also be the correct
engineering design. The rules count events per block per day. Knowing *who* had
a rash adds nothing to the calculation of whether rashes in that block rose
above baseline.

Everything below follows from that one fact.

## What leaves the device

A health record carries exactly this:

| Field | Example | Why it is needed |
|---|---|---|
| `op_id` | `f47ac10b-58cc-...` | Device-issued UUID, makes sync idempotent |
| `block_id` | `LGD4162` | The spatial half of the join key |
| `observed_on` | `2026-08-14` | The temporal half of the join key |
| `symptom_category` | `dermal` | One of four structured values |
| `severity` | `2` | 1 to 3 |
| `age_band` | `18 to 40` | Bucket, for identifying who is exposed at work |
| `reporter_id` | `ASHA-4162-1` | The worker, not the patient. Needed to route advisories back |

## What is never collected

Not "collected and protected". **Not collected.**

- No name
- No ABHA number or any health ID
- No phone number
- No address or GPS coordinate finer than the block
- No date of birth, only a five-way age bucket
- No free-text clinical description
- No photograph
- No voice recording

The last two are worth stating explicitly because both were plausible design
choices that were rejected:

**Voice.** Speech is recognised on-device by the browser, used only to
preselect one of four categories, and discarded. No audio is stored or
transmitted. The worker sees and confirms the selection before saving, so a
misrecognition is visible and correctable rather than silently written.

**Free text.** There is no free-text symptom field anywhere in the app. This
was originally a data-quality decision, because structured categories are what
make the cross-domain join possible at all. It has a privacy consequence: a
free-text box is where identifying detail leaks in, and there isn't one.

## Purpose limitation is enforced by the schema

There is no column for a name. A later change of purpose cannot quietly start
using one without a migration that a reviewer would see.

This matters more than a policy statement. Policies are enforced by whoever
remembers them; a schema is enforced by the database.

## Mapping to the Act

| DPDP principle | How this design meets it | Status |
|---|---|---|
| **Notice** before consent | Consent screen states purpose, recipient, expiry, and that identity is not attached | Screen implemented |
| **Consent**: specific, informed, unambiguous, by affirmative action | Explicit grant, single stated purpose, no pre-ticked state | Screen implemented |
| **Purpose limitation** | One purpose: cross-domain risk detection. Enforced by schema shape | Structural |
| **Data minimisation** | Only fields the rules consume. Age as a bucket, location as a block | Structural |
| **Storage limitation** | Consent carries an expiry, 90 days in the prototype | Field present, automated purge not implemented |
| **Right to withdraw**, as easy as giving | Withdraw button on the same screen as the grant | UI implemented, propagation not |
| **Right to erasure** | Erasure by `op_id` is a single-row delete; no denormalised copies exist | Query trivial, endpoint not built |
| **Right to correction** | Records are immutable; correction is a new record plus a superseding marker | Not implemented |
| **Grievance redressal** | Requires a named contact and a process | Not implemented |
| **Security safeguards** | See below | Partial |
| **Breach notification** | Requires an incident process, not only code | Not implemented |
| **Children's data** | Age band `0 to 5` and `6 to 17` exist. Verifiable parental consent is required by the Act and is not implemented | **Gap, see below** |

## Security

**In transit.** HTTPS everywhere. Vercel terminates TLS; the Neon connection
string requires `sslmode=require`.

**At rest, server.** Neon encrypts at rest at the storage layer.

**At rest, device.** This is the honest weak point. The op log lives in
IndexedDB, which is not encrypted by the application. On a modern Android
device, file-based encryption protects it while the device is locked, so the
practical exposure is an unlocked, unattended phone.

The original plan named SQLCipher. That does not apply directly to a browser
PWA. The realistic options for a pilot, in order of effort:

1. Rely on device encryption plus a screen-lock policy. Free, and adequate
   given that no identifiers are stored.
2. Encrypt payloads with a key derived from a worker PIN via WebCrypto before
   writing to IndexedDB. Roughly a day of work.
3. Ship as a wrapped Android app with SQLCipher. Weeks, and abandons the
   install-free PWA distribution that makes this deployable at all.

Given that the stored data contains no identifiers, option 1 is defensible for
a pilot and option 2 is the right next step. Do not claim SQLCipher is in use.

## Known gaps, stated plainly

1. **Children's data.** The Act requires verifiable parental consent for anyone
   under 18, and the app accepts `0 to 5` and `6 to 17` age bands today. Before
   a real pilot this needs either a parental consent flow or a decision to
   exclude minors from capture entirely.
2. **Consent withdrawal does not propagate.** The prototype records the
   withdrawal locally. It does not yet exclude the record from subsequent
   engine runs or delete the server copy.
3. **No automated retention purge.** `expires_at` is stored but nothing acts on
   it.
4. **No Consent Manager integration.** The Act envisages registered Consent
   Managers; this is a direct integration.
5. **`reporter_id` is personal data.** It identifies a named ASHA worker and is
   attached to every record. It is necessary for routing advisories, but the
   worker is a Data Principal too and needs her own notice and consent.
6. **Re-identification risk at small counts.** A block with two households and
   one dermal case in the `60 plus` band is not meaningfully anonymous. The
   engine already suppresses blocks with fewer than 8 baseline records, which
   helps, but suppression thresholds should be reviewed against the smallest
   real block.

## What to say to a judge

The claim that holds up:

> The correlation engine operates on block-level aggregates and has never
> needed a patient identity. Health records leave the device with an age band
> and a block, never a name and never an ABHA number. Purpose limitation is
> enforced by the schema rather than by policy, because there is no column for
> a name.

Then volunteer the gaps above. A team that names its own children's-consent gap
reads as one that has actually thought about the Act. A team that claims full
compliance for a one-day prototype does not.
