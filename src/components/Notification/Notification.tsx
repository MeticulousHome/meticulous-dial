import './notification.css';
import { useSelector } from 'react-redux';
import {
  notificationSelector,
  removeOneNotification
} from '../store/features/notifications/notification-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch } from '../store/hooks';
import { useRef, useState } from 'react';
import { useSocket } from '../store/SocketManager';

const SCROLL_VALUE = 50;

export function Notification(): JSX.Element {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const [activeButton, setActivebutton] = useState<HTMLButtonElement | null>(
    null
  );
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const notifications = useSelector(notificationSelector.selectAll);
  const [allowScroll, setAllowScroll] = useState<boolean>(true);

  useHandleGestures(
    {
      left: () => {
        mainContainerScroll(true);
        moveBButtons(true);
      },
      right: () => {
        mainContainerScroll(false);
        moveBButtons(false);
      },
      click: () => {
        if (activeButton !== null) {
          setAllowScroll(true);
          activeButton.classList.remove('focused-button');
          setActivebutton(null);
          socket.emit(
            'notification',
            JSON.stringify({
              id,
              response: activeButton.getAttribute('data-value')
            })
          );

          mainContainerRef.current.scrollTop = 0;

          dispatch(removeOneNotification(id));
        }
      }
    },
    false
  );

  if (notifications.length === 0) {
    return <></>;
  }

  const { id, message, responses, image } = notifications[0];

  const mainContainerScroll = (up: boolean) => {
    if (!mainContainerRef.current || !allowScroll) {
      return;
    }

    mainContainerRef.current.scrollTop += up ? -SCROLL_VALUE : SCROLL_VALUE;

    if (
      mainContainerRef.current.scrollTop ===
      mainContainerRef.current.scrollHeight -
        mainContainerRef.current.offsetHeight
    ) {
      setAllowScroll(false);
    }
  };

  const myActiveButton = (id: number) => {
    if (id < 0) {
      activeButton.classList.remove('focused-button');
      mainContainerRef.current.scrollTop -= SCROLL_VALUE;
      setAllowScroll(true);
      setActivebutton(null);
      return;
    }

    let myButton: HTMLButtonElement = null;
    myButton = document.getElementById(`button-${id}`) as HTMLButtonElement;
    myButton.classList.add('focused-button');
    setActivebutton(myButton);
  };

  const moveBButtons = (left: boolean) => {
    if (allowScroll) {
      return;
    }
    if (activeButton === null) {
      myActiveButton(0);
      return;
    }

    const intKey =
      parseInt(activeButton.getAttribute('data-key')) + (left ? -1 : +1);
    if (responses.length - 1 >= intKey) {
      if (activeButton !== null) {
        activeButton.classList.remove('focused-button');
      }

      myActiveButton(intKey);
    }
  };

  return (
    <div className="main-container">
      <div className="notification-container">
        <div className="message-container">
          <div className="circle-container">
            <div className="circle" id="main-circle" ref={mainContainerRef}>
              <p>{message}</p>
              <div className="image-container">
                <img src={image} />
              </div>
              <div className="buttons">
                {responses.map((response, index) => {
                  return (
                    <button
                      id={`button-${index}`}
                      key={index}
                      data-key={index}
                      data-value={response}
                      className="response-button"
                    >
                      {response}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
