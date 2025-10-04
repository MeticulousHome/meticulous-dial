import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import Styled from '../../../styles/utils/mixins';
import { styled } from 'styled-components';

const NUMLINES = 10;

const VerticalLine = styled.div`
  margin-left: 4.5%;
  margin-right: 4.5%;
  width: 1%;
  background-color: white;
  height: 100%;
`;

export const DisplayAlignment = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  useHandleGestures(
    {
      pressDown() {
        dispatch(setScreen(screen.prev || 'profileHome'));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'advancedSettings' })
        );
      }
    },
    bubbleDisplay.interceptsGesture
  );

  return (
    <Styled.SettingsContainer>
      {Array.from({ length: NUMLINES }).map((_, i) => (
        <VerticalLine key={i} />
      ))}
    </Styled.SettingsContainer>
  );
};
