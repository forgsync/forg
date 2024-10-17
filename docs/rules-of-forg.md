## The Rules of Forg

### Rule 1:

Refs under `refs/remotes/<forg_uuid>/**` are owned by a single client according to its `<forg_uuid>`.
That client is the only party allowed to WRITE to such refs.


### Rule 2:

Refs under `refs/remotes/<forg_uuid>/**` MUST NOT rewrite history, ever.
This enables the corresponding reconciled branches to always have an unambiguous merge direction.


### Rule 3:
