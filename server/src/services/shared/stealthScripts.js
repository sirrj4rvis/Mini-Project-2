/**
 * Stealth Init Scripts
 * 
 * A collection of browser-context initialization scripts that patch
 * JavaScript properties commonly used by anti-bot systems to detect
 * headless/automated Playwright browsers.
 *
 * These scripts are injected via context.addInitScript() BEFORE any
 * page navigation occurs, so they run before the site's own JS.
 *
 * Sources: Based on published bot-detection research from:
 *  - Sannysoft headless detection tests
 *  - CreepJS fingerprinting project
 *  - Cloudflare Bot Management public disclosures
 */

const STEALTH_SCRIPTS = {
  /**
   * Hides the `navigator.webdriver` property.
   * This is the most fundamental check — every major WAF uses it.
   * Playwright sets this to `true` by default in headless mode.
   */
  webdriver: `
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  `,

  /**
   * Fakes a realistic plugin array.
   * Real Chrome browsers always have 3–7 built-in plugins (PDF viewer, etc.).
   * Headless Chromium has 0 plugins — this is a strong bot signal.
   */
  plugins: `
    const pluginData = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', version: '1' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', version: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', version: '' }
    ];

    const pluginArr = pluginData.map(p => {
      const plugin = { name: p.name, filename: p.filename, description: p.description, version: p.version, length: 1 };
      plugin[0] = { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' };
      return plugin;
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [...pluginArr];
        Object.setPrototypeOf(arr, PluginArray.prototype);
        return arr;
      },
      configurable: true
    });
  `,

  /**
   * Fakes the mimeTypes array to match what real Chrome reports.
   * Sites cross-validate plugins vs mimeTypes to verify plugin authenticity.
   */
  mimeTypes: `
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => {
        const arr = [
          { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: {} },
          { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: {} }
        ];
        Object.setPrototypeOf(arr, MimeTypeArray.prototype);
        return arr;
      },
      configurable: true
    });
  `,

  /**
   * Sets the languages array to match the Indian English locale.
   * Must be consistent with the browser context locale option.
   */
  languages: `
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-IN', 'en-US', 'en'],
      configurable: true
    });
  `,

  /**
   * Injects the window.chrome object.
   * window.chrome is present in real Chrome but completely absent in headless Chromium.
   * Its absence is a primary fingerprinting signal on Myntra, Flipkart, and many others.
   */
  chromeObject: `
    window.chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
      },
      runtime: {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', GC_REQUIRED: 'gc_required', OS_UPDATE: 'os_update' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
      },
      loadTimes: () => ({}),
      csi: () => ({})
    };
  `,

  /**
   * Fixes the Notification permissions API.
   * Anti-bot scripts query notification permissions to test if the browser responds
   * correctly. Headless Chrome often fails this check.
   */
  permissions: `
    const _origPermissionsQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (params) => {
      if (params.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission, onchange: null });
      }
      return _origPermissionsQuery(params);
    };
  `,

  /**
   * Fixes the screen dimensions to match declared viewport.
   * Headless Chrome often reports screen.width/height as 0 or screen resolution
   * as 800x600, which doesn't match the viewport we set.
   */
  screenDimensions: `
    Object.defineProperty(screen, 'width', { get: () => 1366, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => 768, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => 1366, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 728, configurable: true });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
    Object.defineProperty(window, 'innerWidth', { get: () => 1366, configurable: true });
    Object.defineProperty(window, 'innerHeight', { get: () => 768, configurable: true });
  `,

  /**
   * Fixes WebGL vendor/renderer strings.
   * Headless Chrome reports "Google SwiftShader" as the renderer, which is a well-known
   * headless signal. We spoof it to report a common GPU instead.
   */
  webGL: `
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) return 'Intel Inc.';
      // UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
  `
};

/**
 * Returns all stealth scripts concatenated into a single string
 * for injection via context.addInitScript().
 */
function getAllStealthScripts() {
  return Object.values(STEALTH_SCRIPTS).join('\n\n');
}

module.exports = { STEALTH_SCRIPTS, getAllStealthScripts };
