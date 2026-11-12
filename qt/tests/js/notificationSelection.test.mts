// Which response a notification shows selected, and what a press acknowledges, while notifications are
// stacked on the notification screen (qt/qml/Dial/screens/notifications/NotificationLogic.js).
//
// Regression a user at the machine would see without it: they turn to the second answer of one prompt
// ("No", "Reject") and press, and at that moment another notification takes the screen. The new one opens
// with its second answer selected and the press answers it: an access request from a phone or browser on
// the network opens on "Allow" and is allowed without the user meaning to.
// Expected values come from the device authorization contract (an access request's responses are
// ["Deny", "Allow"], so its first response is the safe one), from Notifications.addOne (an update of a
// shown notification keeps its id) and from NotificationLogic.PRESS_GUARD_MS.
// The suite missed it: the e2e tests only ever showed one notification at a time, and the selection was
// carried over from one notification to the next.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRESS_GUARD_MS, pressAcknowledgement, selectionAfter, takesScreen,
} from '../../qml/Dial/screens/notifications/NotificationLogic.js';

const accessRequest = {
  id: 'auth-request-1',
  message: '"Phone" is asking to use this machine',
  responses: ['Deny', 'Allow'],
};

test('a different notification taking the screen starts on its first response', () => {
  // The user had turned to the second answer of the Wi-Fi question when the access request arrived.
  assert.equal(selectionAfter('wifi-1', accessRequest.id, 1, accessRequest.responses.length), 0);
  // The shown one was answered and an older one under it comes back.
  assert.equal(selectionAfter(accessRequest.id, 'wifi-1', 1, 2), 0);
  // The screen opening on its first notification.
  assert.equal(selectionAfter('', 'wifi-1', 2, 3), 0);
  assert.equal(takesScreen('wifi-1', accessRequest.id), true);
  assert.equal(takesScreen('', 'wifi-1'), true);
});

test('an update of the shown notification keeps its selection', () => {
  assert.equal(takesScreen('wifi-1', 'wifi-1'), false);
  assert.equal(selectionAfter('wifi-1', 'wifi-1', 1, 2), 1);
  assert.equal(selectionAfter('wifi-1', 'wifi-1', 2, 3), 2);
  // Ids that arrive as numbers are the same notification as their string.
  assert.equal(takesScreen('7', 7), false);
  assert.equal(selectionAfter('7', 7, 1, 2), 1);
});

test('an update with fewer responses keeps the selection within them', () => {
  assert.equal(selectionAfter('wifi-1', 'wifi-1', 2, 2), 1);
  assert.equal(selectionAfter('wifi-1', 'wifi-1', 1, 1), 0);
  assert.equal(selectionAfter('wifi-1', 'wifi-1', 1, 0), 0);
  assert.equal(selectionAfter('wifi-1', 'wifi-1', -1, 2), 0);
});

test('a press while presses are ignored acknowledges nothing', () => {
  assert.equal(pressAcknowledgement(accessRequest, 1, false), null);
  assert.equal(pressAcknowledgement(accessRequest, 0, false), null);
  assert.equal(pressAcknowledgement(null, 0, true), null);
});

test('a press once armed acknowledges the selected response of the shown notification', () => {
  assert.deepEqual(pressAcknowledgement(accessRequest, 0, true), { id: 'auth-request-1', response: 'Deny' });
  assert.deepEqual(pressAcknowledgement(accessRequest, 1, true), { id: 'auth-request-1', response: 'Allow' });
  // No responses: acknowledged without one, as before.
  const ack = pressAcknowledgement({ id: 'n-1', message: 'Descaling finished.' }, 0, true);
  assert.equal(ack.id, 'n-1');
  assert.equal(ack.response, undefined);
});

test('presses are ignored long enough for a push already on its way, and not much longer', () => {
  // A push is pressDown, then ~300 ms later click; the guard outlasts it but stays under a second.
  assert.ok(PRESS_GUARD_MS >= 300, String(PRESS_GUARD_MS));
  assert.ok(PRESS_GUARD_MS <= 1000, String(PRESS_GUARD_MS));
});
