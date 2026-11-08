/** Ongedaan maken / opnieuw. `replace` werkt de huidige stap bij (bijv. tijdens slepen). */
export class History<T> {
  private states: T[];
  private at = 0;

  constructor(initial: T, private limit = 100) {
    this.states = [initial];
  }

  get current(): T { return this.states[this.at]; }
  get canUndo(): boolean { return this.at > 0; }
  get canRedo(): boolean { return this.at < this.states.length - 1; }

  push(s: T): void {
    this.states = this.states.slice(0, this.at + 1);
    this.states.push(s);
    if (this.states.length > this.limit + 1) this.states.shift();
    this.at = this.states.length - 1;
  }

  replace(s: T): void { this.states[this.at] = s; }

  undo(): T | null {
    if (!this.canUndo) return null;
    return this.states[--this.at];
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    return this.states[++this.at];
  }
}
