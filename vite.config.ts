import tailwindcss from '@tailwindcss/vite';
import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isVercel = !!process.env.VERCEL;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Runtime fijo: Vercel no debe elegir una versión de Node que el adaptador no soporte.
			adapter: isVercel ? vercelAdapter({ runtime: 'nodejs22.x' }) : nodeAdapter()
		})
	]
});
