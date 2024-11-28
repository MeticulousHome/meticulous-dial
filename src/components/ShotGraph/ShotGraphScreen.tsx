import { HistoryDataPoint } from '@meticulous-home/espresso-api';
import { useEffect, useMemo, useState } from 'react';
import { styled } from 'styled-components';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  lastShotForProfileQuery,
  useHistoryShot
} from '../../hooks/useHistory';
import { DataTypeKey, dataTypes } from '../../types/dataTypes';
import {
  GraphDividers,
  SelectionIndicator,
  StartEndIndicator
} from './GraphAnnotations';
import { getGraphPath } from './GraphPath';
import { useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

const GRAPH_WIDTH = 270;
const GRAPH_WRAPPER_HEIGHT = 220;
const GRAPH_HEIGHT = 175;
const GRAPH_HORIZONTAL_PADDING = (480 - GRAPH_WIDTH) / 2;
const GRAPH_VERTICAL_PADDING = (GRAPH_WRAPPER_HEIGHT - GRAPH_HEIGHT) / 2;
const GRAPH_SCROLL_STEPS = 50;
const GRAPH_LINE_SIZE = 2;
const GRAPH_LABEL_DOT_SIZE = 10;

export const GRAPH_AXIS_COLOR = '#00475B';

const GraphContainer = styled.div`
  width: 480px;
  height: 480px;
  display: flex;
  padding-top: 20px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
`;

const GraphLabels = styled.div`
  display: flex;
  flex-direction: row;
  gap: 15px;
  justify-content: flex-end;
`;

const GraphLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;
  font-family: 'ABC Diatype Mono';
`;

const GraphLabelText = styled.span`
  font-size: 15px;
  color: #e7e7e799;
  font-family: 'ABC Diatype Mono';
  letter-spacing: 3px;
  text-transform: uppercase;
`;

const GraphValueSquare = styled.div`
  width: ${GRAPH_LABEL_DOT_SIZE}px;
  height: ${GRAPH_LABEL_DOT_SIZE}px;
`;

const GraphValueText = styled.span`
  display: flex;
  display-direction: row;
  font-size: 15px
  font-family: 'Abc_light';
  font-variant-numeric: tabular-nums;
  letter-spacing: 3px
  color: '#E7E7E7';
  text-align: center;
  align-items: center;
  gap: 5px;
`;

type PathsType = Record<DataTypeKey, { path: string; maskPath: string }>;

export const ShotGraphScreen = () => {
  const dispatch = useDispatch<AppDispatch>();

  const [paths, setPaths] = useState<PathsType>({
    flow: { path: '', maskPath: '' },
    pressure: { path: '', maskPath: '' },
    weight: { path: '', maskPath: '' }
  });

  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [selectedPoint, setSelectedPoint] = useState<HistoryDataPoint | null>(
    null
  );

  const activeProfile = useAppSelector((state) => state.presets.activePreset);

  if (!activeProfile) {
    console.error('History was opened without a profile selected');
    dispatch(setScreen('pressets'));
  }

  const { data: profileHistory, isLoading } = useHistoryShot(
    lastShotForProfileQuery(activeProfile)
  );

  const displayShot = profileHistory?.history[0];

  const gestureProgress = useMemo(() => {
    if (!displayShot) {
      return 0;
    }
    const length = Math.max(0, displayShot.data.length - 1);
    return Math.round(length / GRAPH_SCROLL_STEPS);
  }, [displayShot]);

  useHandleGestures({
    left() {
      setSelectedPointIndex((prev) => Math.max(0, prev - gestureProgress));
    },
    right() {
      setSelectedPointIndex((prev) =>
        Math.min(prev + gestureProgress, displayShot?.data.length - 1)
      );
    }
  });

  useEffect(() => {
    if (!displayShot) {
      return;
    }
    const flowPaths = getGraphPath(
      displayShot.data,
      'flow',
      GRAPH_WIDTH,
      GRAPH_HEIGHT
    );
    const pressurePaths = getGraphPath(
      displayShot.data,
      'pressure',
      GRAPH_WIDTH,
      GRAPH_HEIGHT
    );
    const weightPaths = getGraphPath(
      displayShot.data,
      'weight',
      GRAPH_WIDTH,
      GRAPH_HEIGHT
    );

    setPaths({
      flow: { path: flowPaths[0], maskPath: flowPaths[1] },
      pressure: { path: pressurePaths[0], maskPath: pressurePaths[1] },
      weight: { path: weightPaths[0], maskPath: weightPaths[1] }
    });
  }, [displayShot]);

  useEffect(() => {
    if (!displayShot) {
      return;
    }
    setSelectedPoint(displayShot.data[selectedPointIndex]);
  }, [selectedPointIndex, displayShot]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <GraphContainer>
      {/* SVG */}
      <svg width={480} height={GRAPH_WRAPPER_HEIGHT}>
        {/* X AXIS spanning the entire screen */}
        <g transform={`translate(0, ${GRAPH_VERTICAL_PADDING})`}>
          <path
            d={`M${0} ${GRAPH_HEIGHT} L${480} ${GRAPH_HEIGHT}`}
            stroke={GRAPH_AXIS_COLOR}
            strokeWidth={'3'}
          />
        </g>
        {/* The Graph - translated into the middle of the screen */}
        <g
          transform={`translate(${GRAPH_HORIZONTAL_PADDING}, ${GRAPH_VERTICAL_PADDING})`}
        >
          <GraphDividers
            numDeviders={7}
            width={480 + GRAPH_HORIZONTAL_PADDING}
            height={GRAPH_HEIGHT}
          />
          {Object.keys(paths).map((key: Partial<DataTypeKey>) => (
            <path
              key={key}
              d={paths[key].path}
              fill="transparent"
              stroke={dataTypes[key].color}
              strokeWidth={GRAPH_LINE_SIZE}
            />
          ))}
          <StartEndIndicator
            data={displayShot?.data}
            width={GRAPH_WIDTH}
            height={GRAPH_HEIGHT}
          />
          <SelectionIndicator
            data={displayShot?.data}
            selectedPointIndex={selectedPointIndex}
            width={GRAPH_WIDTH}
            height={GRAPH_HEIGHT}
          />
        </g>
      </svg>
      {/* Labels */}
      <GraphLabels>
        {Object.keys(paths).map((dataType: DataTypeKey) => (
          <GraphLabel key={dataType}>
            <GraphLabelText>{dataType}</GraphLabelText>
            <GraphValueText>
              <GraphValueSquare
                style={{ backgroundColor: dataTypes[dataType].color }}
              />
              {(selectedPoint?.shot[dataType] || 0.0).toFixed(
                dataTypes[dataType].precision
              )}
            </GraphValueText>
          </GraphLabel>
        ))}
      </GraphLabels>
    </GraphContainer>
  );
};
