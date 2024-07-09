<img src="./docs/forgsync-logo2-512.png" alt="ForgSync logo" width="256"/>

# Decentralized data sync - forg

Forg (pronounced "forge") is a privacy-first multi-device data sync standard where users keep their data. No more feeding your data to sketchy servers.

In a mobile-first world where apps must store and sync data across user devices, forg ensures user data stays with (and belongs to) the user -- **as it should!**

Apps powered by forg will store user data in user-controlled data providers
(such as OneDrive, iCloud, DropBox, etc.) instead of proprietary servers
owned by the app developer.
Forg enables bidirectional data sync and a seamless offline-first experience that Just Works.
When an app utilizes forg as its data sync mechanism, the app is described as supporting ForgSync.


## What is forg?

Forg is a git-compatible(-ish) object-store database, inheriting many of the same concepts as git -- commits, trees, objects, branches.

A forg repo is a git repo, but with a few constraints
that enable persistance on cloud storage providers (such as OneDrive, iCloud, DropBox, etc.).
Forg achieves eventual data consistency despite uncoordinated concurrent read/write access from multiple devices, without locks.

Bidirectional sync across devices (with automatic conflict resolution) is made possible without proprietary server components,
making Forg the perfect and most cost-effective solution for app developers:
users fully own their data, and app developers need not own any server infrastructure.

**Forg, pronounced "forge"** stands for **Fo**rks as **R**emotes on **G**it (because of its inner workings). It is also a play on the words **fork** and **merge**. The official logo depicts a frog made of git commits.


## Why forg?

* For app developers: save on server costs and deliver seamless offline capabilities
* For app users: own your data, protect your privacy, and access your data across apps in perpetuity at your own terms


## How does it work?

See the [official specifications](./docs/specs.md) in this repo for the inner workings of forg.

See also the [Basic Operation](./docs/basic-operation.md) of a forg repo.


## Getting Started

_Coming soon..._


## Contributing

_Coming soon..._


## Acknowledgements

Forg takes inspiration from several other projects. This list is not comprehensive.

- [git](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain):
  a Forg repo is read-compatible with git (i.e. git tooling can read and use a Forg Repository, but the converse is not necessarily true)
