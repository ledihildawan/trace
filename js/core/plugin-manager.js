// TRACE Plugin Manager
// Hot-reload capable plugin system

export class PluginManager {
  constructor(engine) {
    this.engine = engine;
    this.plugins = new Map();
    this.hotReloadEnabled = false;
    this.pluginModules = new Map();
  }

  /**
   * Register a plugin
   * @param {string} name - Plugin name
   * @param {Object} plugin - Plugin instance
   */
  register(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`[PluginManager] Plugin "${name}" already registered. Replacing...`);
      this.unregister(name);
    }

    this.plugins.set(name, plugin);

    try {
      plugin.init(this.engine);
      console.log(`[PluginManager] Plugin "${name}" initialized`);
    } catch (error) {
      console.error(`[PluginManager] Failed to initialize plugin "${name}":`, error);
      this.plugins.delete(name);
      throw error;
    }
  }

  /**
   * Unregister a plugin
   * @param {string} name - Plugin name
   */
  unregister(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.warn(`[PluginManager] Plugin "${name}" not found`);
      return;
    }

    try {
      if (typeof plugin.destroy === 'function') {
        plugin.destroy();
      }
      this.plugins.delete(name);
      console.log(`[PluginManager] Plugin "${name}" unregistered`);
    } catch (error) {
      console.error(`[PluginManager] Error destroying plugin "${name}":`, error);
    }
  }

  /**
   * Get a plugin instance
   * @param {string} name - Plugin name
   * @returns {Object|undefined} Plugin instance
   */
  get(name) {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is registered
   * @param {string} name - Plugin name
   * @returns {boolean}
   */
  has(name) {
    return this.plugins.has(name);
  }

  /**
   * Get all registered plugin names
   * @returns {string[]}
   */
  list() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Enable hot-reload for development
   * Watches for plugin file changes and reloads automatically
   */
  enableHotReload() {
    if (this.hotReloadEnabled) return;
    this.hotReloadEnabled = true;

    // In production, this would integrate with a dev server
    console.log('[PluginManager] Hot-reload enabled (dev mode)');

    // Expose reload method to window for manual hot-reload
    window.traceReloadPlugin = (name) => this.reload(name);
    window.traceReloadAllPlugins = () => this.reloadAll();
  }

  /**
   * Reload a specific plugin
   * @param {string} name - Plugin name
   */
  async reload(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      console.warn(`[PluginManager] Cannot reload "${name}": not found`);
      return;
    }

    console.log(`[PluginManager] Reloading plugin "${name}"...`);

    try {
      // Unregister existing plugin
      this.unregister(name);

      // Force module cache bust (for dev environments)
      const modulePath = this.pluginModules.get(name);
      if (modulePath) {
        const timestamp = Date.now();
        const module = await import(`${modulePath}?t=${timestamp}`);
        const PluginClass = module.default || module[Object.keys(module)[0]];
        const newPlugin = new PluginClass();
        this.register(name, newPlugin);
      }

      console.log(`[PluginManager] Plugin "${name}" reloaded successfully`);
    } catch (error) {
      console.error(`[PluginManager] Failed to reload plugin "${name}":`, error);
    }
  }

  /**
   * Reload all plugins
   */
  async reloadAll() {
    console.log('[PluginManager] Reloading all plugins...');
    const names = this.list();
    for (const name of names) {
      await this.reload(name);
    }
  }

  /**
   * Store plugin module path for hot-reload
   * @param {string} name - Plugin name
   * @param {string} path - Module path
   */
  storeModulePath(name, path) {
    this.pluginModules.set(name, path);
  }

  /**
   * Destroy all plugins
   */
  destroyAll() {
    console.log('[PluginManager] Destroying all plugins...');
    for (const name of this.list()) {
      this.unregister(name);
    }
    this.plugins.clear();
    this.pluginModules.clear();
  }
}

/**
 * Base Plugin Class
 * All plugins should extend this or implement init/destroy
 */
export class TracePlugin {
  constructor(name = 'UnnamedPlugin') {
    this.name = name;
    this.engine = null;
    this._abortController = null;
  }

  /**
   * Initialize plugin with engine instance
   * @param {Object} engine - TraceEngine instance
   */
  init(engine) {
    this.engine = engine;
    this._abortController = new AbortController();
    console.log(`[${this.name}] Initialized`);
  }

  /**
   * Get abort signal for event listeners
   * @returns {AbortSignal}
   */
  get signal() {
    return this._abortController?.signal;
  }

  /**
   * Cleanup plugin resources
   */
  destroy() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    console.log(`[${this.name}] Destroyed`);
  }

  /**
   * Plugin lifecycle hook: called when engine renders
   */
  onRender() {
    // Override in subclass if needed
  }

  /**
   * Plugin lifecycle hook: called when theme changes
   */
  onThemeChange() {
    // Override in subclass if needed
  }
}
