import { useState, useCallback, useEffect } from 'react';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setScreen } from '../../store/features/screens/screens-slice';
import { createMotorHeaterPWMTest } from '../TestOptions/TestCommands/motorHeaterPWM';
import { createMotorHeaterPWMLoopTest } from '../TestOptions/TestCommands/motorHeaterPWMLoop';
import { sendLegacyJson, enableLegacyJson } from '../TestOptions/legacyApi';
import { PowerControlWithDirection } from './PowerControlWithDirection';
import { useSocket } from '../../store/SocketManager';
import './ControlPanel.css';

type NavigationItem = 'heater' | 'motor' | 'motor-direction' | 'start' | 'exit';
type MotorMode = 'up' | 'down' | 'loop';

interface PowerValues {
  heater: number;
  motor: number;
  motorMode: MotorMode;
}

interface SensorData {
  termistor1: number;
  termistor2: number;
  speed: number;
  motorCurrent: number;
  heaterCurrent: number;
  motorPowerSensor: number;
  heaterPowerSensor: number;
}

interface ActuatorData {
  m_pos: number;
  m_spd: number;
  m_pwr: number;
  m_cur: number;
  bh_pwr: number;
  bh_cur: number;
}

interface SensorsData {
  t_ext_1: number;
  t_ext_2: number;
  t_bar_up: number;
  t_bar_mu: number;
  t_bar_md: number;
  t_bar_down: number;
  t_tube: number;
  t_valv: number;
  lam_temp: number;
}

export function ControlPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const stateName = useAppSelector((state) => state.stats.name);

  const [sensorData, setSensorData] = useState<SensorData>({
    termistor1: 0,
    termistor2: 0,
    speed: 0,
    motorCurrent: 0.0,
    heaterCurrent: 0.0,
    motorPowerSensor: 0,
    heaterPowerSensor: 0
  });

  const [powerValues, setPowerValues] = useState<PowerValues>({
    heater: 0,
    motor: 0,
    motorMode: 'up'
  });

  const [isRunning, setIsRunning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NavigationItem>('heater');
  const [editingPower, setEditingPower] = useState<'heater' | 'motor' | null>(
    null
  );
  const [buttonText, setButtonText] = useState('Start');
  const [prevState, setPrevState] = useState<string>(stateName);

  useEffect(() => {
    if (!socket) return;

    const handleActuators = (data: ActuatorData) => {
      setSensorData((prev) => ({
        ...prev,
        speed: Number(data.m_spd.toFixed(1)),
        motorCurrent: Number(data.m_cur.toFixed(2)),
        heaterCurrent: Number(data.bh_cur.toFixed(2)),
        motorPowerSensor: Number(data.m_pwr.toFixed(1)),
        heaterPowerSensor: Number(data.bh_pwr.toFixed(1))
      }));
    };

    const handleSensors = (data: SensorsData) => {
      setSensorData((prev) => ({
        ...prev,
        termistor1: Number(data.t_ext_1.toFixed(1)),
        termistor2: Number(data.t_ext_2.toFixed(1))
      }));
    };

    socket.on('actuators', handleActuators);
    socket.on('sensors', handleSensors);

    return () => {
      socket.off('actuators', handleActuators);
      socket.off('sensors', handleSensors);
    };
  }, [socket]);

  const navigationItems: NavigationItem[] = [
    'heater',
    'motor',
    'motor-direction',
    'start',
    'exit'
  ];

  useEffect(() => {
    if (stateName !== prevState) {
      if (stateName === 'starting...') {
        // Do nothing when starting, maintain current state
      } else if (stateName === 'simultaneous_control') {
        setIsRunning(true);
        setButtonText('Double click to stop');
      } else if (stateName === 'idle' && prevState === 'simultaneous_control') {
        setIsRunning(false);
        setButtonText('Start');
      }

      setPrevState(stateName);
    }
  }, [stateName, prevState, isRunning, buttonText]);

  const handleStartTest = useCallback(async () => {
    try {
      await enableLegacyJson();
      const isLoop = powerValues.motorMode === 'loop';
      const motorValue =
        powerValues.motorMode === 'up' ? -powerValues.motor : powerValues.motor;

      const testProfile = isLoop
        ? createMotorHeaterPWMLoopTest({
            motorValue,
            heaterValue: powerValues.heater
          })
        : createMotorHeaterPWMTest({
            motorValue,
            heaterValue: powerValues.heater
          });

      await sendLegacyJson(testProfile);
    } catch (error) {
      console.error('Error starting motor/heater test:', error);
      setIsRunning(false);
      setButtonText('Start');
    }
  }, [powerValues]);

  const handleStopTest = useCallback(() => {
    setIsRunning(false);
    setButtonText('Start');
  }, []);

  const handlePowerChange = useCallback(
    (type: 'heater' | 'motor', direction: 'left' | 'right') => {
      setPowerValues((prev) => {
        const change = direction === 'left' ? -5 : 5;
        const newValue = Math.min(Math.max(prev[type] + change, 0), 100);
        return {
          ...prev,
          [type]: newValue
        };
      });
    },
    []
  );

  const handleMotorDirectionChange = () => {
    setPowerValues((prev) => ({
      ...prev,
      motorMode:
        prev.motorMode === 'up'
          ? 'down'
          : prev.motorMode === 'down'
            ? 'loop'
            : 'up'
    }));
  };

  useHandleGestures({
    pressDown() {
      if (editingPower) {
        setEditingPower(null);
        return;
      }

      if (selectedItem === 'exit') {
        if (stateName === 'simultaneous_control') {
          return;
        }
        dispatch(setScreen('test-options'));
        return;
      }

      switch (selectedItem) {
        case 'heater':
        case 'motor':
          setEditingPower(selectedItem);
          break;
        case 'motor-direction':
          handleMotorDirectionChange();
          break;
        case 'start':
          if (!isRunning) {
            handleStartTest();
          }
          break;
      }
    },
    doubleClick() {
      if (selectedItem === 'start' && isRunning) {
        handleStopTest();
      } else if (selectedItem === 'heater' || selectedItem === 'motor') {
        setPowerValues((prev) => ({
          ...prev,
          [selectedItem]: 0
        }));
      }
    },
    left() {
      if (editingPower) {
        handlePowerChange(editingPower, 'left');
      } else {
        const currentIndex = navigationItems.indexOf(selectedItem);
        if (currentIndex > 0) {
          setSelectedItem(navigationItems[currentIndex - 1]);
        }
      }
    },
    right() {
      if (editingPower) {
        handlePowerChange(editingPower, 'right');
      } else {
        const currentIndex = navigationItems.indexOf(selectedItem);
        if (currentIndex < navigationItems.length - 1) {
          setSelectedItem(navigationItems[currentIndex + 1]);
        }
      }
    }
  });

  return (
    <div className="menu-motor-heater">
      <div className="sensors">
        <div className="sensor-value">
          <span className="sensor-value-label">Ext. term 1:</span>
          <span className="sensor-value-number">{sensorData.termistor1}°C</span>
        </div>
        <div className="sensor-value">
          <span className="sensor-value-label">Ext. term 2:</span>
          <span className="sensor-value-number">{sensorData.termistor2}°C</span>
        </div>
        <div className="sensor-value">
          <span className="sensor-value-label">Speed:</span>
          <span className="sensor-value-number">{sensorData.speed} mm/s</span>
        </div>
        <div className="sensor-value">
          <span className="sensor-value-label">Motor curr:</span>
          <span className="sensor-value-number">
            {sensorData.motorCurrent}A
          </span>
        </div>
        <div className="sensor-value">
          <span className="sensor-value-label">Heat. curr:</span>
          <span className="sensor-value-number">
            {sensorData.heaterCurrent}A
          </span>
        </div>
        <div className="sensor-value">
          <span className="sensor-value-label">Motor pwr:</span>
          <span className="sensor-value-number">
            {sensorData.motorPowerSensor}%
          </span>
        </div>
        <div className="sensor-value">
          <span className="sensor-value-label">Heat. pwr:</span>
          <span className="sensor-value-number">
            {sensorData.heaterPowerSensor}%
          </span>
        </div>
      </div>

      <div className="target-controls">
        <PowerControlWithDirection
          label="Heat. power:"
          value={powerValues.heater}
          isSelected={selectedItem === 'heater'}
          isEditing={editingPower === 'heater'}
          isMotor={false}
          mode="up"
        />
        <PowerControlWithDirection
          label="Motor power:"
          value={powerValues.motor}
          isSelected={selectedItem === 'motor'}
          isEditing={editingPower === 'motor'}
          isMotor={true}
          isDirectionSelected={selectedItem === 'motor-direction'}
          mode={powerValues.motorMode}
          onDirectionSelect={() => setSelectedItem('motor-direction')}
        />
      </div>

      <button
        className={`button ${selectedItem === 'start' ? 'selected' : ''}`}
      >
        {buttonText}
      </button>
      <button
        className={`button ${selectedItem === 'exit' ? 'selected' : ''} ${
          stateName === 'simultaneous_control' ? 'disabled' : ''
        }`}
      >
        EXIT
      </button>
    </div>
  );
}

export default ControlPanel;
