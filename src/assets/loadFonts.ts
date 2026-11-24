/** Load subsetted OFL WOFF2 fonts with Vite BASE_URL support before rendering map labels. */
export async function loadMeridianFonts(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const specs: Array<{ family: string; file: string; weight: string }> = [
    { family: 'MeridianWenKai', file: 'assets/fonts/lxgw-wenkai-subset.woff2', weight: '400 700' },
    { family: 'MeridianSans', file: 'assets/fonts/noto-sans-sc-subset.woff2', weight: '400 700' },
    { family: 'MeridianMono', file: 'assets/fonts/jetbrains-mono-subset.woff2', weight: '400 700' },
    { family: 'MeridianCinzel', file: 'assets/fonts/cinzel-subset.woff2', weight: '400 700' },
  ];

  await Promise.all(
    specs.map(async (s) => {
      try {
        const face = new FontFace(s.family, `url("${base}${s.file}") format("woff2")`, {
          weight: s.weight,
          style: 'normal',
          display: 'swap',
        });
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch (err) {
        console.warn(`[fonts] fallback for ${s.family}:`, err);
      }
    }),
  );
  await document.fonts.ready;
}
