export interface Controller {
  kind: string;
  id?: number;
  algorithm?: string;
  curve?: {
    id: number;
    interpolation_kind: string;
    points: Array<[number, number]>;
    time_reference_id: number;
  };
}

export interface Trigger {
  kind: string;
  next_node_id?: number;
  timer_reference_id?: number;
  operator?: string;
  value?: number;
}

export interface Node {
  id: number;
  controllers: Controller[];
  triggers: Trigger[];
}

export interface Stage {
  name: string;
  nodes: Node[];
}

export interface MotorHeaterProfile {
  name: string;
  id: string;
  source: string;
  stages: Stage[];
}

export interface MotorHeaterPWMValues {
  motorValue: number;
  heaterValue: number;
}

export const createMotorHeaterPWMTest = (
  values: MotorHeaterPWMValues
): MotorHeaterProfile => ({
  name: 'Control Motor and Heater',
  id: 'control_motor_heater',
  source: 'Meticulous',
  stages: [
    {
      name: 'simultaneous_control',
      nodes: [
        {
          id: -1,
          controllers: [{ kind: 'time_reference', id: 1 }],
          triggers: [{ kind: 'exit', next_node_id: 1 }]
        },
        {
          id: 1,
          controllers: [
            {
              kind: 'piston_power_controller',
              algorithm: 'Spring v1.0',
              curve: {
                id: 1,
                interpolation_kind: 'linear_interpolation',
                points: [[0, values.motorValue]],
                time_reference_id: 1
              }
            },
            {
              kind: 'heater_power_controller',
              algorithm: 'Heater Power Bypass',
              curve: {
                id: 2,
                interpolation_kind: 'linear_interpolation',
                points: [[0, values.heaterValue]],
                time_reference_id: 1
              }
            }
          ],
          triggers: []
        },
        {
          id: -2,
          controllers: [{ kind: 'end_profile' }],
          triggers: []
        }
      ]
    }
  ]
});
