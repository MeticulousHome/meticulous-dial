import { useAppSelector } from '../store/hooks';

export const PressetTitle = () => {
  const { screen } = useAppSelector((state) => state);

  return (
    <div
      className={`title-main-1 ${
        screen.value !== 'pressets' ? 'bottom__fadeOut' : ''
      }`}
    >
      pressets
    </div>
  );
};
