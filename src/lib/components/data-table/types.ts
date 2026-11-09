export interface Column<T> {
	id: string;
	header: string;
	/** Valor crudo, usado para ordenar y para búsqueda. */
	accessor: (row: T) => string | number | null;
	/** Presentación del valor (moneda, fecha...). */
	format?: (value: string | number | null, row: T) => string;
	align?: 'left' | 'right';
	sortable?: boolean;
	/** Oculta la columna en pantallas pequeñas. */
	hideOnMobile?: boolean;
}

export type SortDir = 'asc' | 'desc';
