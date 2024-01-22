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

const SCROLL_VALUE = 20;

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
      activeButton.blur();
      mainContainerRef.current.scrollTop -= SCROLL_VALUE;
      setAllowScroll(true);
      setActivebutton(null);
      return;
    }

    let myButton: HTMLButtonElement = null;
    myButton = document.getElementById(`button-${id}`) as HTMLButtonElement;
    myButton.focus();
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
                      onClick={() => {
                        socket.emit(
                          'notification',
                          JSON.stringify({ id, response })
                        );

                        dispatch(removeOneNotification(id));
                      }}
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
