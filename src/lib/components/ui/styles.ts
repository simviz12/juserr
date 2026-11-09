/**
 * Clases compartidas para controles nativos. Se usan como string para poder
 * aplicarlas a <input>/<select>/<textarea> conservando bind:value y name.
 */
export const inputClass =
	'h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 disabled:opacity-50 dark:[color-scheme:dark]';

export const textareaClass =
	'min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40';

export const selectClass =
	'h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40';

export const btn = {
	base: 'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
	primary: 'h-9 px-4 text-sm bg-primary text-primary-foreground shadow-sm hover:opacity-90',
	outline: 'h-9 px-4 text-sm border border-input bg-card text-foreground shadow-sm hover:bg-accent',
	ghost: 'h-9 px-3 text-sm text-foreground hover:bg-accent',
	danger: 'h-9 px-4 text-sm bg-danger text-white shadow-sm hover:opacity-90',
	sm: 'h-8 px-3 text-xs',
	icon: 'h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground'
} as const;

export const tableClass = {
	wrap: 'overflow-x-auto rounded-md border border-border custom-scrollbar',
	table: 'w-full text-sm',
	thead: 'bg-muted/60 text-left text-xs text-muted-foreground',
	th: 'h-10 px-3 font-medium whitespace-nowrap',
	tr: 'border-t border-border transition-colors hover:bg-muted/40',
	td: 'px-3 py-2.5 whitespace-nowrap'
} as const;
