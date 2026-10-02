/**
 * Hand-off between the bug report bubble's "Your contact info" screen and
 * the full screen contact email route when the saved address is changed.
 * The bubble unmounts for the route and, on the way back, reopens on that
 * screen whether the edit was saved or dropped.
 */

let pendingEdit: { email: string } | null = null;
let returnPending = false;

export const contactEmailEdit = {
  /** The bubble is about to open the route to change `email`. */
  open(email: string) {
    pendingEdit = { email };
  },

  /** Read once by the route on mount; null when opened for a report. */
  take(): { email: string } | null {
    const edit = pendingEdit;
    pendingEdit = null;
    return edit;
  },

  /** The route is done; the bubble reopens on "Your contact info". */
  markReturn() {
    returnPending = true;
  },

  takeReturn(): boolean {
    const pending = returnPending;
    returnPending = false;
    return pending;
  }
};
