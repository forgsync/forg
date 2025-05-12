# Append-only container

Append-only logs are persisted in forg in an infinitely-nestable tree structure.

Such a container initially contains just one file named `00` at the root containing the initial record.

```
root
└── 00
```

For the first 256 files, they are simply added at the root in hexadecimal notation from `00` to `ff`:

```
root
├── 00
├── 01
├── ...
├── fe
└── ff
```

When the 257-th file is added, a new level in the hierarchy is created. The previous root moves into a new directory named `00`, and a new directory `01` is appended:

```
root
├── 00
│   ├── 00
│   ├── 00
│   ├── 01
│   ├── ...
│   ├── fe
│   └── ff
└── 01
    └── 00
```

The process continues until the first 256*256 = 65536 files are added:

```
root
├── 00
    ├── 00
    ├── ...
    └── ff
├── 01
│   └── ...
├── ...
├── fe
│   └── ...
└── ff
    ├── 00
    ├── ...
    └── ff
```

When the 65537-th file is added, again a new level is added in the hierarchy. The previous root moves into a new directory named `00`, and a new directory `01` is appended.
So and and so forth indefinitely.


### Properties of the append-only container format

- The currently-active tree where files are appended always has at most 256 entries; this sets a limit to how many bytes must be written each time a file is added.
- Adding new levels does not affect existing trees; the entire previous root is moved into a new folder, but it keeps its existing hash
- Depth grows logarithmically: `D = ceil(log(N) / log(256))`, that is, `O(log(N))`
- Depth-first traversal results in ordered traversal of the log
