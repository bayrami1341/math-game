/* graph-data.js — داده‌ی گراف گلوگاه، فاز ۱ نسخهٔ ۷ */
window.GraphData = {
  BOTTLENECKS: [
    { id: 'G', name: 'گروه‌های برابر', label: 'SUM', blocksSector: 2, tomorrow: 'ساختن دسته روی میز. حاصل را معلم نگوید.' },
    { id: 'S', name: 'شمارش پرشی', label: 'LESS/MORE', blocksSector: 2, tomorrow: 'شمارش ۵تا۵تا تا ۵۰، و ۲تا۲تا تا ۲۰، پیش از بخش ۲.' },
    { id: 'A', name: 'آرایه', label: 'LESS', blocksSector: null, tomorrow: 'کاغذ شطرنجی. انگشت روی ردیف برود، نه روی خانه.' },
    { id: 'D', name: 'دوبرابر کردن', label: 'TRANSFER', blocksSector: null, tomorrow: 'حاصل آشنا را دو بار کنار هم بگذارد. حاصل تازه گفته نشود.' },
    { id: 'N', name: 'لنگر همسایه', label: 'TABLE', blocksSector: null, tomorrow: 'دو آرایه کنار هم. تفاوت دقیقاً یک ردیف است.' },
    { id: 'P', name: 'ارزش مکانی', label: 'SWAP', blocksSector: 3, tomorrow: 'دو حاصل دورقمی با بستهٔ ده‌تایی. بخش ۳ سؤال تازه نگیرد.' },
    { id: 'C', name: 'تعویض‌پذیری شکل', label: 'SHAPE', blocksSector: null, tomorrow: 'یک‌بار عامل‌ها برعکس نشان داده شود. شکستش روان‌بودن را نمی‌شکند.' }
  ],
  FACTS: [
    { key: '2×2', f1: 2, f2: 2, sector: 1, product: 4 },
    { key: '2×3', f1: 2, f2: 3, sector: 1, product: 6 },
    { key: '2×4', f1: 2, f2: 4, sector: 1, product: 8 },
    { key: '2×5', f1: 2, f2: 5, sector: 1, product: 10 },
    { key: '3×3', f1: 3, f2: 3, sector: 1, product: 9 },
    { key: '3×4', f1: 3, f2: 4, sector: 1, product: 12 },
    { key: '3×5', f1: 3, f2: 5, sector: 1, product: 15 },
    { key: '2×6', f1: 2, f2: 6, sector: 2, product: 12 },
    { key: '2×7', f1: 2, f2: 7, sector: 2, product: 14 },
    { key: '2×8', f1: 2, f2: 8, sector: 2, product: 16 },
    { key: '2×9', f1: 2, f2: 9, sector: 2, product: 18 },
    { key: '3×6', f1: 3, f2: 6, sector: 2, product: 18 },
    { key: '4×4', f1: 4, f2: 4, sector: 2, product: 16 },
    { key: '4×5', f1: 4, f2: 5, sector: 2, product: 20 },
    { key: '5×5', f1: 5, f2: 5, sector: 2, product: 25 },
    { key: '3×7', f1: 3, f2: 7, sector: 3, product: 21 },
    { key: '3×8', f1: 3, f2: 8, sector: 3, product: 24 },
    { key: '3×9', f1: 3, f2: 9, sector: 3, product: 27 },
    { key: '4×6', f1: 4, f2: 6, sector: 3, product: 24 },
    { key: '5×6', f1: 5, f2: 6, sector: 3, product: 30 },
    { key: '6×6', f1: 6, f2: 6, sector: 3, product: 36 },
    { key: '6×7', f1: 6, f2: 7, sector: 3, product: 42 },
    { key: '7×7', f1: 7, f2: 7, sector: 3, product: 49 }
  ],
  EDGES: [
    { from: '2×2', to: '2×4', type: 'doubling' },
    { from: '2×4', to: '4×4', type: 'doubling' },
    { from: '2×5', to: '4×5', type: 'doubling' },
    { from: '2×6', to: '4×6', type: 'doubling' },
    { from: '2×5', to: '2×6', type: 'skip-count' },
    { from: '2×6', to: '2×7', type: 'skip-count' },
    { from: '2×7', to: '2×8', type: 'skip-count' },
    { from: '2×8', to: '2×9', type: 'skip-count' },
    { from: '3×5', to: '3×6', type: 'skip-count' },
    { from: '3×6', to: '3×7', type: 'skip-count' },
    { from: '3×7', to: '3×8', type: 'skip-count' },
    { from: '3×8', to: '3×9', type: 'skip-count' },
    { from: '2×3', to: '3×3', type: 'comfort' },
    { from: '2×4', to: '3×4', type: 'comfort' },
    { from: '3×3', to: '3×4', type: 'comfort' },
    { from: '2×5', to: '3×5', type: 'comfort' },
    { from: '3×4', to: '3×5', type: 'comfort' },
    { from: '4×4', to: '4×5', type: 'comfort' },
    { from: '4×5', to: '5×5', type: 'comfort' },
    { from: '3×5', to: '3×6', type: 'comfort' },
    { from: '4×5', to: '4×6', type: 'comfort' },
    { from: '5×5', to: '5×6', type: 'comfort' },
    { from: '5×6', to: '6×6', type: 'comfort' },
    { from: '6×6', to: '6×7', type: 'comfort' },
    { from: '6×7', to: '7×7', type: 'comfort' }
  ],
  SWAP_MEANINGFUL: [
    { key: '3×4', product: 12, swapped: 21 },
    { key: '2×6', product: 12, swapped: 21 },
    { key: '2×7', product: 14, swapped: 41 },
    { key: '2×8', product: 16, swapped: 61 },
    { key: '4×4', product: 16, swapped: 61 },
    { key: '2×9', product: 18, swapped: 81 },
    { key: '3×6', product: 18, swapped: 81 },
    { key: '3×5', product: 15, swapped: 51 },
    { key: '3×7', product: 21, swapped: 12 },
    { key: '3×8', product: 24, swapped: 42 },
    { key: '4×6', product: 24, swapped: 42 },
    { key: '3×9', product: 27, swapped: 72 },
    { key: '4×5', product: 20, swapped: 2, unitsOnly: true },
    { key: '5×5', product: 25, swapped: 52 },
    { key: '6×6', product: 36, swapped: 63 },
    { key: '6×7', product: 42, swapped: 24 },
    { key: '7×7', product: 49, swapped: 94 }
  ],
  TABLE_EXAMPLES: [
    { key: '4×6', given: 20, stolenFrom: '4×5', product: 24 },
    { key: '6×7', given: 35, stolenFrom: '5×7', product: 42 },
    { key: '6×7', given: 48, stolenFrom: '6×8', product: 42 },
    { key: '3×8', given: 21, stolenFrom: '3×7', product: 24 },
    { key: '5×6', given: 25, stolenFrom: '5×5', product: 30 },
    { key: '7×7', given: 42, stolenFrom: '6×7', product: 49 }
  ],
  bottleneckById: function (id) {
    for (var i = 0; i < this.BOTTLENECKS.length; i++) {
      if (this.BOTTLENECKS[i].id === id) return this.BOTTLENECKS[i];
    }
    return null;
  },
  factByKey: function (key) {
    for (var i = 0; i < this.FACTS.length; i++) {
      if (this.FACTS[i].key === key) return this.FACTS[i];
    }
    return null;
  },
  swapOf: function (key) {
    for (var i = 0; i < this.SWAP_MEANINGFUL.length; i++) {
      if (this.SWAP_MEANINGFUL[i].key === key) return this.SWAP_MEANINGFUL[i];
    }
    return null;
  }
};
console.log('✅ GraphData بارگذاری شد. تعداد ضرب:', window.GraphData.FACTS.length);
