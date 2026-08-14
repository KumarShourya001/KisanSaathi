# Demo script

Four minutes. Rehearse it twice, out loud, on the phone you will actually hold.

---

## Before you start

**Reset the data.** Benchmark runs and rehearsals write real records that change
the headline numbers. Do this last, immediately before presenting.

Live:
```bash
curl -X POST "https://YOUR-APP.vercel.app/api/seed?as_of=$(date +%F)" -H "x-seed-token: YOUR_SEED_TOKEN"
```

Local:
```bash
curl -X POST "http://127.0.0.1:5174/api/seed"
```

**Then check it took.** Ner should read 9 applications and 7 reports.

```bash
curl -s "https://YOUR-APP.vercel.app/api/correlations" | head -30
```

**Warm the database.** Neon suspends after five minutes idle and wakes in under
a second, but hit the URL once before you walk up anyway.

**On the phone.** Install the PWA (Chrome menu, Add to home screen). Clear the
outbox from the Outbox screen if a previous run left records in it. Set the role
to Block officer and open the Ner flag, so the app is already on the right screen.

---

## The script

### 0:00 — Open on the finding, not the login

You are already on the Ner flag detail. Read the numbers off the screen.

> "Nine Class II pesticide applications in seven days, against a baseline of
> under one per week. Seven nerve, skin and breathing reports in the six days
> that followed, against a baseline of one. Heat index above 46 degrees
> throughout."

Then the point:

> "This platform found that because it is the only system that can see both
> numbers. The health system has the symptoms and not the spraying. The
> agriculture system has the spraying and not the symptoms."

**Do not start with a login screen or a title slide.** Open on the payoff.

### 0:45 — Go backwards to where the data comes from

Settings, switch role to ASHA worker, Ner block.

> "This is the same app, held by a village health worker."

**Turn on airplane mode in front of them.** Do not describe it. Show the toggle.

### 1:15 — Capture with no signal

Log a health visit. Tap the mic and say "rash", or just tap Skin, then Next,
then Severe, then Save to device.

Point at the offline pill and the queue count.

> "Fifteen seconds, no signal, saved in about twenty milliseconds."

**Then force-kill the app** from the task switcher and reopen it.

> "Still there."

This is the moment that separates you from every slideware entry. Do not rush
it, and do not explain it while doing it. Let them watch.

### 2:00 — Reconnect

Airplane mode off. The queue drains on screen and the toast appears.

> "The record carries an ID the phone generated. If the connection drops
> mid-send and it goes twice, the server matches that ID and keeps one row."

If a retry happened, the Outbox screen says so explicitly.

### 2:30 — The join closes

Switch back to Block officer.

> "The record I just captured has moved this block's numbers. Same device,
> thirty seconds, both ends of the pipeline."

### 3:00 — Close on numbers and on what is not real

> "127 kilobytes of JavaScript. Twenty-one milliseconds to save a record
> offline. Two milliseconds to run the correlation engine across ten blocks."

Then, before anyone asks:

> "The health and agriculture records are synthetic. AgriStack third-party API
> access is not publicly available, so that feed is a schema-correct adapter and
> we have documented the interface. The weather is real. The offline capture,
> the sync and the engine are real, and you can test them yourself right now."

**Show the QR code.** Invite them to open it on their own phone.

---

## The three questions you will get

**"Why not machine learning?"**

> No labelled dataset exists for this join, so a model would be trained on data
> we generated, which makes its accuracy a statement about our generator rather
> than about the world. Rules are explainable to a district health officer with
> the numbers attached, and auditable by anyone who reads the file. The upgrade
> path is a pilot that produces ground truth.

**"What happens when two devices conflict?"**

> They do not. Each observation is written once by one worker and is never
> edited, so there is no concurrent mutation to reconcile. Last-write-wins on
> the device-issued ID is correct here rather than merely convenient. A CRDT
> would add convergence machinery for a conflict that cannot occur.

**"Is this real AgriStack data?"**

> No. It is a mock adapter with the correct schema shape, because third-party
> AgriStack API access is not open to us. Here is the adapter interface.

Answer that last one plainly and immediately. Getting caught overstating an
integration is fatal; disclosing it costs nothing.

---

## If something breaks mid-demo

| Symptom | Do this |
|---|---|
| Dashboard shows an error | Field capture still works offline. Switch to the ASHA role and demo capture. Say the console needs network and the field app does not, which is the point. |
| Flags look wrong | You forgot to re-seed. Do not fix it live. Move to the offline capture story, which does not depend on the seed. |
| Queue will not drain | Check the phone actually has signal. The Outbox has a manual Send now button. |
| PWA will not install | Demo in the browser. Installation is not the claim; offline capture is. |
| Everything is broken | Open `/api/correlations` in a browser tab and talk through the JSON. The engine output is the substance. |

Have the deployed URL open in a second tab on a laptop as a fallback before you
start.
