import './loadingScreen.css';

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="loading-center">
      <div className="loader" />
      {message ? <div className="loading-message">{message}</div> : null}
    </div>
  );
}
