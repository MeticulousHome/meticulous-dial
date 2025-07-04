import classNames from 'classnames';
import { styled } from 'styled-components';

import { forwardRef, CSSProperties, useRef } from 'react';
import { Transition } from 'react-transition-group';

import './transitions.less';

export const PROFILE_ENTRY_SIZE = 178;

const TitleContainer = styled.div`
  position: absolute;
  z-index: 10;
  top: -68px;
  width: 150%;
  height: 60px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;

  transition:
    top 300ms ease-in-out,
    opacity 300ms ease;
`;

const PressetTitleTop = styled.div`
  max-height: 100%;
  max-width: 100%;
  font-size: 30px !important;
  font-weight: 400;
  color: #e0dcd0;
  letter-spacing: -0.025em;
  text-align: center;
  text-overflow: ellipsis;
  padding-left: 5px;
  padding-right: 5px;

  white-space: normal;

  /* Allow breaking only if it doesn't fit any other way */
  word-break: auto-phrase;
  overflow-wrap: anywhere;

  &.presset-title-small {
    font-size: 20px !important;
  }

  &.presset-title-very-small {
    font-size: 17px !important;
  }
`;

const OuterContainer = styled.div`
    position: relative;
    flex-shrink: 0;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    opacity: 0.3;

    transition: transform 300ms ease, opacity 300ms ease;

    &.active {
        opacity: 1;
    }
};
`;

const InnerContainer = styled.div`
  flex-shrink: 0;
  border-radius: 3.018px;
  height: ${PROFILE_ENTRY_SIZE}px;
  width: ${PROFILE_ENTRY_SIZE}px;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 3.018px;
  height: ${PROFILE_ENTRY_SIZE}px;
  width: ${PROFILE_ENTRY_SIZE}px;
`;

interface ProfileEntryProps {
  title: string;
  containerStyle?: CSSProperties;
  contentClassNames?: string;
  distanceToActive: number;
  zoomedIn: boolean;
  children: React.ReactNode;
}
export const ProfileEntry = forwardRef<HTMLDivElement, ProfileEntryProps>(
  (
    {
      title,
      containerStyle,
      contentClassNames,
      distanceToActive,
      zoomedIn,
      children
    },
    ref
  ) => {
    const titleRef = useRef(null);
    const contentRef = useRef(null);

    const positionClasses =
      distanceToActive === 0
        ? 'active'
        : distanceToActive > 0
          ? 'rightOf'
          : 'leftOf';

    return (
      <div ref={ref}>
        <Transition in={zoomedIn} timeout={0} nodeRef={contentRef}>
          {(state) => (
            <OuterContainer
              ref={contentRef}
              className={`
                ${positionClasses}
                ${contentClassNames || ''}
                ${state === 'entering' ? 'zoom-enter' : ''}
                ${state === 'entered' ? 'zoom-enter-active' : ''}
                ${state === 'exiting' ? 'zoom-exit' : ''}
                ${state === 'exited' ? 'zoom-exit-done' : ''}
              `}
            >
              <Transition
                in={!(zoomedIn && distanceToActive === 0)}
                timeout={400}
                nodeRef={titleRef}
              >
                {(titleState) => (
                  <TitleContainer
                    ref={titleRef}
                    className={`
                      ${titleState === 'entering' ? 'title-enter-active' : ''}
                      ${titleState === 'entered' ? 'title-enter-active' : ''}
                      ${titleState === 'exiting' ? 'title-exit-done' : ''}
                      ${titleState === 'exited' ? 'title-exit-done' : ''}
                    `}
                  >
                    <PressetTitleTop
                      className={classNames({
                        'presset-title-small': title.length > 30,
                        'presset-title-very-small': title.length > 40
                      })}
                    >
                      {title.length > 70
                        ? `${title.substring(0, 70)}...`
                        : title}
                    </PressetTitleTop>
                  </TitleContainer>
                )}
              </Transition>

              <InnerContainer style={containerStyle}>{children}</InnerContainer>
            </OuterContainer>
          )}
        </Transition>
      </div>
    );
  }
);
