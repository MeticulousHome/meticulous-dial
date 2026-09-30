export const createStartBrewGestureHandlers = (
  heatingFinished: boolean,
  optionSelected: string,
  onStart: () => void
) => {
  const startBrewOnPress = () => {
    if (
      heatingFinished &&
      ['push_to_brew', 'brew_now'].includes(optionSelected)
    ) {
      onStart();
    }
  };

  return {
    click: startBrewOnPress,
    longEncoder: startBrewOnPress
  };
};
