// See: https://en.wikipedia.org/wiki/Errno.h
// We only include relevant values here
export enum Errno {
  Success,
  EPERM,
  ENOENT,
  EIO,
  EACCES,
  EBUSY,
  EEXIST,
  ENOTDIR,
  EISDIR,
  EINVAL,
  EROFS,
  ENOTEMPTY,
  ENOTSUP,
}

export class FSError extends Error {
  errno: Errno;
  path?: string;

  constructor(errno: Errno, path: string | undefined, message?: string) {
    const errnoString = Errno[errno];
    super(message ?? `${errnoString}${path ? ` (path: '${path}')` : ''}`);
    this.errno = errno;
    this.path = path;
  }
}
