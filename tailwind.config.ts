
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	future: {
		// Touch devices (e.g. Galaxy Z Fold) keep :hover stuck on the last tapped
		// element, which leaves hover transforms applied and makes enlarged
		// controls swallow taps meant for their neighbours.
		hoverOnlyWhenSupported: true,
	},
	content: [

		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Overpass', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['"Overpass Mono"', 'ui-monospace', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				status: {
					neutral: 'hsl(var(--status-neutral))', waiting: 'hsl(var(--status-waiting))', booked: 'hsl(var(--status-booked))',
					transit: 'hsl(var(--status-transit))', done: 'hsl(var(--status-done))', failed: 'hsl(var(--status-failed))',
					ni: 'hsl(var(--status-ni))', trunk: 'hsl(var(--status-trunk))', inspection: 'hsl(var(--status-inspection))',
				},
				segment: { 1: 'hsl(var(--segment-1))', 2: 'hsl(var(--segment-2))', 3: 'hsl(var(--segment-3))', 4: 'hsl(var(--segment-4))', 5: 'hsl(var(--segment-5))', 6: 'hsl(var(--segment-6))', 7: 'hsl(var(--segment-7))', 8: 'hsl(var(--segment-8))' },
				courier: { 50: 'hsl(var(--route-tint))', 100: 'hsl(var(--route-tint))', 200: 'hsl(var(--route-tint))', 300: 'hsl(var(--route))', 400: 'hsl(var(--route))', 500: 'hsl(var(--route))', 600: 'hsl(var(--route))', 700: 'hsl(var(--route))', 800: 'hsl(var(--tarmac))', 900: 'hsl(var(--tarmac))', 950: 'hsl(var(--tarmac))' }
			},
			boxShadow: {
				'card': 'var(--shadow-card)'
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.15s ease-out',
				'route-draw': 'route-draw 0.4s ease-out',
				'van-slide': 'van-slide 0.35s ease-in-out'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'route-draw': { from: { clipPath: 'inset(0 100% 0 0)' }, to: { clipPath: 'inset(0)' } },
				'van-slide': { from: { transform: 'translateX(-8px)', opacity: '0.65' }, to: { transform: 'translateX(0)', opacity: '1' } }
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
