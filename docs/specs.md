# Forg Repository specification

A Forg Repository is a git-like object store database with commits and associated data.

The present specification describes the file layout of a Forg Repository.
Effective use of this file layout to achieve the goals of Forg relies on all clients abiding by [The Rules of Forg](./rules-of-forg.md),
which also describes the branching strategy that enables uncoordinated sync between clients.

The file structure is deliberately similar to the internals of a git bare repo.
However, the format described here differs from git in a few important of ways:
  * Relaxed integrity requirements: refs are allowed to point to an incomplete object graph.
    We define mechanisms for dealing with this without incurring catastrophic data loss in spite of files being uploaded out of order or not at all
  * Mandatory branching strategy (i.e. "The Rules of Forg"): We (ab)use the concept of git remotes to represent any number of repository forks in a single filesystem
  * Deliberate lack of support for most git features or optimizations (e.g. no remotes, no pack files, no directory indices -- these are not achievable
    under the relaxed guarantees of the filesystem api that Forg is built to run on, for example, lack of locking and synchronization primitives across clients)

This design enables Forg clients with minimal complexity (namely, no need for full-featured and compliant git clients)
and achieves truly distributed and uncoordinated workflows without a centralized remote server to manage and serialize writes.


## Repository file layout

```
root
├─ refs
│  ├─ heads
│  │  ├─ main
│  │  └─ ...
│  └─ remotes
│     ├─ <forg_uuid>
│     │  ├─ main
│     │  └─ ...
│     └─ ...
├─ logs
│  └─ refs
│     ├─ heads
│     │  ├─ main
│     │  └─ ...
│     └─ remotes
│        ├─ <forg_uuid>
│        │  ├─ main
│        │  └─ ...
│        └─ ...
├─ objects
│  └─ [0-9a-f][0-9a-f]
│     ├─ <hash>
│     └─ ...
├─ HEAD
└─ config
```


#### File `/refs/heads/*`

Reconciled branch heads, these are just text files whose content indicate commit oid's.


#### File `/refs/remotes/<forg_uuid>/*`

Forg forks are persisted as git remotes whose names MUST follow the pattern `<forg_uuid>/<branch_name>`. These are just text files whose content indicate commit oid's.


#### File `/logs/refs/**/*`

Journaling logs of changes made to refs, helps ensure data integrity and recovery after/during incomplete/out-of-order updates.


#### File `/objects/*`

Content-addressable objects named after their oid's.


#### File `/HEAD`

Indicates the default branch. Always contains the content `ref: refs/heads/main\n`.


#### File `/config`

Git config. The contents must specify the following section:

```
[forg]
    version = 1
```
