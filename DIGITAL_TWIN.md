# DIGITAL_TWIN — v14

The living farm twin (built in v13, composed here) tracks the hierarchy — farm /
fields / zones / beds / rows / trees / plants — with last-known state + honest
staleness. v14 notes that equipment / livestock / water / buildings / sensors are
addable as new node types of the SAME honest model (state + staleness, no fabricated
future).

**7/30/90/180/365-day prediction** is declared `requires_validation`: multi-horizon
future state needs a trained model + outcome history. The only honest forward signal
today is calendar-based (e.g. harvest-in-~N-days) carried WITH a named basis. A
365-day yield/state forecast is not fabricated — it is named as model work.

The twin is the spine a real predictive model can later attach to; it does not
pretend to be that model.
