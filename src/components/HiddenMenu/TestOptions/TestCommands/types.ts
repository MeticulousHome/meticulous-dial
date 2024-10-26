import { MotorHeaterProfile } from './motorHeaterPWM';

export interface BaseTestCommand {
  id: string;
  test_key: string;
}

export interface SimpleTestCommand extends BaseTestCommand {
  name: string;
  test_value: number | boolean;
  type: 'simple';
}

export interface ProfileTestCommand extends BaseTestCommand {
  type: 'profile';
  profile: MotorHeaterProfile;
}

export type TestCommand = SimpleTestCommand | ProfileTestCommand;

export interface TestOptionsOption {
  key: string;
  label: string;
  maxValue?: number;
  interval?: number;
  unit?: '%' | 'PWM';
  isBoolean?: boolean;
  createCommand?: (value: number | boolean) => TestCommand;
  opensControlPanel?: boolean;
  opensWiFiMenu?: boolean;
}
