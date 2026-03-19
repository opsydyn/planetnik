document.addEventListener('DOMContentLoaded', () => {
  type Theme = 'light' | 'dark' | 'system';
  type ButtonId = 'theme-light' | 'theme-dark' | 'theme-machine';

  const THEME_LIGHT: Theme = 'light';
  const THEME_DARK: Theme = 'dark';
  const THEME_SYSTEM: Theme = 'system';
  const PREFER_SCHEME_DARK = '(prefers-color-scheme: dark)';
  const DATA_THEME = 'data-theme';
  const DATA_THEME_PREFERENCE = 'data-theme-preference';
  const STORAGE_KEY = 'planetnik-theme-preference';
  const ACTIVE_CLASS = 'active';

  const buttons = new Map<ButtonId, Theme>([
    ['theme-light', THEME_LIGHT],
    ['theme-dark', THEME_DARK],
    ['theme-machine', THEME_SYSTEM],
  ]);

  const getSystemPreferTheme = () =>
    window.matchMedia(PREFER_SCHEME_DARK).matches ? THEME_DARK : THEME_LIGHT;
  const isTheme = (value: string | null): value is Theme =>
    value === THEME_LIGHT || value === THEME_DARK || value === THEME_SYSTEM;
  const getStoredTheme = (): Theme => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : THEME_SYSTEM;
  };
  const storeTheme = (theme: Theme) => localStorage.setItem(STORAGE_KEY, theme);

  const applyTheme = (theme: Theme) => {
    const effectiveTheme =
      theme === THEME_SYSTEM ? getSystemPreferTheme() : theme;
    document.firstElementChild?.setAttribute(DATA_THEME, effectiveTheme);
    document.firstElementChild?.setAttribute(DATA_THEME_PREFERENCE, theme);
    document.documentElement.style.colorScheme = effectiveTheme;
    updateActiveButton(theme);
  };

  const setPreference = (theme: Theme) => () => {
    storeTheme(theme);
    applyTheme(theme);
  };

  const initTheme = () => applyTheme(getStoredTheme());
  const applyStoredOrMachineTheme = () => applyTheme(getStoredTheme());

  const addThemeChangeListener = () => {
    window
      .matchMedia(PREFER_SCHEME_DARK)
      .addEventListener('change', applyStoredOrMachineTheme);
  };

  const updateActiveButton = (activeTheme: Theme) => {
    const isSystemActive = activeTheme === THEME_SYSTEM;

    buttons.forEach((theme, id) => {
      document
        .getElementById(id)
        ?.querySelector('svg')
        ?.classList.toggle(ACTIVE_CLASS, isSystemActive ? theme === THEME_SYSTEM : theme === activeTheme);
    });
  };

  const attachButtonListeners = () => {
    for (const [id, theme] of buttons.entries()) {
      document
        .getElementById(id)
        ?.addEventListener('click', setPreference(theme));
    }
  };

  initTheme();
  attachButtonListeners();
  addThemeChangeListener();

  document.addEventListener('astro:after-swap', () => {
    applyTheme(getStoredTheme());
    attachButtonListeners();
  });
});
