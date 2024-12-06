import { Profile } from '@meticulous-home/espresso-profile';
import { CSSProperties, useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { lastShotForProfileQuery, useHistoryShot } from '../../hooks/useHistory';
import { DataTypeKey, dataTypes } from '../../types/dataTypes';
import {
    GraphDividers,
    StartEndIndicator
} from './GraphAnnotations';
import { getGraphPath } from './GraphPath';

const GRAPH_WIDTH = 170;
const GRAPH_WRAPPER_HEIGHT = 220;
const GRAPH_HEIGHT = 160;
const GRAPH_VERTICAL_PADDING = 20;
const GRAPH_AXIS_COLOR = '#00475B';
const GRAPH_LINE_SIZE = 2;

const GraphLabels = styled.div`
  display: flex;
  flex-direction: row;
  gap: 15px;
  justify-content: flex-end;
`;

const GraphLabelText = styled.span`
  font-size: 15px;
  color: #e7e7e799;
  font-family: 'Abc_light';
  letter-spacing: 3px;
  text-transform: uppercase;
`;

type PathsType = Record<DataTypeKey, { path: string; maskPath: string }>;

export const HistoryGraph = ({
  profile,
  style,
}: {
  profile?: Profile,
  style?: CSSProperties,
}) => {
  const [paths, setPaths] = useState<PathsType>({
    flow: { path: '', maskPath: '' },
    pressure: { path: '', maskPath: '' },
    weight: { path: '', maskPath: '' }
  });

  const {data: profileHistory, isFetching} = useHistoryShot(lastShotForProfileQuery(profile));

  const displayShot = profileHistory?.history[0];

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

  if (isFetching) {
    return (
        <div style={{height:'100%', ...style}}>
<GraphLabels>
      <GraphLabelText>
        <GraphLabelText>Loading last shot for this profile</GraphLabelText>
        </GraphLabelText>
    </GraphLabels>
    </div>)
  }
  if (!profileHistory || !displayShot) {
    return (
        <div style={style}>
    <GraphLabels>
    <GraphLabelText>
      <GraphLabelText>No recent shots for this profile</GraphLabelText>
      </GraphLabelText>
    </GraphLabels>
    </div>)
  }
  return (
    <div style={style}>
      {/* SVG */}
      <svg width={480} height={GRAPH_WRAPPER_HEIGHT}>
        {/* The Graph - translated into the middle of the screen */}
        <g
          transform={`translate(${0}, ${GRAPH_VERTICAL_PADDING})`}
        >
        {/* X AXIS  */}

          <path
            d={`M${0} ${GRAPH_HEIGHT} L${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            stroke={GRAPH_AXIS_COLOR}
            strokeWidth={'3'}
          />
          <GraphDividers numDeviders={12}  width={GRAPH_WIDTH} height={GRAPH_HEIGHT}/>
          {Object.keys(paths).map((key: Partial<DataTypeKey>) => (
            <path
              key={key}
              d={paths[key].path}
              fill="transparent"
              stroke={dataTypes[key].color}
              strokeWidth={GRAPH_LINE_SIZE}
            />
          ))}
          <StartEndIndicator data={displayShot?.data} width={GRAPH_WIDTH} height={GRAPH_HEIGHT} />
        </g>
      </svg>
      {/* Labels */}
    </div>
  );
};
