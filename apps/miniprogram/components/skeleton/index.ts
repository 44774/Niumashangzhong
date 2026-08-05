Component({
  properties: {
    variant: {
      type: String,
      value: "cards",
    },
    cards: {
      type: Number,
      value: 3,
    },
    rows: {
      type: Number,
      value: 3,
    },
  },

  data: {
    gridCells: Array.from({ length: 42 }, (_, index) => index),
  },
});
