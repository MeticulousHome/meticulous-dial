import { useEffect, useMemo, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { css, keyframes, styled } from 'styled-components';
import { useSettings } from '../../hooks/useSettings';
import { holdAnimationState } from '../QuickSettings/QuickSettings';

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

const BackgroundAnimation = keyframes`
  0% {
    background-position: 100% 100%;
    color: #FFFFFF;
  }
  100% {
    background-position: 0% 100%;
    color: #000000;
  }
`;

const MenuEntry = styled.div<{
  $active?: boolean;
  $holdAnimation?: string;
}>`
  min-width: 220px;
  height: ${OPTION_HEIGHT}px;
  flex-shrink: 0;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    #f5c444 0%,
    #f5c444 50%,
    transparent 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  background-position: ${({ $active, $holdAnimation }) => ($active && $holdAnimation == null ? '0% 100%' : '100% 100%')};
  color: ${({ $active, $holdAnimation }) => ($active && $holdAnimation == null ? '#000000' : '#FFFFFF')};

  line-height: 1;
  letter-spacing: 0;
  padding-left: 20px;$holdAnimation
  font-family: 'ABC Diatype';
  font-size: 20px;
  font-style: normal;
  font-weight: 300;
  line-height: 200%;
  letter-spacing: 4px;
  text-transform: uppercase;
  animation: ${({ $active, $holdAnimation }) =>
    $active && $holdAnimation == 'running'
      ? css`
          ${BackgroundAnimation} 2s linear normal
        `
      : 'none'};
`;

export const OptionsMenu = ({
  ignoreGestures,
  onOptionChange,
  onOptionHold
}: {
  ignoreGestures: boolean;
  onOptionChange: (option_key: string) => void;
  onOptionHold: (option_key: string) => void;
}) => {
  const { data: globalSettings } = useSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [holdAnimation, setHoldAnimation] =
    useState<holdAnimationState>('stopped');

  const OPTIONS = useMemo(
    () => [
      {
        key: 'auto_start',
        label: 'Auto brew'
      },
      {
        key: 'push_to_brew',
        label: 'Push to brew'
      },
      {
        key: 'brew_now',
        label: 'Brew now',
        auto_activate: true
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
    } else {
      setActiveIndex(1);
    }
  }, [globalSettings?.auto_start_shot]);

  useEffect(() => {
    const activeItem = OPTIONS[activeIndex].key;
    onOptionChange(activeItem);
    if (OPTIONS[activeIndex].auto_activate) {
      setHoldAnimation('running');
    } else {
      setHoldAnimation('stopped');
    }
  }, [activeIndex, OPTIONS, onOptionChange]);

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

  const handleAnimationEnd = () => {
    setHoldAnimation('finished');
    onOptionHold(OPTIONS[activeIndex].key);
  };

  return (
    <MenuContainer $num_options={OPTIONS.length}>
      {OPTIONS.map((option, index) => (
        <MenuEntry
          key={index}
          $active={index === activeIndex}
          $holdAnimation={option.auto_activate ? holdAnimation : null}
          onAnimationEnd={handleAnimationEnd}
        >
          {option.label}
        </MenuEntry>
      ))}
    </MenuContainer>
  );
};
