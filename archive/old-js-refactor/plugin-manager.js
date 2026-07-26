// TRACE Plugin Manager
// Plugin system

export class PluginManager {
  constructor(engine) {
    this.engine = engine;
    this.plugins = new Map();
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

  // PluginManager provides register/unregister/get/has/list/destroyAll.

  /**
   * Destroy all plugins
   */
  destroyAll() {
    console.log('[PluginManager] Destroying all plugins...');
    for (const name of this.list()) {
      this.unregister(name);
    }
    this.plugins.clear();
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
