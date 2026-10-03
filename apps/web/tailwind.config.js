/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "fb-bg": "#0b1326",
        "fb-surface": "#171f33",
        "fb-surface-hover": "#222a3d",
        "fb-blue": "#0866FF",
        "fb-blue-hover": "#0055D4",
        "fb-text": "#dae2fd",
        "fb-text-muted": "#c2c6d6",
        primary: "#0866FF", // mapped for zt-reel compatibility
      },
      "spacing": {
        "gutter": "24px",
        "header-height": "64px",
        "sidebar-width": "280px",
        "stack-md": "16px",
        "container-padding": "32px",
        "card-gap": "20px",
        "stack-sm": "8px"
      },
      "fontFamily": {
        "sans": ["Mulish", "sans-serif"],
        "headline-lg": ["Mulish", "sans-serif"],
        "display-lg": ["Mulish", "sans-serif"],
        "body-sm": ["Mulish", "sans-serif"],
        "title-md": ["Mulish", "sans-serif"],
        "body-md": ["Mulish", "sans-serif"],
        "label-caps": ["Mulish", "sans-serif"]
      },
      "fontSize": {
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "900" }],
        "display-lg": ["48px", { "lineHeight": "60px", "letterSpacing": "-0.02em", "fontWeight": "900" }],
        "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
        "title-md": ["18px", { "lineHeight": "28px", "fontWeight": "800" }],
        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "500" }],
        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }]
      }
    },
  },
  plugins: [],
}
