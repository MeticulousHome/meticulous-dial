// Button grouping follows the firmware/backend event contract, including a
// terminal click after raw release and a long press before raw release. No
// elapsed-time heuristic is used to guess where a gesture ends.
type Button = 'encoder' | 'tare' | 'context';
type Phase = 'press' | 'release' | 'terminal';
type Press = { down: boolean; terminal: boolean; consume: boolean };

const buttons: Record<string, [Button, Phase]> = {
  ENCODER_PRESSED: ['encoder', 'press'],
  ENCODER_RELEASED: ['encoder', 'release'],
  ENCODER_PUSH: ['encoder', 'terminal'],
  ENCODER_DOUBLE: ['encoder', 'terminal'],
  ENCODER_LONG: ['encoder', 'terminal'],
  TARE_PRESSED: ['tare', 'press'],
  TARE_RELEASED: ['tare', 'release'],
  TARE: ['tare', 'terminal'],
  TARE_DOUBLE: ['tare', 'terminal'],
  TARE_LONG: ['tare', 'terminal'],
  TARE_SUPER_LONG: ['tare', 'terminal'],
  CONTEXT_PRESSED: ['context', 'press'],
  CONTEXT_RELEASED: ['context', 'release'],
  CONTEXT: ['context', 'terminal']
};

export class WakeInputGate {
  private presses: Partial<Record<Button, Press>> = {};

  handle(type: string, idle: boolean) {
    if (type === 'ENCODER_CLOCKWISE' || type === 'ENCODER_COUNTERCLOCKWISE') {
      return { activity: true, wake: idle, consume: idle };
    }
    const button = buttons[type];
    if (!button) return { activity: false, wake: false, consume: false };
    const [name, phase] = button;
    let press = this.presses[name];

    if (phase === 'press') {
      // A fresh edge after a long-press terminal also recovers from a missing
      // raw release. Two presses awaiting a double-click remain one group.
      if (!press || press.terminal) {
        press = { down: true, terminal: false, consume: idle };
        this.presses[name] = press;
      } else {
        press.down = true;
        press.consume ||= idle;
      }
      return { activity: true, wake: idle, consume: press.consume };
    }

    if (!press) {
      // Compatibility with a peer that sends only a decoded click. An orphan
      // release never wakes, including the release after choosing Screen off.
      return {
        activity: true,
        wake: idle && phase === 'terminal',
        consume: idle
      };
    }
    // The press may have selected Screen off while the machine was awake.
    // Its release/click belongs to that selection and must leave it dark.
    press.consume ||= idle;
    if (phase === 'release') press.down = false;
    else press.terminal = true;
    if (!press.down && press.terminal) delete this.presses[name];
    return { activity: true, wake: false, consume: press.consume };
  }
}
