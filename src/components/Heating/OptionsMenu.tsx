import {
  useEffect,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle
} from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { styled } from 'styled-components';
import { useSettings } from '../../hooks/useSettings';

const OPTION_HEIGHT = 38;

const MenuContainer = styled.div<{ $num_options: number }>`
  display: flex;
  flex-direction: column;
  height: ${({ $num_options }) => $num_options * OPTION_HEIGHT}px;
  overflow: hidden;
  margin-bottom: 20px;

  &.fade-options-enter {
    opacity: 0;
    height: 0;
    margin-bottom: 0px;
    margin-top: -20px;
  }
  &.fade-options-exit {
    opacity: 1;
    height: ${({ $num_options }) => $num_options * OPTION_HEIGHT}px;
    margin-top: 0;
    margin-bottom: 20px;
  }
  &.fade-options-enter-active {
    opacity: 1;
    height: ${({ $num_options }) => $num_options * OPTION_HEIGHT}px;
    margin-top: 0;
    margin-bottom: 20px;
  }
  &.fade-options-exit-active {
    opacity: 0;
    height: 0;
    margin-top: -20px;
    margin-bottom: 0px;
  }
  &.fade-options-enter-active,
  &.fade-options-exit-active {
    transition: all 600ms;
    overflow: hidden;
  }
`;

const MenuEntry = styled.div<{ $active?: boolean }>`
  min-width: 250px;
  height: ${OPTION_HEIGHT}px;
  flex-shrink: 0;
  border-radius: 4px;
  background: ${({ $active }) => ($active ? '#F5C444' : 'transparent')};
  color: ${({ $active }) => ($active ? '#000000' : '#FFFFFF')};

  line-height: 1;
  letter-spacing: 0;
  padding-left: 20px;
  font-family: 'ABC Diatype';
  font-size: 20px;
  font-style: normal;
  font-weight: 300;
  line-height: 200%;
  letter-spacing: 4px;
  text-transform: uppercase;
`;

export const OptionsMenu = forwardRef(
  (
    { ignoreGestures }: { ignoreGestures: boolean },
    ref: React.Ref<{ autostart: boolean }>
  ) => {
    const { data: globalSettings } = useSettings();

    const [activeIndex, setActiveIndex] = useState(0);
    const [autostart, setAutostart] = useState(false);

    const OPTIONS = useMemo(
      () => [
        {
          key: 'auto_start',
          label: 'Auto brew'
        },
        {
          key: 'push_to_brew',
          label: 'Push to brew'
        }
      ],
      []
    );

    useEffect(() => {
      if (!globalSettings) {
        return;
      }
      if (globalSettings.auto_start_shot) {
        setActiveIndex(0);
        setAutostart(true);
      } else {
        setActiveIndex(1);
        setAutostart(false);
      }
    }, [globalSettings?.auto_start_shot]);

    useEffect(() => {
      const activeItem = OPTIONS[activeIndex].key;
      if (activeItem === 'auto_start') {
        setAutostart(true);
      } else if (activeItem === 'push_to_brew') {
        setAutostart(false);
      }
    }, [activeIndex]);

    useHandleGestures(
      {
        left: () => {
          setActiveIndex((prev) => Math.max(prev - 1, 0));
        },
        right: () => {
          setActiveIndex((prev) => Math.min(prev + 1, OPTIONS.length - 1));
        }
      },
      ignoreGestures
    );

    useImperativeHandle(ref, () => ({
      autostart
    }));

    return (
      <MenuContainer $num_options={OPTIONS.length}>
        {OPTIONS.map((option, index) => (
          <MenuEntry key={index} $active={index === activeIndex}>
            {option.label}
          </MenuEntry>
        ))}
      </MenuContainer>
    );
  }
);
