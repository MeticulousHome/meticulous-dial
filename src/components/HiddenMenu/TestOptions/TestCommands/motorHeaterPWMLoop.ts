import { MotorHeaterProfile, MotorHeaterPWMValues } from './motorHeaterPWM';

export const createMotorHeaterPWMLoopTest = (
  values: MotorHeaterPWMValues
): MotorHeaterProfile => ({
  name: 'Control Motor and Heater (loop)',
  id: 'control_motor_heater_loop',
  source: 'Meticulous',
  stages: [
    {
      name: 'simultaneous_control',
      nodes: [
        {
          id: -1,
          controllers: [],
          triggers: [
            {
              kind: 'exit',
              next_node_id: 100
            }
          ]
        },
        {
          id: 100,
          controllers: [
            {
              kind: 'time_reference',
              id: 1
            }
          ],
          triggers: [
            {
              kind: 'exit',
              next_node_id: 1
            }
          ]
        },
        {
          id: 1,
          controllers: [
            {
              kind: 'heater_power_controller',
              algorithm: 'Heater Power Bypass',
              curve: {
                id: 201,
                interpolation_kind: 'linear_interpolation',
                points: [[0, values.heaterValue]],
                time_reference_id: 1
              }
            }
          ],
          triggers: [
            {
              kind: 'timer_trigger',
              timer_reference_id: 1,
              operator: '>=',
              value: 1,
              next_node_id: 200
            }
          ]
        },
        {
          id: 200,
          controllers: [
            {
              kind: 'time_reference',
              id: 2
            }
          ],
          triggers: [
            {
              kind: 'exit',
              next_node_id: 2
            }
          ]
        },
        {
          id: 2,
          controllers: [
            {
              kind: 'piston_power_controller',
              algorithm: 'Spring v1.0',
              curve: {
                id: 101,
                interpolation_kind: 'linear_interpolation',
                points: [[0, -values.motorValue]],
                time_reference_id: 2
              }
            }
          ],
          triggers: [
            {
              kind: 'timer_trigger',
              timer_reference_id: 2,
              operator: '>=',
              value: 1,
              next_node_id: 300
            }
          ]
        },
        {
          id: 300,
          controllers: [
            {
              kind: 'time_reference',
              id: 3
            }
          ],
          triggers: [
            {
              kind: 'exit',
              next_node_id: 3
            }
          ]
        },
        {
          id: 3,
          controllers: [
            {
              kind: 'piston_power_controller',
              algorithm: 'Spring v1.0',
              curve: {
                id: 102,
                interpolation_kind: 'linear_interpolation',
                points: [[0, -values.motorValue]],
                time_reference_id: 3
              }
            }
          ],
          triggers: [
            {
              kind: 'piston_speed_trigger',
              operator: '==',
              value: 0,
              next_node_id: 400
            },
            {
              kind: 'timer_trigger',
              timer_reference_id: 3,
              operator: '>=',
              value: 300,
              next_node_id: 400
            }
          ]
        },
        {
          id: 400,
          controllers: [
            {
              kind: 'time_reference',
              id: 4
            }
          ],
          triggers: [
            {
              kind: 'exit',
              next_node_id: 4
            }
          ]
        },
        {
          id: 4,
          controllers: [
            {
              kind: 'piston_power_controller',
              algorithm: 'Spring v1.0',
              curve: {
                id: 103,
                interpolation_kind: 'linear_interpolation',
                points: [[0, values.motorValue]],
                time_reference_id: 4
              }
            }
          ],
          triggers: [
            {
              kind: 'timer_trigger',
              timer_reference_id: 4,
              operator: '>=',
              value: 1,
              next_node_id: 500
            }
          ]
        },
        {
          id: 500,
          controllers: [
            {
              kind: 'time_reference',
              id: 5
            }
          ],
          triggers: [
            {
              kind: 'exit',
              next_node_id: 5
            }
          ]
        },
        {
          id: 5,
          controllers: [
            {
              kind: 'piston_power_controller',
              algorithm: 'Spring v1.0',
              curve: {
                id: 104,
                interpolation_kind: 'linear_interpolation',
                points: [[0, values.motorValue]],
                time_reference_id: 5
              }
            }
          ],
          triggers: [
            {
              kind: 'piston_speed_trigger',
              operator: '==',
              value: 0,
              next_node_id: 100
            },
            {
              kind: 'timer_trigger',
              timer_reference_id: 5,
              operator: '>=',
              value: 300,
              next_node_id: 100
            }
          ]
        },
        {
          id: -2,
          controllers: [
            {
              kind: 'end_profile'
            }
          ],
          triggers: []
        }
      ]
    }
  ]
});
