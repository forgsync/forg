# Forg repo basic operation

## Common operations

### 1. Creating a new Forg repo

Coming soon: a streamlined option will be provided. For now, follow the steps below:

1. In an empty folder, execute `git init --bare --initial-branch=main`.
   Several files and folder are created

1. Delete `hooks`, `info`, `objects/*`, `config`, `description`
   ```bash
   # Linux:
   rm -rf hooks/ info/ objects/* config description
   ```

   ```powershell
   # Windows PowerShell:
   Remove-Item -Force -Recurse @(".\hooks\", ".\info\", ".\objects\*", ".\config", ".\description")
   ```

1. Create file `.forg.json` with contents:
   ```json
   {
     "forgVersion": 1,
   }
   ```

When you are done, you should end up with this layout:

```
root
├─ objects/
├─ refs
│  ├─ heads/
│  └─ tags/
├─ .forg.json
└─ HEAD
```


### 2. Joining a Forg repo (new fork)

> NOTE: These steps are implemented for you in the Forg library. This explains how it works internally.

Pre-reqs:
* `fork_uuid`: each client needs a globally unique identifier for its membership in the Forg repo.
  The client is responsible for persisting their `fork_uuid` **outside** of Forg through other means.
  On browers, `localStorage` is an example of a good place to put this in
* Read/write access to the Forg repo raw files (local files or ona cloud storage provider like OneDrive, DropBox, Google Drive, etc.)

Steps:
1. Clone the repo (a shallow clone is enough)
1. Modify the latest Forg Snapshot, injecting a new file `/clients/<fork_uuid>.json`
1. Create a new commit for the updated Snapshot.
   Use the current `main` as the parent commit, and use the current `fork_uuid` as the author
1. Create new ref `clients/<fork_uuid>` pointing at the new commit. Also update the ref logs (journal) accordingly
1. Perform [reconciliations](#reconciliation) (see section below)
   - This is where the `main` ref is also updated
1. Push, i.e. save all files for the new objects that were created as a result of the steps above

NOTE: As with any other action performed on a Forg repo, joining a Forg repository is not guaranteed to "stick".
Concurrent accesses from other clients could result in recent changes being inadvertently overwritten, and that's fine.
The design of Forg ensures no data loss occurs as a result. See [Reconciliation](#reconciliation) below.


## 3. Modifying items in a collection

> TODO: Continue here...


## Reconciliation

### Background

Action is needed when branches diverge in order to reconcile changes into a coherent history.
This is no different from a traditional _git_ `merge`.

Things get interesting here, however, because of the relaxed assumptions that Forg places on the data layer.
When using a normal filesystem, file locks are at our disposal to ensure synchronization across processes and users.
_git_ relies on file locks to ensure someone else's change isn't accidentally overwritten
Forg, however, is designed specifically to avoid locks.

Instead, with Forg, every write to the data layer is considered an unconditional write-or-replace.
Regardless of whether a file changed underneath while Forg was performing some operation,
or whether another client is attempting to make changes concurrently, Forg makes no assumptions about
whether a write to a file will "stick". The only expectation is that files are written atomically --
i.e. writing a file either succeeds or fails as a unit, and it never completes partially. Files must never be half written.

The implication of the above is that, **whenever a Forg client does a `push`, it is effectively a `force push`.**
If the branch we are pushing had just been pushed by another client, we or they will inadvertently overwrite the other.

As a result, in order to prevent data loss and maintain eventual consistency, a reconciliation job is necessary.
Reconciliation is a critical part of Forg operation and not an afterthought.

Effective handling of reconciliation enables us to
1. Recover transparently from accidental conflicts when clients step on each other; and
2. Handle offline scenarios with ease, where multiple clients
   can make different and conflicting changes to the dataset.

Because clients can inadvertently overwrite changes from other clients,
and that the _victims_ would not know immediately or ever that their changes got overwritten,
a clear protocol is needed to maintain the promise of eventual consistency.
In some cases, clients are responsible for reconciling changes from other clients.


### Reconciliation process

1. Find the current `main` commit oid
1. Find the current commit oid's of every client that has joined, or attempted to join
   - This is simply a matter of reading all files under `refs/heads/clients/`
   - The current client is no different, and should be treated the same
1. For each client's head identified in the previous step, sequentially and in lexicographical order by client uuid:
   1. Determine whether the oid is contained in `main`
   1. If it is already in `main`, no further action is needed for this client's oid.
      Move on to the next client. If not, proceed below
   1. Without committing anything to Forg, apply each change from that client
      that isn't already in `main` and resolve conflicts for each change as it is applied
   1. Create a new Snapshot, comprising the old `main` snapshot and
      adding a new layer representing the changes identified in the previous step
   1. Commit the new Snapshot as a merge-commit, indicating both parent oid's as appropriate

NOTE: User action may be needed for conflict resolution but SHOULD be avoided.
Data models should be designed to minimize the likelihood of conflicts and to ensure that,
when conflicts do happen, they can be resolved with no user interaction as much as possible.

For example, imagine you are writing a Notes app with some notion of Folders.
* Initial state: two clients (`client1`, `client2`) are fully synced, there is one Notes folder called `Abc`, another called `Def`.
* Client 1 adds a note to folder `Abc` and deletes folder `Def`
* Client 2 adds a note to folder `Def`
* Both clients attempt to sync

The issue is that one client deleted a folder where another client made changes.
There are several ways to handle this.
* Option 1: Use a soft-delete scheme. Folder `Def` isn't really removed when Client 1 deletes it,
  rather it is just annotated as soft-deleted. Client 2's note in folder Def would still be reasonable in this case,
  it just would be in a now-deleted folder, which the user woul be able to find in the app
* Option 2: When notes are modified in a folder that was deleted, create a copy of the modified note
  and store in a separate `lost+found` folder.

Both options have pros and cons, and there's no silver bullet solution that avoids all problems.
This library gives you the tools you need to implement any suitable reconciliation strategy in a distributed and uncoordinated environment.

Forg clients MUST perform reconciliation **before every push**.
