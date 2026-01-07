---
name: Performance Issue
about: Report performance issues like frame drops, GPU acceleration problems, or memory leaks
title: "[PERF] "
labels: ["performance"]
assignees: ''
---

## Pre-submission Checklist

<!-- Please check the following before submitting: -->

- [ ] I have searched existing issues to ensure this performance issue hasn't been reported
- [ ] I have tested with browser DevTools Performance panel
- [ ] I have disabled browser extensions that might affect performance
- [ ] I have tested on multiple devices if possible

## Performance Issue Type

<!-- What kind of performance issue are you experiencing? -->

- [ ] 🎬 **Frame Drops / Jitter** — Choppy animations or scrolling
- [ ] 🖥️ **GPU Acceleration** — Missing hardware acceleration
- [ ] 💾 **Memory Leak** — Increasing memory usage over time
- [ ] ⏱️ **Slow Rendering** — Delayed initial load or interactions
- [ ] 🔄 **Event Listener Leak** — Listeners not properly cleaned up
- [ ] ⚡ **Other:** ___________

## Performance Description

<!-- Provide a clear description of the performance issue. -->
<!-- Include any metrics you've measured (FPS, memory usage, etc.) -->

## Steps to Reproduce

<!-- How can we reproduce the performance issue? -->

1. Open TRACE at '...'
2. Navigate to '...'
3. Perform action (e.g., scroll, hover, long press)
4. Observe performance degradation

## Expected Performance

<!-- What performance level do you expect? -->
<!-- TRACE aims for 60 FPS smooth animations without jitter. -->

## Actual Performance

<!-- What performance are you observing? -->
<!-- Include measurements if available. -->

| Metric              | Expected | Actual |
| ------------------- | -------- | ------ |
| **Frame Rate**      | 60 FPS   |        |
| **Memory Usage**    | Stable   |        |
| **CPU Usage**       | Low      |        |
| **GPU Utilization** | Active   |        |

## Performance Profile (Optional)

<!-- If you have captured a Chrome DevTools Performance recording: -->
<!-- 1. Open DevTools (F12) → Performance tab -->
<!-- 2. Click Record → Reproduce the issue → Stop -->
<!-- 3. Export the profile and attach it here, or screenshot the flame graph -->

## Environment

<!-- Please complete ALL of the following information: -->

| Field               | Value                                  |
| ------------------- | -------------------------------------- |
| **Device**          | e.g., MacBook Pro M1, Dell XPS 15      |
| **OS**              | e.g., Windows 11, macOS Sonoma, iOS 17 |
| **Browser**         | e.g., Chrome, Safari, Firefox          |
| **Browser Version** | e.g., Chrome 120.0.6099.109            |
| **RAM**             | e.g., 8GB, 16GB                        |
| **GPU**             | e.g., Intel Iris, NVIDIA RTX 3060      |
| **Hardware Accel.** | Enabled / Disabled                     |

## TRACE Performance Standards

<!-- For reference, TRACE requires: -->
<!-- - GPU acceleration via `backface-visibility: hidden` -->
<!-- - Use of `will-change` for animated elements -->
<!-- - Event delegation instead of individual listeners -->
<!-- - `requestAnimationFrame` for visual updates -->
<!-- - Proper cleanup via `destroy()` methods -->

## Potential Causes (Optional)

<!-- If you have ideas about what might be causing this, share them. -->

## Additional Context

<!-- Any other context about the performance issue? -->
<!-- Does this happen consistently or intermittently? -->
<!-- Does closing other tabs/apps improve performance? -->
