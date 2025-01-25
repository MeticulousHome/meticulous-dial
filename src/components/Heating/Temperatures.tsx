import { styled } from 'styled-components';

const TemperatureValue = styled.span<{ fontSize: string; color?: string }>`
  font-size: ${(props) => props.fontSize};
  font-family: 'ABC Diatype Mono';
  font-weight: 300;
  letter-spacing: ${(props) => (props.fontSize === '60px' ? '4px' : '3px')};
  color: ${(props) => props.color || '#E7E7E7'};
  margin-right: ${(props) => (props.fontSize === '25px' ? '2px' : '0')};
`;

const Superscript = styled.sup<{ fontSize: string }>`
  font-size: ${(props) => props.fontSize};
  color: #e7e7e799;
  font-family: 'ABC Diatype';
  font-weight: 300;
`;

const Label = styled.span`
  font-size: 15px;
  color: #e7e7e799;
  font-family: 'ABC Diatype';
  font-weight: 300;
  letter-spacing: 3px;
  margin-bottom: 4px;
`;

export const CurrentTemperature: React.FC<{ number: number }> = ({
  number
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
    <TemperatureValue fontSize="60px">{number}</TemperatureValue>
    <div style={{ paddingTop: '2px' }}>
      <Superscript fontSize="25px">c</Superscript>
      <Superscript fontSize="25px">°</Superscript>
    </div>
  </div>
);

export const TargetTemperature: React.FC<{ number: number }> = ({ number }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingTop: 4,
      paddingBottom: 6
    }}
  >
    <Label>TARGET</Label>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <TemperatureValue fontSize="25px">{number}</TemperatureValue>
      <div style={{ paddingTop: '-2px', paddingLeft: '2px' }}>
        <Superscript fontSize="19px">c</Superscript>
        <Superscript fontSize="19px">°</Superscript>
      </div>
    </div>
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
      width: '90%',
      marginRight: '10%',
      justifyContent: 'space-between'
    }}
  >
    <CurrentTemperature number={current} />
    <TargetTemperature number={target} />
  </div>
);
