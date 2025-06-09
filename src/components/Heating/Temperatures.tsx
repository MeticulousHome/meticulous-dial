import { styled } from 'styled-components';
import { AnimatedCounter } from 'react-animated-counter';

const TEMP_COLOR = '#e7e7e7';
const SMALL_FONT_SIZE = 25;
const LARGE_FONT_SIZE = 60;

const TemperatureValue = styled.span<{ $small?: boolean }>`
  font-family: 'ABC Diatype Mono';
  font-size: ${(props) => (props.$small ? SMALL_FONT_SIZE : LARGE_FONT_SIZE)}px;
  font-weight: ${(props) => (props.$small ? 200 : 300)};
  letter-spacing: -0.02em;
  line-height: 1;
  color: ${TEMP_COLOR};
`;

const Unit = styled.sup<{ $small?: boolean }>`
  font-family: 'ABC Diatype';
  font-size: ${(props) => (props.$small ? 19 : 25)}px;
  font-weight: ${(props) => (props.$small ? 200 : 400)};
  letter-spacing: -0.01em;
  color: #e7e7e799;
  line-height: ${(props) => (props.$small ? 1 : 1.2)};
`;

export const Label = styled.div`
  font-family: 'ABC Diatype';
  font-size: 15px;
  font-weight: 300;
  line-height: 1;
  color: #e7e7e799;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

export const Temperature: React.FC<{
  value: number;
  small?: boolean;
  animated?: boolean;
}> = ({ value, small, animated }) => (
  <div
    style={{ display: 'flex', alignItems: 'flex-start', gap: small ? 4 : 5 }}
  >
    <TemperatureValue $small={small}>
      {animated ? (
        <AnimatedCounter
          value={value}
          color={TEMP_COLOR}
          decrementColor={TEMP_COLOR}
          incrementColor={TEMP_COLOR}
          includeDecimals={false}
          fontSize={`${small ? SMALL_FONT_SIZE : LARGE_FONT_SIZE}px`}
        />
      ) : (
        value
      )}
    </TemperatureValue>

    <Unit $small={small}>°C</Unit>
  </div>
);

export const Temperatures: React.FC<{ current: number; target: number }> = ({
  current,
  target
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      marginLeft: 15,
      marginRight: 10,
      justifyContent: 'space-between'
    }}
  >
    <Temperature value={current} animated />
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: 4,
        paddingBottom: 7
      }}
    >
      <Label>Target</Label>
      <Temperature value={target} small />
    </div>
  </div>
);
