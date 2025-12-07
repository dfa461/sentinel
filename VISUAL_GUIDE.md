# 🎨 Visual Design Guide

## Color System

### Primary Palette
```
Background:
  - Dark: #0f172a (slate-900)
  - Mid: #1e293b (slate-800)
  - Gradient: from-slate-900 via-slate-800 to-slate-900

Text:
  - Primary: #f1f5f9 (slate-100)
  - Secondary: #cbd5e1 (slate-300)
  - Muted: #94a3b8 (slate-400)

Accents:
  - Blue: #3b82f6 (blue-500) - Links, highlights
  - Purple: #a855f7 (purple-500) - AI interventions
  - Pink: #ec4899 (pink-500) - CTAs, gradients
  - Green: #22c55e (green-500) - Success, hints
  - Red: #ef4444 (red-500) - Warnings, errors
  - Yellow: #eab308 (yellow-500) - Caution
```

## Component Visual Specs

### 1. Assessment Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header (glass-effect)                                      │
│  ┌──────┐ Sentinel Assessment         [Python ▼] [Submit]  │
│  │ Icon │ AI-Powered Technical...                           │
│  └──────┘                                                    │
├─────────────────────────────────────────────────────────────┤
│ Problem Panel (33%)  │  Code Editor (67%)                   │
│ ┌──────────────────┐ │ ┌────────────────────────────────┐  │
│ │ 📚 Invert Binary │ │ │ 1  def invertTree(root):       │  │
│ │    Tree          │ │ │ 2      # Your code here        │  │
│ │                  │ │ │ 3      pass                    │  │
│ │ [Medium]         │ │ │                                │  │
│ │                  │ │ │ [Monaco Editor - Dark Theme]   │  │
│ │ ⏱️ 5:23          │ │ │                                │  │
│ │ 📈 AI watching   │ │ │                                │  │
│ │                  │ │ │                                │  │
│ │ Description...   │ │ │                                │  │
│ │ [scrollable]     │ │ │                                │  │
│ │                  │ │ │                                │  │
│ │ Test Cases...    │ │ │                                │  │
│ │                  │ │ │                                │  │
│ │ 💡 AI Notice     │ │ │                                │  │
│ └──────────────────┘ │ └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Floating Elements:
┌──────────────────────────────┐
│ 💡 Hint                      │  (Top right, animated entry)
│ Consider using recursion...  │
│                           [×]│
└──────────────────────────────┘
```

### 2. Intervention Modal

```
┌─────────────────────────────────────────────────────────────┐
│ [Dark overlay with blur]                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ┌────────────────────────────────────────────────┐   │  │
│  │ │ ⚠️  AI Challenge Question                      │   │  │
│  │ │ Please answer to continue coding               │   │  │
│  │ └────────────────────────────────────────────────┘   │  │
│  │                                                      │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ Why did you choose a recursive approach here?  │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │ Your Response               [Voice Mode ▼]          │  │
│  │ ┌─────────────────────────────────────────────┐    │  │
│  │ │ Type your answer...                     🎤  │    │  │
│  │ │                                              │    │  │
│  │ │                                              │    │  │
│  │ └─────────────────────────────────────────────┘    │  │
│  │                                                      │  │
│  │ ┌────────────────────────────────────────────────┐ │  │
│  │ │      Submit Response                      ➤    │ │  │
│  │ └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Recruiter Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Header (glass-effect)                                      │
│  Assessment Summary          [👍 Good] [👎 Poor]            │
│  Candidate ID: demo-candidate                               │
├─────────────────────────────────────────────────────────────┤
│ Metrics Cards (4 columns)                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ ⏱️ 20m   │ │ 💬 5     │ │ 💻 12    │ │ 📈 8/10  │       │
│ │ Duration │ │Intervene │ │Snapshots │ │ Rating   │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│ Recommendation                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 🏆  Strong Hire                                         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Progress Chart                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │        Code Progress Timeline                           │ │
│ │   📈 [Line chart showing progress over time]           │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────┐ ┌──────────────────────┐          │
│ │ ✅ Strengths         │ │ ❌ Weaknesses        │          │
│ │ • Good problem...    │ │ • Could improve...   │          │
│ │ • Clear code         │ │ • Edge cases         │          │
│ └──────────────────────┘ └──────────────────────┘          │
│                                                              │
│ Interventions & Responses                                   │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 💬 Why did you choose recursion?              5:23     │ │
│ │    └─ Candidate: "Because it's cleaner..."            │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Animation Specs

### Hint Toast
```
Entry:
  - Fade in: 0 → 1 opacity
  - Slide down: -20px → 0
  - Scale: 0.95 → 1
  - Duration: 300ms
  - Easing: spring

Exit:
  - Reverse of entry
  - Duration: 200ms
```

### Intervention Modal
```
Backdrop:
  - Fade in: 0 → 1 opacity
  - Duration: 300ms

Modal:
  - Scale: 0.9 → 1
  - Fade in: 0 → 1 opacity
  - Slide up: 20px → 0
  - Duration: 300ms
  - Easing: spring (stiffness: 300, damping: 30)
```

### Page Transitions
```
All page loads:
  - Fade in: 0 → 1 opacity
  - Duration: 200ms
```

## Typography

### Font Families
```css
Sans-serif: system-ui, -apple-system, "Segoe UI", sans-serif
Mono: "JetBrains Mono", "Fira Code", monospace
```

### Font Sizes
```
xs:   0.75rem  (12px)
sm:   0.875rem (14px)
base: 1rem     (16px)
lg:   1.125rem (18px)
xl:   1.25rem  (20px)
2xl:  1.5rem   (24px)
3xl:  1.875rem (30px)
```

### Font Weights
```
normal:   400
medium:   500
semibold: 600
bold:     700
```

## Spacing System

```
0.5: 0.125rem (2px)
1:   0.25rem  (4px)
2:   0.5rem   (8px)
3:   0.75rem  (12px)
4:   1rem     (16px)
6:   1.5rem   (24px)
8:   2rem     (32px)
12:  3rem     (48px)
```

## Border Radius

```
Default: 0.75rem (12px) - rounded-xl
Large:   1rem    (16px) - rounded-2xl
Small:   0.5rem  (8px)  - rounded-lg
```

## Shadows

```
Small:  0 1px 2px rgba(0,0,0,0.1)
Medium: 0 4px 6px rgba(0,0,0,0.1)
Large:  0 10px 15px rgba(0,0,0,0.1)
XL:     0 20px 25px rgba(0,0,0,0.15)

Glow (Blue):    0 0 20px rgba(59, 130, 246, 0.3)
Glow (Purple):  0 0 20px rgba(168, 85, 247, 0.3)
```

## Glass Effect

```css
.glass-effect {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

## Gradient Text

```css
.text-gradient {
  background: linear-gradient(to right, #3b82f6, #a855f7, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Button States

```
Default:
  - Background: gradient (purple-600 → pink-600)
  - Padding: 12px 24px
  - Border radius: 12px
  - Font: semibold

Hover:
  - Background: gradient (purple-500 → pink-500)
  - Shadow: 0 0 20px purple-500/50
  - Transform: translateY(-1px)
  - Transition: 200ms

Disabled:
  - Opacity: 0.5
  - Cursor: not-allowed
  - No hover effects
```

## Icon Sizes

```
Small:  16px (w-4 h-4)
Medium: 20px (w-5 h-5)
Large:  24px (w-6 h-6)
XL:     32px (w-8 h-8)
```

## Layout Breakpoints

```
sm:  640px   - Tablet
md:  768px   - Tablet landscape
lg:  1024px  - Desktop
xl:  1280px  - Large desktop
2xl: 1536px  - Extra large
```

## Accessibility

### Focus States
```css
focus:outline-none
focus:ring-2
focus:ring-purple-500
focus:ring-offset-2
```

### Color Contrast
- All text meets WCAG AA standards (4.5:1 minimum)
- Interactive elements have clear focus indicators
- Error states use both color and icons

## Component States

### Loading
```
Spinner: Rotating circle with blue-500
Size: 32px
Animation: spin (1s linear infinite)
```

### Empty States
```
Icon: 64px gray-400
Text: "No data available"
Subtext: "Try adjusting filters"
```

### Error States
```
Icon: Red alert circle
Text: Red-400
Background: Red-400/10
Border: Red-400/30
```

## Z-Index Layers

```
1:  Base content
10: Dropdown menus
20: Fixed headers
30: Modals/dialogs
40: Tooltips
50: Toast notifications
```

## Dark Mode Colors

```
All components use dark mode by default:
- Background: slate-900 to slate-800
- Panels: white/5 with backdrop blur
- Borders: white/10
- Text: slate-100 to slate-400
```

---

## Implementation Examples

### Glass Panel
```tsx
<div className="glass-effect rounded-xl p-6">
  Content here
</div>
```

### Gradient Button
```tsx
<button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-purple-500/50 transition-all">
  Click Me
</button>
```

### Metric Card
```tsx
<div className="glass-effect rounded-xl p-6 border border-slate-700">
  <div className="flex items-center gap-3 mb-2">
    <Clock className="w-5 h-5 text-blue-400" />
    <span className="text-sm text-slate-400">Duration</span>
  </div>
  <p className="text-2xl font-bold text-white">20m 15s</p>
</div>
```

---

**This design system ensures:**
- ✅ Consistent visual language
- ✅ Professional appearance
- ✅ Smooth animations
- ✅ Accessible UI
- ✅ Dark mode optimization
