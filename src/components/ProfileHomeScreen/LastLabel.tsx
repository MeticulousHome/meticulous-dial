import React from 'react';
import { styled } from 'styled-components';
import { ClockIcon } from './ClockIcon';

const Wrapper = styled.div`
  position: absolute;
  bottom: -16px;
  right: 0;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Label = styled.span`
  font-size: 12px;
  color: rgb(224, 220, 208);
`;

export const LastLabel: React.FC = () => (
  <Wrapper>
    <Label>Last</Label>
    <ClockIcon />
  </Wrapper>
);
