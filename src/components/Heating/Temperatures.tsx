import { styled } from 'styled-components';

const TemperatureValue = styled.span<{ $small?: boolean }>`
  font-family: 'ABC Diatype Mono';
  font-size: ${(props) => (props.$small ? 25 : 60)}px;
  font-weight: ${(props) => (props.$small ? 200 : 300)};
  letter-spacing: -0.02em;
  line-height: 1;
  color: #e7e7e7;
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

export const Temperature: React.FC<{ number: number; small?: boolean }> = ({
  number,
  small
}) => (
  <div
    style={{ display: 'flex', alignItems: 'flex-start', gap: small ? 4 : 5 }}
  >
    <TemperatureValue $small={small}>{number}</TemperatureValue>

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
    <Temperature number={current} />
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
      <Temperature number={target} small />
    </div>
  </div>
);
