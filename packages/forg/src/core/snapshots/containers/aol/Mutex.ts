export class Mutex {
  private busy: boolean = false;

  async run(func: () => Promise<void>) {
    if (this.busy) {
      throw new Error('Mutex cannot be entered concurrently');
    }
    this.busy = true;
    try {
      await func();
    }
    finally {
      this.busy = false;
    }
  }
}
