## Header Component Styling Guide

The new reusable Header component is in: `src/components/Header.jsx`

You can switch between **2 design variants** by changing the `variant` prop:

### Current Implementation (All pages use this by default)
```jsx
<Header variant="modern" />  // Modern with gradient & shadows
// or
<Header variant="minimalist" />  // Minimalist with orange accents
```

---

## Design Option 1: **MINIMALIST** (Simple, Clean)
- Light orange-colored bottom border (`border-orange-300`)
- Orange-tinted logo background
- Hover effects with soft orange-50 background
- Icons only on smaller screens, text labels shown on desktop
- **Best for:** Conservative, professional look

### Styling Features:
- Orange bottom border for visual accent
- Soft orange label for "Payment Gateway"
- Hover state: transitions text to orange-600 + orange-50 background
- Responsive: hides text on mobile, shows on desktop

---

## Design Option 2: **MODERN** (Bold, Visual Depth)
- Gradient orange background bar (orange-600 → orange-400)
- White/translucent header with backdrop blur
- Gradient text for "Payment Gateway" label
- Prominent orange gradient buttons with animations
- Smooth scale/rotate animations on icon hover
- Shadow effects throughout
- **Best for:** Modern, energetic feel with better visual hierarchy

### Styling Features:
- Gradient orange bar behind the header
- Glassmorphism effect (backdrop-blur + white/95 transparency)
- Gradient orange button for logout
- Gray-to-orange gradient on hover for change password
- Icon animations: hover scale up/rotate effects
- Drop shadows on buttons and logo background

---

## How to Switch Variants

All pages currently use `variant="modern"`. To change to minimalist:

**In these files:**
- `src/pages/admin/Admin.jsx`
- `src/pages/user/User.jsx`
- `src/pages/system_head/System_Head.jsx`
- `src/pages/system_head/ManageEvent.jsx`
- `src/pages/system_head/EventPage.jsx`
- `src/pages/user/PaymentDetails.jsx`

Replace:
```jsx
<Header variant="modern" />
```

With:
```jsx
<Header variant="minimalist" />
```

---

## Color Palette Used
- **Primary Orange:** #f97316 (orange-500), #ea580c (orange-600)
- **Orange Gradient:** from-orange-400 to orange-600
- **Accents:** orange-50, orange-100, orange-200
- **Text:** gray-900, gray-600, gray-700
- **Backgrounds:** white, white/95

---

## Features
✅ Reusable across all pages  
✅ Consistent logout & change password functionality  
✅ Responsive (icons only on mobile, labels on desktop)  
✅ Smooth animations and transitions  
✅ Works with your existing authentication system  
✅ Orange-themed to match your brand  

Which variant do you prefer? Or would you like to customize either one further?
