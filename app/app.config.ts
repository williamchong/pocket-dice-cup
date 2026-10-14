export default defineAppConfig({
  ui: {
    // Every button is a pill in cream on the felt, translucent unless solid.
    // The translucent ones are glass: they blur the dice behind them and
    // catch the light along their top edge.
    button: {
      slots: {
        base: 'rounded-full font-normal justify-center disabled:opacity-35',
      },
      defaultVariants: { color: 'neutral', variant: 'soft', size: 'xl' },
      compoundVariants: [
        // The line height is set here, not in `base`, as each size's text
        // class would override it there.
        { square: false, class: 'px-4 leading-tight' },
        {
          color: 'neutral',
          variant: 'soft',
          class: 'text-inherit bg-cream/15 hover:bg-cream/25 active:bg-cream/30 aria-pressed:bg-cream/30 disabled:bg-cream/15 bg-linear-to-b from-white/15 to-transparent backdrop-blur-md backdrop-saturate-150 inset-shadow-2xs inset-shadow-white/40 shadow-lg shadow-black/25',
        },
        {
          color: 'neutral',
          variant: 'solid',
          class: 'text-felt bg-cream hover:bg-cream/90 active:bg-cream/90 disabled:bg-cream font-semibold',
        },
      ],
    },
  },
})
