// TRACE Interaction Plugin
// Handles mouse, touch, keyboard, and gesture interactions

import { TracePlugin } from '../core/plugin-manager.js';
import { DRAG_THRESHOLD_PX, EDGE_THRESHOLD, SWIPE_MIN_DISTANCE, MOUSE_DRAG_THRESHOLD, HAPTIC_SCRUB_MS, HAPTIC_SUCCESS_MS } from '../core/constants.js';

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');
    this._rafPending = false;
    this._pendingX = 0;
    this._pendingY = 0;
    this._lastHoveredElement = null;
    this._pressedElement = null;
    this._lastHapticAt = { scrub: 0, success: 0 };
    this.hasHover = false;
    this.ignoreHover = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.currentFocusIndex = -1;
  }

  init(engine) {
    super.init(engine);

    // Detect hover capability
    this._hoverMql = window.matchMedia('(hover: hover)');
    this.hasHover = this._hoverMql.matches;

    this._hoverMql.addEventListener(
      'change',
      (e) => {
        this.hasHover = e.matches;
      },
      { signal: this.signal }
    );

    this.setupKeyboardControls();
    this.setupTouchGestures();
    this.setupMouseControls();
    this.setupEventDelegation();
  }

  /**
   * Setup keyboard controls
   */
  setupKeyboardControls() {
    window.addEventListener(
      'keydown',
      (e) => {
        // Avoid double-handling when focus is inside the grid
        if (this.engine.viewport && this.engine.viewport.contains(e.target)) return;
        const key = e.key.toLowerCase();

        // Single key shortcuts (no modifiers)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (key === ' ' || key === 'spacebar') {
            e.preventDefault();
            const themePlugin = this.engine.plugins.get('ThemePlugin');
            if (themePlugin) themePlugin.cycleTheme();
            return;
          }
          if (key === 'r') {
            const devTools = this.engine.plugins.get('DevToolsPlugin');
            if (devTools) devTools.randomizeThemeNowAndLocale();
            return;
          }
          if (key === 'x') {
            const devTools = this.engine.plugins.get('DevToolsPlugin');
            if (devTools) devTools.resetToDefaults();
            return;
          }
        }
      },
      { signal: this.signal }
    );
  }

  /**
   * Setup touch gestures (swipe, triple tap, long press)
   */
  setupTouchGestures() {
    let isDragging = false;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;

    // Triple tap detection for reset
    const tripleTap = { count: 0, timer: null, lastTime: 0 };
    const handleTripleTap = () => {
      const now = performance.now();
      if (now - tripleTap.lastTime > 500) {
        tripleTap.count = 1;
      } else {
        tripleTap.count++;
        if (tripleTap.count === 3) {
          const devTools = this.engine.plugins.get('DevToolsPlugin');
          if (devTools) devTools.resetToDefaults();
          this.triggerHaptic('success');
          tripleTap.count = 0;
        }
      }
      tripleTap.lastTime = now;
      if (tripleTap.timer) clearTimeout(tripleTap.timer);
      tripleTap.timer = setTimeout(() => {
        tripleTap.count = 0;
      }, 500);
    };

    // Edge swipe detection for theme picker
    const edgeSwipe = { isFromEdge: false, startX: 0, startY: 0 };

    // Dev touch (2-finger long press)
    const devTouch = { active: new Map(), timer: null, moved: false };
    const clearDevTouchTimer = () => {
      if (devTouch.timer) {
        clearTimeout(devTouch.timer);
        devTouch.timer = null;
      }
    };
    const maybeStartDevTouchTimer = () => {
      clearDevTouchTimer();
      devTouch.moved = false;
      const pts = Array.from(devTouch.active.values());
      if (pts.length !== 2) return;
      devTouch.timer = setTimeout(() => {
        if (devTouch.active.size === 2 && !devTouch.moved) {
          const devTools = this.engine.plugins.get('DevToolsPlugin');
          if (devTools) devTools.randomizeThemeNowAndLocale();
          this.triggerHaptic('success');
        }
      }, 650);
    };

    const processPointerMove = () => {
      this._rafPending = false;
      if (this.ignoreHover) return;
      const target = document.elementFromPoint(this._pendingX, this._pendingY);
      if (target?.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
        if (this._lastHoveredElement !== target) {
          if (this._lastHoveredElement) {
            this._lastHoveredElement.classList.remove('tr-is-touch-active');
          }
          target.classList.add('tr-is-touch-active');
          this._lastHoveredElement = target;
          this.triggerHaptic('scrub');
        }
        const dateText = target.dataset.trDate;
        const infoText = target.dataset.trInfo;
        const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
        if (tooltipPlugin) {
          tooltipPlugin.showTooltipAt(this._pendingX, this._pendingY, true, dateText, infoText);
        }
      } else if (this._lastHoveredElement) {
        this._lastHoveredElement.classList.remove('tr-is-touch-active');
        this._lastHoveredElement = null;
      }
    };

    const schedulePointerUpdate = (x, y) => {
      this._pendingX = x;
      this._pendingY = y;
      this.lastPointerX = x;
      this.lastPointerY = y;
      if (!this._rafPending) {
        this._rafPending = true;
        requestAnimationFrame(processPointerMove);
      }
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        devTouch.active.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (devTouch.active.size === 2) maybeStartDevTouchTimer();
        if (devTouch.active.size > 1) return;

        // Detect edge swipe start
        const isLeftEdge = e.clientX < EDGE_THRESHOLD;
        const isRightEdge = e.clientX > window.innerWidth - EDGE_THRESHOLD;
        edgeSwipe.isFromEdge = isLeftEdge || isRightEdge;
        edgeSwipe.startX = e.clientX;
        edgeSwipe.startY = e.clientY;
      }
      activePointerId = e.pointerId;
      this.engine.viewport.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
      
      const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
      if (tooltipPlugin) tooltipPlugin.cancelHide();
      
      schedulePointerUpdate(e.clientX, e.clientY);
      
      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      const pressed = document.elementFromPoint(e.clientX, e.clientY);
      if (pressed?.classList?.contains('tr-day') && !pressed.classList.contains('tr-day--filler')) {
        this._pressedElement = pressed;
        pressed.classList.add('tr-is-pressing');
      }
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch' && devTouch.active.has(e.pointerId)) {
        devTouch.active.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (activePointerId !== e.pointerId) return;
      }
      if (activePointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Detect edge swipe gesture
      if (edgeSwipe.isFromEdge && Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dy) < 80) {
        edgeSwipe.isFromEdge = false;
        const themePlugin = this.engine.plugins.get('ThemePlugin');
        if (themePlugin) themePlugin.cycleTheme();
        this.triggerHaptic('success');
        isDragging = true;
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
        return;
      }

      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        isDragging = true;
        this.ignoreHover = false;
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
      }
      schedulePointerUpdate(e.clientX, e.clientY);
    };

    const handlePointerEnd = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        devTouch.active.delete(e.pointerId);
        if (devTouch.active.size < 2) clearDevTouchTimer();
        if (activePointerId !== e.pointerId) return;

        // Triple tap detection
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 10 && !isDragging) {
          handleTripleTap();
        }
      }
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      edgeSwipe.isFromEdge = false;
      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      
      const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
      if (tooltipPlugin) {
        const duration = isDragging ? 1250 : 2500;
        tooltipPlugin.scheduleHide(duration);
        if (this._lastHoveredElement) {
          this._lastHoveredElement.classList.remove('tr-is-touch-active');
          this._lastHoveredElement = null;
        }
        this.ignoreHover = false;
      }
      isDragging = false;
    };

    this.engine.viewport.addEventListener('pointerdown', handlePointerDown, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointermove', handlePointerMove, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointerup', handlePointerEnd, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointercancel', handlePointerEnd, { passive: true, signal: this.signal });
  }

  /**
   * Setup mouse controls (wheel, drag)
   */
  setupMouseControls() {
    let isMouseDragging = false;
    let dragStartX = 0;

    this.engine.viewport.addEventListener(
      'wheel',
      (e) => {
        if (!this.hasHover) return;
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) > 50) {
          const themePlugin = this.engine.plugins.get('ThemePlugin');
          if (themePlugin) themePlugin.cycleTheme();
          this.triggerHaptic('success');
        }
      },
      { passive: false, signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.hasHover) return;
        if (e.pointerType !== 'mouse') return;
        dragStartX = e.clientX;
        isMouseDragging = true;
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'pointermove',
      (e) => {
        if (!this.hasHover) return;
        if (!isMouseDragging || e.pointerType !== 'mouse') return;
        const dragDistance = e.clientX - dragStartX;
        if (Math.abs(dragDistance) > MOUSE_DRAG_THRESHOLD) {
          const themePlugin = this.engine.plugins.get('ThemePlugin');
          if (themePlugin) themePlugin.cycleTheme();
          this.triggerHaptic('success');
          isMouseDragging = false;
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'pointerup',
      () => {
        isMouseDragging = false;
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'pointerleave',
      () => {
        isMouseDragging = false;
      },
      { signal: this.signal }
    );
  }

  /**
   * Setup event delegation for hover and keyboard navigation
   */
  setupEventDelegation() {
    let mouseRafPending = false;
    let pendingMouseX = 0;
    let pendingMouseY = 0;
    
    const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
    
    const processMouseMove = () => {
      mouseRafPending = false;
      if (tooltipPlugin) {
        tooltipPlugin.positionTooltip(pendingMouseX, pendingMouseY, false);
      }
    };

    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (!this.hasHover) return;
        if (this.ignoreHover) return;
        const target = e.target;
        if (target.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          if (tooltipPlugin) {
            tooltipPlugin.showTooltipAt(e.clientX, e.clientY, false, dateText, infoText);
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mousemove',
      (e) => {
        if (!this.hasHover) return;
        if (this.engine.tooltip.style.opacity === '1') {
          pendingMouseX = e.clientX;
          pendingMouseY = e.clientY;
          if (!mouseRafPending) {
            mouseRafPending = true;
            requestAnimationFrame(processMouseMove);
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mouseout',
      (e) => {
        if (!this.hasHover) return;
        if (!this.engine.viewport.contains(e.relatedTarget)) {
          this.engine.tooltip.style.opacity = '0';
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'keydown',
      (e) => {
        const target = e.target;
        if (!target.classList.contains('tr-day')) return;
        const index = parseInt(target.dataset.trIndex, 10);
        if (isNaN(index)) return;
        
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const themePlugin = this.engine.plugins.get('ThemePlugin');
          if (themePlugin) themePlugin.cycleTheme();
          return;
        }
        
        let targetIndex = -1;
        switch (e.key) {
          case 'ArrowRight':
            targetIndex = index + 1;
            break;
          case 'ArrowLeft':
            targetIndex = index - 1;
            break;
          case 'ArrowDown':
            targetIndex = index + this.engine._currentColumns;
            break;
          case 'ArrowUp':
            targetIndex = index - this.engine._currentColumns;
            break;
          case 'Home':
            targetIndex = 0;
            break;
          case 'End':
            targetIndex = this.engine.gridCells.length - 1;
            break;
          default:
            return;
        }
        
        if (targetIndex >= 0 && targetIndex < this.engine.gridCells.length) {
          const targetCell = this.engine.gridCells[targetIndex];
          if (targetCell && !targetCell.classList.contains('tr-day--filler')) {
            e.preventDefault();
            targetCell.focus();
            if (this.engine.srStatus) {
              this.engine.srStatus.textContent = targetCell.getAttribute('aria-label');
            }
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'focusin',
      (e) => {
        const target = e.target;
        if (target.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
          const rect = target.getBoundingClientRect();
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          if (tooltipPlugin) {
            tooltipPlugin.showTooltipAt(rect.left + rect.width / 2, rect.top + rect.height / 2, false, dateText, infoText);
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'focusout',
      () => {
        this.engine.tooltip.style.opacity = '0';
      },
      { signal: this.signal }
    );
  }

  /**
   * Trigger haptic feedback
   */
  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    const now = performance.now();
    const minGap = type === 'scrub' ? 90 : 350;
    if (now - (this._lastHapticAt[type] ?? 0) < minGap) return;
    this._lastHapticAt[type] = now;
    navigator.vibrate(type === 'scrub' ? HAPTIC_SCRUB_MS : HAPTIC_SUCCESS_MS);
  }

  destroy() {
    if (this._lastHoveredElement) {
      this._lastHoveredElement.classList.remove('tr-is-touch-active');
      this._lastHoveredElement = null;
    }
    if (this._pressedElement) {
      this._pressedElement.classList.remove('tr-is-pressing');
      this._pressedElement = null;
    }
    super.destroy();
  }
}
