const dock = Object.freeze({ today: 'Hari ini', search: 'Cari', menu: 'Menu' });
const nav = Object.freeze({ previousYear: 'Tahun sebelumnya', nextYear: 'Tahun berikutnya' });
const search = Object.freeze({
  label: 'Cari catatan',
  prompt: 'Ketik untuk mencari catatan dan suasana',
  empty: 'Belum ada hari yang tercatat',
  noResults: 'Tidak ada catatan yang cocok',
});

export const UI_COPY = Object.freeze({
  loading: 'Menyelaraskan perjalanan waktu…',
  viewport: 'Grid perjalanan waktu',
  dock,
  nav,
  search,
});

export function formatYearTravel(delta, year) {
  if (Math.abs(delta) === 1) return `Menuju tahun ${year}`;
  return `${delta < 0 ? 'Mundur' : 'Maju'} ${Math.abs(delta)} tahun · ${year}`;
}
