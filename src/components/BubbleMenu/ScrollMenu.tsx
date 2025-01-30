import {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState
} from 'react';
import { MenuOption } from './MenuOptions';
import { scroller, Element } from 'react-scroll';
import { MenuText, TEXT_ENTRY_HEIGHT } from './MenuTextEntry';
import { MenuAnnotation } from './MenuAnnotation';
import { MenuSeperator } from './MenuSeperator';
import { MainMenuContainer, MainMenuView, MenuEntry } from './MenuContainer';

const isVisible = (entry: MenuOption) =>
  entry.visible
    ? typeof entry.visible === 'function'
      ? entry.visible()
      : entry.visible
    : true;
const getLabel = (entry: MenuOption) =>
  entry.label
    ? typeof entry.label === 'function'
      ? entry.label()
      : entry.label
    : '';

const SCROLL_CONTAINER_ID = 'settings-scroll-container';

const isSelectable = (entry: MenuOption) => {
  switch (entry.type) {
    case 'seperator':
    case 'disabled':
    case 'image':
      return false;
    default:
      return isVisible(entry);
  }
};

export const ScrollMenu = forwardRef(function ScrollMenu(
  { settings }: { settings: MenuOption[] },
  ref: Ref<{
    handleLeft: () => void;
    handleRight: () => void;
    handleDown: () => void;
    handleUp: () => void;
  }>
) {
  const holdTimeout = useState(null);
  const [activeIndex, setActiveIndex] = useState(() => {
    const selectables = settings
      .map((val: MenuOption, index: number) => ({ ...val, index }))
      .filter((entry) => isSelectable(entry));
    if (selectables.length) {
      return selectables[0].index;
    }
    return -1;
  });

  const scrollToIndex = (index: number, smooth = true) => {
    if (index < 0 || index >= settings.length) {
      return;
    }
    scroller.scrollTo(`option-${index}`, {
      duration: 260,
      delay: 0,
      smooth: smooth,
      offset: -240 + TEXT_ENTRY_HEIGHT / 2,
      containerId: SCROLL_CONTAINER_ID
    });
  };

  const handleLeft = () => {
    setActiveIndex((prev) => {
      const selectables = settings
        .map((val, index) => ({ ...val, index }))
        .filter((entry, index) => index < prev && isSelectable(entry));

      if (selectables.length) {
        scrollToIndex(selectables[selectables.length - 1].index);
        return selectables[selectables.length - 1].index;
      }
      return prev;
    });
  };
  const handleRight = () => {
    setActiveIndex((prev) => {
      const selectables = settings
        .map((val, index) => ({ ...val, index }))
        .filter((entry, index) => index > prev && isSelectable(entry));

      if (selectables.length) {
        scrollToIndex(selectables[0].index);
        return selectables[0].index;
      }
      return prev;
    });
  };

  const handleDown = useCallback(() => {
    const activeEntry = settings[activeIndex];
    const isHold = activeEntry.type === 'hold';

    if (isHold) {
    } else {
      if (activeEntry.onSelected) {
        activeEntry.onSelected();
      }
    }
  }, [activeIndex, settings]);

  const handleUp = useCallback(() => {}, [activeIndex, settings]);

  useImperativeHandle(ref, () => ({
    handleLeft,
    handleRight,
    handleDown,
    handleUp
  }));

  useEffect(() => {
    scrollToIndex(activeIndex, false);
  }, []);

  return (
    <MainMenuContainer id={SCROLL_CONTAINER_ID}>
      <MainMenuView>
        {settings.map((entry, index) => {
          if (!isVisible(entry)) {
            return <></>;
          }
          const isActive = index === activeIndex;
          const isHold = entry.type === 'hold';
          switch (entry.type) {
            case 'seperator':
              return (
                <MenuSeperator
                  key={`option-${index}`}
                  name={`option-${index}`}
                  id={`option-${index}`}
                />
              );
            case 'image':
              return (
                <Element name={`option-${index}`} key={`option-${index}`}>
                  <img
                    key={`option-${index}`}
                    id={`option-${index}`}
                    src={entry.image}
                    style={{ height: entry.height - 25 }}
                    alt="entry"
                  />
                </Element>
              );
            default:
              return (
                <MenuEntry>
                  <MenuText
                    type={entry.type}
                    selected={isActive}
                    selectable={isSelectable(entry)}
                    holding={isHold && isActive}
                    key={`option-${index}`}
                    name={`option-${index}`}
                    id={`option-${index}`}
                    onAnimationEnd={() => {
                      console.log('animation end');
                    }}
                  >
                    <span style={{ paddingTop: 3 }}>{getLabel(entry)}</span>
                    {isHold && isActive && (
                      <MenuAnnotation>hold</MenuAnnotation>
                    )}
                  </MenuText>
                </MenuEntry>
              );
          }
        })}
      </MainMenuView>
    </MainMenuContainer>
  );
});
