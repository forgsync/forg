# Forg Repository specification

A Forg Repository is a git-like object store database with commits and associated data.

The present specification describes both the file layout of a Forg Repository,
as well as the branching strategy that enables uncoordinated sync between forks (i.e. "The Rules of Forg").

The file structure is deliberately similar to the internals of a git bare repo.
However, the format described here differs from git in a few important of ways:
  * Relaxed integrity requirements: refs are allowed to point to an incomplete object graph.
    We define mechanisms for dealing with this without incurring catastrophic data loss in spite of files being uploaded out of order or not at all
  * Mandatory branching strategy (i.e. "The Rules of Forg"): We (ab)use the concept of git remotes to represent any number of repository forks in a single filesystem
  * No support for most git features or optimizations (e.g. no remotes, no pack files, no directory indices)

This design enables Forg clients with minimal complexity (namely, no need for full-featured and compliant git clients)
and achieves truly distributed and uncoordinated workflows without a centralized remote server to manage and serialize writes.


## Repository file layout

```
root
├─ refs
│  ├─ heads
│  │  └─ main
│  └─ remotes
│     └─ forg
│        ├─ <fork_uuid>
│        │  └─ main
│        └─ ...
├─ logs
│  └─ refs
│     ├─ heads
│     │  └─ main
│     └─ remotes
│        └─ forg
│           ├─ <fork_uuid>
│           │  └─ main
│           └─ ...
├─ objects
│  └─ [0-9a-f][0-9a-f]
│     ├─ <hash>
│     └─ ...
├─ .forg.json
└─ HEAD
```


#### File `/.forg.json`

Indicates that this is a Forg repo.

```json
{
  "forgVersion": 1,
}
```


#### File `/refs/heads/*`

Branch heads, these are just text files whose content indicate commit oid's.


#### File `/refs/remotes/forg/*`

Forg forks are persisted as git remotes whose names MUST follow the pattern `forg/<fork_uuid>`. Branches of a fork are stored as simple text files whose content indicate commit oid's.


#### File `/logs/refs/**/*`

Journaling logs of changes made to refs, helps ensure data integrity and recovery after/during incomplete/out-of-order updates.


#### File `/objects/*`

Content-addressable objects named after their oid's.


#### File `/HEAD`

Indicates the default branch. Always contains the content `ref: refs/heads/main\n`.


## The Rules of Forg

### Rule 1:

No rewriting of history by any client.


### Rule 2:

### Rule 3:
