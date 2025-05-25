export class Mutex {
  private busy: boolean = false;

  async run<T>(func: () => Promise<T>) {
    if (this.busy) {
      throw new Error('Mutex cannot be entered concurrently');
    }
    this.busy = true;
    try {
      return await func();
    }
    finally {
      this.busy = false;
    }
  }
}
