import { HistoryDataPoint } from '@meticulous-home/espresso-api';
import { useMemo } from 'react';
import { colorBrandRed, colorGrayScale3 } from '../../constants/colors';
import {
  GRAPH_AXIS_COLOR,
  GRAPH_HEIGHT,
  GRAPH_HORIZONTAL_PADDING,
  GRAPH_POINT_RADIUS,
  GRAPH_WIDTH
} from './ShotGraphScreen';

export interface GraphDividersProps {
  numDeviders: number;
}

export const GraphDividers = ({ numDeviders }: GraphDividersProps) => {
  const lineSpacing = GRAPH_HEIGHT / (numDeviders - 1);
  return (
    <>
      {Array.from({ length: numDeviders }, (_, i) => {
        const x = 0;
        const y = lineSpacing * i;
        return (
          <path
            key={i}
            d={`M${x} ${y} L${GRAPH_WIDTH + GRAPH_HORIZONTAL_PADDING} ${y}`}
            stroke={colorGrayScale3}
            strokeWidth={1}
            strokeDasharray={'4,8'}
          />
        );
      })}
    </>
  );
};

function valueText(
  x: number,
  y: number,
  dataValue: string,
  unitValue: string,
  anchor?: string
) {
  return (
    <text
      x={x}
      y={y}
      fontFamily="Abc"
      fontSize={5}
      fontVariant="tabular-nums"
      textAnchor={anchor}
    >
      <tspan fontSize={15} fill="#E7E7E7">
        {dataValue}
      </tspan>
      ;
      <tspan fontSize={15} fill="#E7E7E799">
        {unitValue}
      </tspan>
      ;
    </text>
  );
}
const TRIANGLE_SIZE = 12;
// 0.8660 is the sin of 60 degrees or Math.sqrt(3) / 2
const triangleRightPoints = `0 0, ${0.866 * TRIANGLE_SIZE} ${TRIANGLE_SIZE / 2}, 0 ${TRIANGLE_SIZE}`;
const triangleLeftPoints = `${TRIANGLE_SIZE} 0, ${(1 - 0.866) * TRIANGLE_SIZE} ${TRIANGLE_SIZE / 2}, ${TRIANGLE_SIZE} ${TRIANGLE_SIZE}`;

export const SelectionIndicator = ({
  data,
  selectedPointIndex
}: {
  data: HistoryDataPoint[];
  selectedPointIndex: number;
}) => {
  const selectedPointX = useMemo(() => {
    if (!data) {
      return 0;
    }
    const selectedPoint = data[selectedPointIndex];
    const first = data[0];
    const last = data[data.length - 1];
    const startTime = first.time;
    const endTime = last.time;
    return (
      (selectedPoint.time - startTime) * (GRAPH_WIDTH / (endTime - startTime))
    );
  }, [data, selectedPointIndex]);

  if (!data) {
    return <></>;
  }
  const indexPercentage = selectedPointIndex / data.length;
  const fontDisplacement = Math.cos(indexPercentage * Math.PI);
  const simulatedFontCenter =
    fontDisplacement > 0 ? fontDisplacement * 20 : fontDisplacement * 35;
  const leftColoring = Math.round(
    (indexPercentage === 0
      ? 0
      : indexPercentage < 0.1
        ? indexPercentage / 0.1
        : 1) * 255
  )
    .toString(16)
    .padStart(2, '0');
  const rightColoring = Math.round(
    (indexPercentage > 0.9 ? (1 - indexPercentage) / 0.1 : 1) * 255
  )
    .toString(16)
    .padStart(2, '0');
  console.log(indexPercentage, leftColoring, rightColoring);
  return (
    <>
      {valueText(
        selectedPointX + 5 + simulatedFontCenter,
        -5,
        (data[selectedPointIndex]?.time / 100 || 0.0).toFixed(1),
        's',
        'middle'
      )}
      <path
        d={`M${selectedPointX} ${0} L${selectedPointX} ${GRAPH_HEIGHT + GRAPH_POINT_RADIUS / 2}`}
        stroke={colorBrandRed}
        strokeWidth={'3'}
        strokeLinecap="round"
      />

      <polygon
        transform={`translate(${selectedPointX - 5 - TRIANGLE_SIZE}, ${GRAPH_HEIGHT + 6})`}
        // points="5 1.5, 10 10, 0 10"
        points={triangleLeftPoints}
        fill={colorBrandRed + leftColoring}
      />

      <polygon
        transform={`translate(${selectedPointX + 5}, ${GRAPH_HEIGHT + 6})`}
        // points="5 1.5, 10 10, 0 10"
        points={triangleRightPoints}
        fill={colorBrandRed + rightColoring}
      />
    </>
  );
};

export const StartEndIndicator = ({ data }: { data: HistoryDataPoint[] }) => {
  if (!data) {
    return <></>;
  }
  const last = data[data.length - 1];
  return (
    <>
      {valueText(
        GRAPH_WIDTH + 5,
        -5,
        (last?.shot.weight || 0.0).toFixed(1),
        'g'
      )}
      {valueText(
        GRAPH_WIDTH + 5,
        GRAPH_HEIGHT + 20,
        (last?.time / 1000 || 0.0).toFixed(1),
        's'
      )}
      <path
        d={`M${GRAPH_WIDTH} ${0} L${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        stroke={GRAPH_AXIS_COLOR}
        strokeWidth={'2'}
        strokeDasharray={'4,4'}
      />
      <path
        d={`M${0} ${0} L${0} ${GRAPH_HEIGHT}`}
        stroke={GRAPH_AXIS_COLOR}
        strokeWidth={'2'}
        strokeDasharray={'4,4'}
      />
    </>
  );
};
