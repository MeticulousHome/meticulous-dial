import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  notificationSelector,
  removeOneNotification
} from '../store/features/notifications/notification-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { acknowledgeNotification } from '../../../src/api/wifi';
import './notification.css';

const SCROLL_VALUE = 50;

export function Notification(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const messageRef = useRef<HTMLDivElement>(null);
  const notifications = useSelector(notificationSelector.selectAll);
  const [currentNotification] = notifications;
  const [isScrollable, setIsScrollable] = useState(false);
  const [selectedOption, setSelectedOption] = useState(0);
  const [canSelectOption, setCanSelectOption] = useState(false);

  useEffect(() => {
    if (messageRef.current) {
      const isOverflowing =
        messageRef.current.scrollHeight > messageRef.current.clientHeight;
      setIsScrollable(isOverflowing);
      setCanSelectOption(!isOverflowing);
      messageRef.current.classList.toggle('scrollable', isOverflowing);
    }
  }, [notifications]);

  useHandleGestures(
    {
      left: () => {
        if (
          canSelectOption &&
          currentNotification.responses.length > 1 &&
          selectedOption > 0
        ) {
          setSelectedOption((prev) => prev - 1);
        } else {
          scrollMessage(true);
        }
      },
      right: () => {
        if (
          canSelectOption &&
          currentNotification.responses.length > 1 &&
          selectedOption < currentNotification.responses.length - 1
        ) {
          setSelectedOption((prev) => prev + 1);
        } else {
          scrollMessage(false);
        }
      },
      pressDown: async () => {
        if (currentNotification) {
          const { id, responses } = currentNotification;
          await acknowledgeNotification({
            id,
            response: responses[selectedOption]
          });
          dispatch(removeOneNotification(id));
        }
      }
    },
    bubbleDisplay.visible
  );

  if (!currentNotification) {
    return <></>;
  }

  const { message, image, responses } = currentNotification;

  const scrollMessage = (up: boolean) => {
    if (messageRef.current) {
      messageRef.current.scrollTop += up ? -SCROLL_VALUE : SCROLL_VALUE;

      if (
        !canSelectOption &&
        messageRef.current.scrollHeight - messageRef.current.scrollTop ===
          messageRef.current.clientHeight
      ) {
        setCanSelectOption(true);
      } else if (
        canSelectOption &&
        messageRef.current.scrollTop <
          messageRef.current.scrollHeight - messageRef.current.clientHeight
      ) {
        setCanSelectOption(false);
        setSelectedOption(0);
      }
    }
  };

  const renderOptions = () => {
    if (responses.length === 1) {
      return (
        <button className="notification-button selected">
          {responses[0] || 'OK'}
        </button>
      );
    }

    return (
      <div className="notification-options-container">
        {selectedOption > 0 && (
          <button
            className="notification-button left"
            disabled={!canSelectOption}
          >
            {responses[selectedOption - 1]}
          </button>
        )}
        <button className="notification-button center selected">
          {responses[selectedOption]}
        </button>
        {selectedOption < responses.length - 1 && (
          <button
            className="notification-button right"
            disabled={!canSelectOption}
          >
            {responses[selectedOption + 1]}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="notification-circular-container">
      <div className="notification-circular-content">
        <div
          className={`notification-message ${isScrollable ? 'scrollable' : ''}`}
          ref={messageRef}
        >
          <p>{message}</p>
          {image && (
            <div className="notification-image-container">
              <img src={image} alt="Notification image" />
            </div>
          )}
        </div>
      </div>
      <div className="notification-button-container">{renderOptions()}</div>
    </div>
  );
}
