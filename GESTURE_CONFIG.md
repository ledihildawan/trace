# Mobile Gesture Configuration

## Current Thresholds

All gesture thresholds are defined in [js/core/constants.js](js/core/constants.js) and can be easily tuned based on physical device testing.

### Gesture Constants

```javascript
// Long Press
export const LONG_PRESS_DURATION_MS = 600;  // Time to hold before triggering reset

// Double Tap
export const DOUBLE_TAP_MAX_DELAY_MS = 350;  // Max time between taps
export const DOUBLE_TAP_MAX_DISTANCE_PX = 20; // Max distance between taps

// Pinch
export const PINCH_MIN_DISTANCE_CHANGE_PX = 30; // Min finger distance change to trigger

// Swipe
export const SWIPE_MIN_DISTANCE = 60; // Min swipe distance to register as gesture
```

## Gesture Actions

| Gesture              | Action               | Threshold                        |
| -------------------- | -------------------- | -------------------------------- |
| **Double Tap**       | Cycle theme          | 2 taps within 350ms, <20px apart |
| **Long Press**       | Reset to defaults    | Hold for 600ms                   |
| **Pinch**            | Randomize everything | Finger distance change >30px     |
| **Swipe Horizontal** | Cycle theme          | Swipe >60px horizontally         |
| **Swipe Vertical**   | Randomize            | Swipe >60px vertically           |

## Tuning Guidelines

### Long Press Duration
- **Too short (<400ms)**: Accidental triggers during normal taps
- **Too long (>800ms)**: Feels unresponsive, users give up
- **Current (600ms)**: Balance between precision and responsiveness
- **Recommended range**: 500-700ms

### Double Tap Timing
- **Too short (<250ms)**: Hard to achieve consistently
- **Too long (>500ms)**: Conflicts with single tap actions
- **Current (350ms)**: iOS/Android standard
- **Recommended range**: 300-400ms

### Double Tap Distance
- **Too small (<15px)**: Difficult on small screens
- **Too large (>30px)**: False positives from drag attempts
- **Current (20px)**: Standard touch target tolerance
- **Recommended range**: 18-25px

### Pinch Threshold
- **Too small (<20px)**: Triggers during hand tremor
- **Too large (>50px)**: Requires exaggerated gesture
- **Current (30px)**: Natural pinch motion
- **Recommended range**: 25-40px

### Swipe Distance
- **Too short (<40px)**: Conflicts with scroll/drag
- **Too long (>100px)**: Tiring on small screens
- **Current (60px)**: Deliberate but easy gesture
- **Recommended range**: 50-80px

## Testing Checklist

When adjusting thresholds, test on:

### Device Types
- [ ] Large phone (6.5"+)
- [ ] Standard phone (5.5-6.5")
- [ ] Small phone (<5.5")
- [ ] Tablet (7"+)
- [ ] Tablet (10"+)

### User Scenarios
- [ ] One-handed use
- [ ] Two-handed use
- [ ] While walking
- [ ] With gloves (winter)
- [ ] With screen protector
- [ ] In bright sunlight (less precise taps)

### Accessibility
- [ ] Motor impairment simulation
- [ ] Tremor simulation (increase thresholds)
- [ ] Limited dexterity (larger tap tolerance)

## Common Issues & Solutions

### Issue: Double tap triggers too easily
**Solution**: Increase `DOUBLE_TAP_MAX_DISTANCE_PX` or decrease `DOUBLE_TAP_MAX_DELAY_MS`

### Issue: Long press triggers during swipe
**Solution**: Already handled - long press cancels on move

### Issue: Pinch triggers while scrolling
**Solution**: Increase `PINCH_MIN_DISTANCE_CHANGE_PX`

### Issue: Swipe feels too sensitive
**Solution**: Increase `SWIPE_MIN_DISTANCE`

### Issue: Gestures don't work with gloves
**Solution**: Decrease all distance thresholds by ~20%

## Future Enhancements

- [ ] Device-specific profiles (phone vs tablet)
- [ ] User preference settings UI
- [ ] Adaptive thresholds based on usage patterns
- [ ] Gesture training/tutorial on first use
- [ ] Analytics to track false positive rates

## Quick Tuning

To quickly adjust for your device:

```javascript
// js/core/constants.js

// For smaller devices, make gestures more forgiving:
export const DOUBLE_TAP_MAX_DISTANCE_PX = 25; // was 20
export const SWIPE_MIN_DISTANCE = 50; // was 60

// For larger devices, tighten precision:
export const DOUBLE_TAP_MAX_DISTANCE_PX = 15; // was 20
export const LONG_PRESS_DURATION_MS = 550; // was 600
```

## A/B Testing Recommendations

If implementing analytics:

1. **Metric**: Gesture success rate
2. **Track**: Attempts vs successful triggers
3. **Goal**: >90% success rate, <5% false positives
4. **Test variants**: ±20% threshold adjustments
5. **Sample size**: 100+ users per variant
