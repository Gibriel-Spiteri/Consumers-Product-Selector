---
name: Publishing crash diagnosis
description: Evidence limits when publishing logs contain only an unhandled-event header
---

Do not infer a database failure from Node's generic “Unhandled 'error' event”
header alone. Failed-revision telemetry can omit the exception payload even when
the response says it is complete.

**Why:** A publishing failure provided the Node header and process exit but no
originating exception; the missing pool listener was plausible, not proven.

**How to apply:** Check the failed revision rather than the older serving release.
If the payload is unavailable, add structured fatal-error observation without
suppressing Node's fatal exit. Describe this as diagnostic preparation, not a
confirmed fix, and inspect the next publishing attempt before changing behavior.
