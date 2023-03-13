import { PressetSettings } from '../types/index';

interface PayloadProps {
  presset: PressetSettings;
}

const getKeyPresset = (presset: PressetSettings, key: string) => {
  return presset.settings.find((item) => item.key === key);
};

export const generatePayload = ({ presset }: PayloadProps) => {
  const temperature = getKeyPresset(presset, 'temperature');
  const preinfusion = getKeyPresset(presset, 'pre-infusion');
  const pressure = getKeyPresset(presset, 'pressure');
  const purgeS = getKeyPresset(presset, 'purge');
  const outpuS = getKeyPresset(presset, 'output');

  const isPurgeAutomatic = purgeS.value === 'automatic';
  const isPressureActivated = preinfusion.value === 'yes';

  const initialize = {
    name: 'heating',
    nodes: [
      {
        id: -1,
        controllers: [],
        triggers: [
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            operator: '>=',
            value: 60,
            next_node_id: 5,
            source: 'Piston Position Raw'
          },
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            operator: '<',
            value: 60,
            next_node_id: 2,
            source: 'Piston Position Raw'
          }
        ]
      },
      {
        id: 2,
        controllers: [
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Ease-In',
            direction: 'DOWN',
            speed: 6
          },
          {
            kind: 'time_reference',
            id: 30
          }
        ],
        triggers: [
          {
            kind: 'pressure_value_trigger',
            source: 'Pressure Raw',
            operator: '>=',
            value: 6,
            next_node_id: 3
          },
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            source: 'Piston Position Raw',
            operator: '>=',
            value: 60,
            next_node_id: 5
          }
        ]
      },
      {
        id: 3,
        controllers: [
          {
            kind: 'pressure_controller',
            algorithm: 'Pressure PID v1.0',
            curve: {
              id: 13,
              interpolation_kind: 'linear_interpolation',
              points: [[0, 6]],
              time_reference_id: 30
            }
          }
        ],
        triggers: [
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            source: 'Piston Position Raw',
            operator: '>=',
            value: 60,
            next_node_id: 5
          }
        ]
      },
      {
        id: 5,
        controllers: [
          {
            kind: 'time_reference',
            id: 2
          }
        ],
        triggers: [
          {
            kind: 'water_detection_trigger',
            value: true,
            next_node_id: 7
          },
          {
            kind: 'water_detection_trigger',
            value: false,
            next_node_id: 6
          }
        ]
      },
      {
        id: 6,
        controllers: [
          {
            kind: 'log_controller',
            message: 'No Water'
          }
        ],
        triggers: [
          {
            kind: 'timer_trigger',
            timer_reference_id: 2,
            operator: '>=',
            value: 2,
            next_node_id: 5
          },
          {
            kind: 'timer_trigger',
            timer_reference_id: 1,
            operator: '>=',
            value: 100,
            next_node_id: -2
          }
        ]
      },
      {
        id: 7,
        controllers: [
          {
            kind: 'temperature_controller',
            algorithm: 'Cylinder Temperature PID v1.0',
            curve: {
              id: 0,
              interpolation_kind: 'linear_interpolation',
              points: [[0, 180]],
              time_reference_id: 2
            }
          }
        ],
        triggers: [
          {
            kind: 'temperature_value_trigger',
            source: 'Tube Temperature',
            operator: '>=',
            value: temperature.value,
            next_node_id: 8
          },
          {
            kind: 'timer_trigger',
            timer_reference_id: 2,
            operator: '>=',
            value: 900,
            next_node_id: -2
          }
        ]
      },
      {
        id: 8,
        controllers: [
          {
            kind: 'temperature_controller',
            algorithm: 'Cylinder Temperature PID v1.0',
            curve: {
              id: 1,
              interpolation_kind: 'linear_interpolation',
              points: [[0, 25]],
              time_reference_id: 2
            }
          },
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Ease-In',
            direction: 'UP',
            speed: 4
          }
        ],
        triggers: [
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            operator: '<=',
            value: 55,
            next_node_id: 9,
            source: 'Piston Position Raw'
          }
        ]
      },
      {
        id: 9,
        controllers: [
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Ease-In',
            direction: 'UP',
            speed: 6
          }
        ],
        triggers: [
          {
            kind: 'piston_speed_trigger',
            operator: '==',
            value: 0,
            next_node_id: 25
          }
        ]
      },
      {
        id: 25,
        controllers: [
          {
            kind: 'tare_controller'
          },
          {
            kind: 'time_reference',
            id: 10
          }
        ],
        triggers: [
          {
            kind: 'exit',
            next_node_id: 26
          }
        ]
      },
      {
        id: 26,
        controllers: [
          {
            kind: 'weight_reference',
            id: 1
          }
        ],
        triggers: [
          {
            kind: 'timer_trigger',
            timer_reference_id: 10,
            operator: '>=',
            value: 2,
            next_node_id: 21
          }
        ]
      }
    ]
  };

  const init = {
    name: 'heating',
    nodes: [
      {
        id: 21,
        controllers: [
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Ease-In',
            direction: 'DOWN',
            speed: 5
          },
          {
            kind: 'time_reference',
            id: 3
          }
        ],
        triggers: [
          {
            kind: 'pressure_value_trigger',
            source: 'Pressure Raw',
            operator: '>=',
            value: 0.2,
            next_node_id: isPressureActivated ? 10 : 12
          }
        ]
      }
    ]
  };

  const preInfusion = {
    name: 'preinfusion',
    nodes: [
      {
        id: 10,
        controllers: [
          {
            kind: 'temperature_controller',
            algorithm: 'Cylinder Temperature PID v1.0',
            curve: {
              id: 3,
              interpolation_kind: 'linear_interpolation',
              points: [[0, 25]],
              time_reference_id: 2
            }
          },
          {
            kind: 'flow_controller',
            algorithm: 'Flow PID v1.0',
            curve: {
              id: 4,
              interpolation_kind: 'catmull_interpolation',
              points: [[0, 4]],
              time_reference_id: 3
            }
          },
          {
            kind: 'position_reference',
            id: 1
          }
        ],
        triggers: [
          {
            kind: 'timer_trigger',
            timer_reference_id: 3,
            operator: '>=',
            value: 30,
            next_node_id: 12
          },
          {
            kind: 'pressure_value_trigger',
            source: 'Pressure Predictive',
            operator: '>=',
            value: pressure.value,
            next_node_id: 11
          },
          {
            kind: 'weight_value_trigger',
            source: 'Weight Raw',
            weight_reference_id: 1,
            operator: '>=',
            value: 0.3,
            next_node_id: 12
          },
          {
            kind: 'button_trigger',
            source: 'Encoder Button',
            gesture: 'Single Tap',
            next_node_id: 10
          }
        ]
      },
      {
        id: 11,
        controllers: [
          {
            kind: 'pressure_controller',
            algorithm: 'Pressure PID v1.0',
            curve: {
              id: 6,
              interpolation_kind: 'catmull_interpolation',
              points: [[0, 8]],
              time_reference_id: 3
            }
          },
          {
            kind: 'position_reference',
            id: 1
          }
        ],
        triggers: [
          {
            kind: 'timer_trigger',
            timer_reference_id: 3,
            operator: '>=',
            value: 30,
            next_node_id: 12
          },
          {
            kind: 'flow_curve_trigger',
            source: 'Flow Raw',
            operator: '>=',
            curve_id: 4,
            next_node_id: 10
          },
          {
            kind: 'weight_value_trigger',
            source: 'Weight Raw',
            weight_reference_id: 1,
            operator: '>=',
            value: 0.3,
            next_node_id: 12
          },
          {
            kind: 'button_trigger',
            source: 'Encoder Button',
            gesture: 'Single Tap',
            next_node_id: 10
          }
        ]
      }
    ]
  };

  const infusion = {
    name: 'infusion',
    nodes: [
      {
        id: 12,
        controllers: [
          {
            kind: 'time_reference',
            id: 4
          }
        ],
        triggers: [
          {
            kind: 'exit',
            next_node_id: 13
          }
        ]
      },
      {
        id: 13,
        controllers: [
          {
            kind: 'temperature_controller',
            algorithm: 'Cylinder Temperature PID v1.0',
            curve: {
              id: 12,
              interpolation_kind: 'linear_interpolation',
              points: [[0, 25]],
              time_reference_id: 4
            }
          },
          {
            kind: 'pressure_controller',
            algorithm: 'Pressure PID v1.0',
            curve: {
              id: 7,
              interpolation_kind: 'catmull_interpolation',
              points: [
                [0, 8],
                [10, 6]
              ],
              time_reference_id: 4
            }
          },
          {
            kind: 'position_reference',
            id: 1
          }
        ],
        triggers: [
          {
            kind: 'timer_trigger',
            timer_reference_id: 4,
            operator: '>=',
            value: 100,
            next_node_id: 14
          },
          {
            kind: 'weight_value_trigger',
            source: 'Weight Raw',
            weight_reference_id: 1,
            operator: '>=',
            value: 36,
            next_node_id: 14
          },
          {
            kind: 'flow_value_trigger',
            source: 'Flow Raw',
            operator: '>=',
            value: 8,
            next_node_id: 20
          },
          {
            kind: 'button_trigger',
            source: 'Encoder Button',
            gesture: 'Single Tap',
            next_node_id: 10
          }
        ]
      },
      {
        id: 20,
        controllers: [
          {
            kind: 'flow_controller',
            algorithm: 'Flow PID v1.0',
            curve: {
              id: 9,
              interpolation_kind: 'catmull_interpolation',
              points: [[0, 8]],
              time_reference_id: 3
            }
          },
          {
            kind: 'position_reference',
            id: 1
          }
        ],
        triggers: [
          {
            kind: 'timer_trigger',
            timer_reference_id: 4,
            operator: '>=',
            value: 100,
            next_node_id: 14
          },
          {
            kind: 'weight_value_trigger',
            source: 'Weight Raw',
            weight_reference_id: 1,
            operator: '>=',
            value: 36,
            next_node_id: 14
          },
          {
            kind: 'pressure_curve_trigger',
            source: 'Pressure Raw',
            operator: '>=',
            curve_id: 7,
            next_node_id: 13
          },
          {
            kind: 'button_trigger',
            source: 'Encoder Button',
            gesture: 'Single Tap',
            next_node_id: 10
          }
        ]
      }
    ]
  };

  const retract = {
    name: 'infusion',
    nodes: [
      {
        id: -2,
        controllers: [
          {
            kind: 'end_profile'
          }
        ],
        triggers: []
      },
      {
        id: 14,
        controllers: [
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Fast',
            direction: 'UP',
            speed: 6
          }
        ],
        triggers: [
          {
            kind: 'piston_position_trigger',
            position_reference_id: 1,
            operator: '<=',
            value: -4,
            // TODO: change 18 to 16
            next_node_id: isPurgeAutomatic ? 18 : -2,
            source: 'Piston Position Raw'
          }
        ]
      },
      {
        id: 15,
        controllers: [
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Fast',
            direction: 'UP',
            speed: 2
          }
        ],
        triggers: [
          {
            kind: 'piston_position_trigger',
            position_reference_id: 1,
            operator: '<=',
            value: -15,
            source: 'Piston Position Raw',
            next_node_id: 16
          }
        ]
      }
    ]
  };

  const purge = {
    name: 'purge',
    nodes: [
      {
        id: 16,
        controllers: [
          {
            kind: 'move_piston_controller',
            algorithm: 'Piston Ease-In',
            direction: 'DOWN',
            speed: 6
          },
          {
            kind: 'time_reference',
            id: 1
          }
        ],
        triggers: [
          {
            kind: 'pressure_value_trigger',
            source: 'Pressure Raw',
            operator: '>=',
            value: 6,
            next_node_id: 17
          },
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            source: 'Piston Position Raw',
            operator: '>=',
            value: 60,
            next_node_id: -2
          }
        ]
      },
      {
        id: 17,
        controllers: [
          {
            kind: 'pressure_controller',
            algorithm: 'Pressure PID v1.0',
            curve: {
              id: 1,
              interpolation_kind: 'linear_interpolation',
              points: [[0, 6]],
              time_reference_id: 1
            }
          }
        ],
        triggers: [
          {
            kind: 'piston_position_trigger',
            position_reference_id: 0,
            source: 'Piston Position Raw',
            operator: '>=',
            value: 60,
            next_node_id: -2
          }
        ]
      }
    ]
  };

  const stages = [initialize, init];

  if (isPressureActivated) {
    stages.push(preInfusion);
  }

  stages.push(infusion, retract);

  if (isPurgeAutomatic) {
    stages.push(purge);
  }

  return {
    name: presset.name,
    stages
  };
};
