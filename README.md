# Forks as Remotes on Git (Forg)

Forg is a privacy-first multi-device data sync standard where users keep their data. No more feeding your data to sketchy or dubious company servers.

In a mobile-first world where apps must store and sync data across user devices, Forg ensures user data stays with (and belongs to) the user -- **as it should!**

Apps built with Forg store user data in user-owned data providers (such as OneDrive, iCloud, DropBox, etc.) instead of proprietary app-owned servers.
Forg enables bidirectional data sync and a seamless offline-first experience that Just Works.


## What is Forg?

Forg is a git-compatible(-ish) object-store database, inheriting many of the same concepts as git -- commits, trees, objects, branches, precisely like git.

A Forg repo is just a git repo, but with a few constraints
that enable persistance on cloud storage providers (such as OneDrive, iCloud, DropBox, etc.)
and ensure data consistency even during concurrent read/write access from multiple devices.

Bidirectional sync across devices (with automatic conflict resolution) is made possible without proprietary server components,
making Forg the perfect and most cost-effective solution for app developers:
users fully own their data, and app developers do not need to pay for expensive servers.

Forg stands for **Fo**rks as **R**emotes on **G**it (because of its inner workings) and is also a play on the word **fork**.


## Why Forg?

* For app developers: save on server costs and deliver seamless offline capabilities
* For app users: own your data, protect your privacy, and access your data across apps in perpetuity at your own terms


## How does it work?

See the [official specifications](./docs/specs.md) in this repo for the inner workings of Forg.

See also the [Basic Operation](./docs/basic-operation.md) of a Forg repo.


## Getting Started

_Coming soon..._


## Contributing

_Coming soon..._


## Acknowledgements

Forg takes inspiration from several other projects. This list is not comprehensive.

- [git](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain):
  a Forg repo is read-compatible with git (i.e. git tooling can read and use a Forg Repository, but the converse is not necessarily true)
- [OCI Images](https://github.com/opencontainers/image-spec/blob/main/layer.md):
  Within a Snapshot, changes made to collections are stored as layered changesets that take inspiration from how layers are defined in an OCI container Image
