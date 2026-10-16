import type { CollectionOutcome, CollectionRun } from './reportCollection';

/**
 * Which bubble acts on a collection run, and the hand-off that carries the
 * run and the user's answer across the contact email screen.
 *
 * A bubble holds the run it shows in a ref, and only the bubble holding a run
 * acts on its outcome or cancels it. Asking for a contact email closes the
 * bubble while the machine is still collecting; it lets go of the run as it
 * hands it over, and the bubble that comes back takes it.
 *
 * The closing bubble stays mounted for its exit animation (450 ms). If it
 * held on to the run, a POST /reports/create answering in that window would
 * be submitted twice: by the closing bubble, without the email, and by the
 * bubble that comes back.
 */

export type RunHold = { current: CollectionRun | null };

/**
 * The bubble holds `run` and acts on its outcome, unless it let go of the run
 * by then: handed over, cancelled or unmounted.
 */
export const holdRun = (
  hold: RunHold,
  run: CollectionRun,
  act: (outcome: CollectionOutcome) => void
) => {
  hold.current = run;
  void run.outcome.then((outcome) => {
    if (hold.current !== run) return;
    hold.current = null;
    act(outcome);
  });
};

let handedOverRun: CollectionRun | null = null;
let contactDecision: { email: string | null } | null = null;

export const reportHandoff = {
  /** The bubble is about to close for the contact email screen. */
  detach(hold: RunHold) {
    handedOverRun = hold.current;
    hold.current = null;
  },

  /** The bubble is back; the run is its own again. */
  takeRun(): CollectionRun | null {
    const run = handedOverRun;
    handedOverRun = null;
    return run;
  },

  /** What the contact email screen ended with: an address, or none. */
  setContactDecision(email: string | null) {
    contactDecision = { email };
  },

  takeContactDecision(): { email: string | null } | null {
    const decision = contactDecision;
    contactDecision = null;
    return decision;
  }
};
