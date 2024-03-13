import { useEffect, useMemo, useState } from 'react';
import './preheat.css';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Gauge } from '../SettingNumerical/Gauge';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { QuickSettings } from '../QuickSettings/QuickSettings';
import { roundPrecision } from '../../../src/utils';
import { updateSettings } from '../store/features/settings/settings-slice';

enum OptionType {
  yes = 'yes',
  no = 'no',
  none = ''
}

const options: OptionType[] = [OptionType.yes, OptionType.no];

const MAX_PREHEAT = 99;
const MIN_PREHEAT = 25;
const INTERVAL_PREHEAT = 1;

export function QuickPreheat() {
  const { auto_preheat } = useAppSelector((state) => state.settings);
  const [total, setTotal] = useState<number>(MIN_PREHEAT);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [optionSelected, setOptionSelected] = useState<OptionType>(
    OptionType.none
  );
  const dispatch = useAppDispatch();

  const updateValue = (gesture: 'left' | 'right') => {
    if (
      (total === MAX_PREHEAT && gesture === 'right') ||
      (total === 0 && gesture === 'left')
    ) {
      return;
    }
    const mTotal =
      total + (gesture === 'left' ? -INTERVAL_PREHEAT : +INTERVAL_PREHEAT);
    setTotal(mTotal <= MIN_PREHEAT ? MIN_PREHEAT : roundPrecision(mTotal, 1));
  };

  const updatePreheat = () => {
    dispatch(
      updateSettings({
        auto_preheat: optionSelected === OptionType.yes ? total : 0
      })
    );
  };

  useEffect(() => {
    setActiveIndex(auto_preheat === 0 ? 1 : 0);
    setTotal(auto_preheat === 0 ? MIN_PREHEAT : auto_preheat);
  }, [auto_preheat]);

  useHandleGestures({
    left() {
      if (optionSelected === OptionType.yes) {
        updateValue('left');
        return;
      }

      setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
    },
    right() {
      if (optionSelected === OptionType.yes) {
        updateValue('right');
        return;
      }
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    click() {
      const value = options[activeIndex] as OptionType;

      if (optionSelected === OptionType.yes) {
        updatePreheat();
        setOptionSelected(OptionType.none);
        dispatch(setBubbleDisplay({ visible: true, component: QuickSettings }));
        return;
      }

      if (value === OptionType.no) {
        updatePreheat();
        dispatch(setBubbleDisplay({ visible: true, component: QuickSettings }));
        return;
      }

      if (value === OptionType.yes) {
        setOptionSelected(OptionType.yes);
      }
    }
  });

  const renderOption = useMemo(() => {
    return optionSelected === OptionType.yes ? (
      <div className="g-container">
        <Gauge
          value={total}
          maxValue={MAX_PREHEAT}
          precision={1}
          unit="celcius"
        />
      </div>
    ) : (
      <MultipleOptionSlider
        activeIndex={activeIndex}
        options={options.map((word) => {
          return word[0].toUpperCase() + word.substring(1);
        })}
      />
    );
  }, [activeIndex, optionSelected, total]);

  return <div className="preheat-container">{renderOption}</div>;
}
