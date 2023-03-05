import Swiper from 'swiper';

export const handleRemovePresetsAnimation = (swiper: Swiper) => {
  if (swiper && swiper.slides)
    swiper.slides.forEach((slide) => {
      slide
        .querySelector('div')
        .classList.remove('animation-bounce-left', 'animation-bounce-right');
    });
};

export const handleAddPresetAnimation = (swiper: Swiper) => {
  const { previousIndex, activeIndex, slides } = swiper;

  const animation = activeIndex > previousIndex ? 'left' : 'right';
  console.log('active', activeIndex);
  swiper.slides[activeIndex]
    .querySelector('div')
    .classList.add(`animation-bounce-${animation}`);

  if (slides.length < 2) return;
  if (activeIndex === 0 || activeIndex === slides.length - 1) {
    slides[previousIndex]
      .querySelector('div')
      .classList.add(`animation-bounce-${animation}`);
  } else {
    slides[previousIndex]
      .querySelector('div')
      .classList.add(`animation-bounce-${animation}`);

    slides[activeIndex > previousIndex ? activeIndex + 1 : activeIndex - 1]
      .querySelector('div')
      .classList.add(`animation-bounce-${animation}`);
  }
};
