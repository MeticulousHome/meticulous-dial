/**
 * Whether the Dial's own quick report is running, from what the Dial itself
 * knows (never from the `origin` of a progress entry). While it runs, the
 * bubble shows its blocking flow and quick settings keep their usual label.
 *
 * Several parts can hold it at once: the bubble while it collects or sends,
 * the hand-over to the contact email screen (the bubble is closed then, the
 * machine keeps collecting) and a submission that outlives its bubble.
 */

type Listener = () => void;

const holders = new Set<string>();
const listeners = new Set<Listener>();

export const ownReport = {
  set(holder: string, active: boolean) {
    if (active === holders.has(holder)) return;
    const before = holders.size > 0;
    if (active) holders.add(holder);
    else holders.delete(holder);
    if (before === holders.size > 0) return;
    listeners.forEach((listener) => listener());
  },

  isRunning(): boolean {
    return holders.size > 0;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
