import { HistoryDataPoint } from '@meticulous-home/espresso-api';
import { DataTypeKey, dataTypes } from '../../types/dataTypes';

export const getYPosition = (
  value: number,
  type: DataTypeKey,
  height: number
) => {
  const { minValue, maxValue } = dataTypes[type];
  return (
    height *
    (1 -
      (Math.min(maxValue, Math.max(minValue, value)) - minValue) /
        (maxValue - minValue))
  );
};

export const getGraphPath = (
  dataPoints: HistoryDataPoint[],
  key: DataTypeKey,
  width: number,
  height: number
) => {
  if (dataPoints.length === 0) {
    return '';
  }

  const first = dataPoints[0];
  const last = dataPoints[dataPoints.length - 1];
  const startTime = first.time;
  const endTime = last.time;
  const points: [number, number][] = dataPoints.map((data) => [
    (data.time - startTime) * (width / (endTime - startTime)),
    getYPosition(data.shot[key], key, height)
  ]);
  const startIndex = Math.max(0, points.findIndex(([x]) => x >= 0) - 1);
  const activePoints = points.slice(startIndex);
  const strokePath = `M${activePoints.map(([x, y]) => `${x} ${y}`).join(' L')}`;
  const maskPath = `${strokePath} L${
    activePoints[activePoints.length - 1][0]
  } ${height} L0 ${height} Z`;
  return [strokePath, maskPath];
};
