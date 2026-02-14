export class MockTransport {
  private messages: string[] = [];
  private resolvers: Array<(v: string) => void> = [];

  send(message: string): void {
    if (this.resolvers.length > 0) {
      const r = this.resolvers.shift()!;
      r(message);
    } else {
      this.messages.push(message);
    }
  }

  receive(): Promise<string> {
    return new Promise((resolve) => {
      if (this.messages.length > 0) {
        resolve(this.messages.shift()!);
      } else {
        this.resolvers.push(resolve);
      }
    });
  }
}
