# Git Sync

Low-level primitives used to sync refs between a local Forg repo and a remote,
which aims at eventual consistency and guaranteed no data loss under the relaxed filesystem guarantees that Forg operates under.

While the of these in the general case could cause irreparable data loss due to potentially inadvertently rewriting history, they are safe when used under the [Rules of Forg](/docs/rules-of-forg.md).
These are not designed nor intended to replace git's familiar `fetch` and `push` implementations, as they have different goals and behaviors.

* `forceFetchRef`: Syncs a local ref **from** the remote. This could result in rewriting of local history. It should only be used when there is no valuable and irreplaceable data pointed to by the local ref
* `forcePushRef`: Syncs a local ref **to** the remote. This could result in rewriting of remote history. It should only be used when there is no valuable and irreplaceable data pointed to by the remote ref

In Forg, these methods are used as follows:

* Each Forg client uses `forceFetchRef` to fetch changes from other Forg clients (under `refs/remotes/<otherClientUuid>/<branchName>`)
  - This is safe to do because the local Forg client will never mutate those refs, they are only consumed from the remote.

* Each Forg client uses `forcePushRef` to push its own changes to the remote (under `refs/remotes/<thisClientUuid>/<branchName>`)
  - This is safe to do because no other Forg client is allowed to mutate those refs, they are owned by the current client.

* Each Forg client uses `forceFetchRef` and `forcePushRef` to manage the reconciled refs in the remote (under `refs/heads/<branchName>`)
  - This is safe to do because the reconciled branches can always be rewritten and then re-merged across clients. No data would be lost, and all clients would eventually agree on a consistent history.
  - TODO: Reconciliation is still TODO... `forceFetchRef` behavior of losing local changes COULD pose a challenge there, but this requires more thought.
