# Git DB

A git-compatible(-ish) database that supports the following capabilities of git:
- objects (blobs, trees, commits, tags), including zlib compression
- refs (remotes and heads)
- reflogs

Importantly, the following are NOT supported by design:
- PACK files: they are not suitable under the relaxed filesystem constraints that Forg operates under
- Indexes: unnecessary as Forg repo's are bare repo's and don't persist the working tree on the filesystem

## Legal

This low-level git database implementation takes inspiration from and leverages
parts of the open-source project es-git, available at https://github.com/es-git/es-git/tree/5939f07143e0b8aa67d7464e6ec47754bebab347.
Large portions of the code have been entirely rewritten for Forg.

A copy of the original license is preserved below.

```
The MIT License (MIT)

Copyright (c) 2013-2014 Tim Caswell <tim@creationix.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
