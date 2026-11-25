const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: { bg: v("bg"), surface: v("surface"), raised: v("raised"), line: v("line"), fg: v("fg"), muted: v("muted"), brand: v("brand"), brand2: v("brand2"), up: v("up"), down: v("down"), warn: v("warn") },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
      keyframes: {
        shine: { from: { backgroundPosition: "150% 0" }, to: { backgroundPosition: "-50% 0" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(40px,-30px) scale(1.15)" } },
        rise: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: { shine: "shine 4s linear infinite", marquee: "marquee 40s linear infinite", float: "float 14s ease-in-out infinite", rise: "rise .5s ease both" },
    },
  },
  plugins: [],
};
