import { styled } from 'styled-components';
import { Element } from 'react-scroll';

export const MainMenuContainer = styled.div`
  display: flex;
  height: 480px;
  width: 100%;
  background-color: #1d1d1d;
  overflow: hidden;
`;

export const MainMenuView = styled.div`
  display: flex;
  align-items: center;
  height: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
  padding-left: 29px;
  padding-top: 80%;
  padding-bottom: 80%;
  gap: 10px;
`;

export const MenuEntry = styled(Element)`
  width: 100%;
`;
