import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Card } from './card'
import { TableSkeleton } from './skeleton'

/**
 * Tableaux « Verre & Argile » : une carte argile, en-tête sobre en casse normale,
 * lignes aérées avec survol doux, défilement horizontal propre sur téléphone.
 *
 *   <TableCard toolbar={…} footer={<Pagination … />}>
 *     <Table minWidth={720}>
 *       <THead><tr><Th>Nom</Th>…</tr></THead>
 *       <TBody>{rows.map(r => <Tr key=…><Td>…</Td></Tr>)}</TBody>
 *     </Table>
 *   </TableCard>
 */
export function TableCard({
  children,
  toolbar,
  footer,
  loading,
  empty,
  className,
}: {
  children: ReactNode
  /** Zone au-dessus du tableau, dans la carte (titre, filtres compacts…). */
  toolbar?: ReactNode
  /** Zone sous le tableau (pagination, total…). */
  footer?: ReactNode
  /** Affiche un squelette à la place du contenu. */
  loading?: boolean
  /** Affiché à la place du tableau quand il n'y a aucune ligne (ex. <EmptyState/>). */
  empty?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col overflow-hidden', className)}>
      {toolbar && <div className="border-b border-hairline px-4 py-3.5 sm:px-5">{toolbar}</div>}
      {loading ? <TableSkeleton /> : empty ? <div className="px-4 py-2">{empty}</div> : <div className="ma-scroll min-w-0 overflow-x-auto">{children}</div>}
      {footer && <div className="border-t border-hairline px-4 py-3 sm:px-5">{footer}</div>}
    </Card>
  )
}

export function Table({ className, minWidth = 640, ...props }: HTMLAttributes<HTMLTableElement> & { minWidth?: number }) {
  return <table style={{ minWidth }} className={cn('w-full border-separate border-spacing-0 text-left text-[13.5px] text-ink', className)} {...props} />
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_th]:sticky [&_th]:top-0', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...props} />
}

type SortDir = 'asc' | 'desc' | null

/** En-tête de colonne. `sort` + `onSort` le rendent cliquable avec une flèche. */
export function Th({
  className,
  children,
  align = 'left',
  sort,
  onSort,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; sort?: SortDir; onSort?: () => void }) {
  const content = onSort ? (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        'group/sort -mx-1.5 inline-flex items-center gap-1 rounded-[7px] px-1.5 py-0.5 transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.06]',
        sort && 'text-ink',
      )}
    >
      {children}
      {sort === 'asc' ? (
        <ArrowUp className="h-3 w-3" strokeWidth={2.4} />
      ) : sort === 'desc' ? (
        <ArrowDown className="h-3 w-3" strokeWidth={2.4} />
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-60" strokeWidth={2.4} />
      )}
    </button>
  ) : (
    children
  )
  return (
    <th
      scope="col"
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
      className={cn(
        'z-[1] whitespace-nowrap border-b border-hairline bg-surface-2/80 px-4 py-2.5 text-[12px] font-medium text-ink-3 backdrop-blur first:pl-5 last:pr-5 dark:bg-white/[0.025]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {content}
    </th>
  )
}

/** Ligne : survol doux ; `onClick` la rend cliquable (curseur + focus clavier). `accent` trace un liseré à gauche. */
export function Tr({
  className,
  onClick,
  accent,
  selected,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { accent?: 'danger' | 'warning' | 'gold' | 'info'; selected?: boolean }) {
  return (
    <tr
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter') onClick(e as unknown as React.MouseEvent<HTMLTableRowElement>)
            }
          : undefined
      }
      data-accent={accent}
      className={cn(
        'group/row transition-colors duration-150',
        'hover:bg-ink/[0.025] dark:hover:bg-white/[0.03]',
        onClick && 'cursor-pointer focus-visible:bg-ink/[0.04] focus-visible:outline-none dark:focus-visible:bg-white/[0.05]',
        selected && 'bg-ma-gold-500/[0.07] hover:bg-ma-gold-500/[0.1] dark:bg-ma-gold-400/[0.08]',
        accent &&
          '[&>td:first-child]:relative [&>td:first-child]:before:absolute [&>td:first-child]:before:inset-y-2.5 [&>td:first-child]:before:left-1.5 [&>td:first-child]:before:w-[3px] [&>td:first-child]:before:rounded-full',
        accent === 'danger' && '[&>td:first-child]:before:bg-status-danger',
        accent === 'warning' && '[&>td:first-child]:before:bg-status-warning',
        accent === 'gold' && '[&>td:first-child]:before:bg-ma-gold-500',
        accent === 'info' && '[&>td:first-child]:before:bg-status-info',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, align = 'left', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'border-b border-hairline px-4 py-3 align-middle first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

/** Texte principal + ligne secondaire dans une cellule. */
export function CellStack({ title, meta, className }: { title: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate font-medium text-ink">{title}</div>
      {meta && <div className="mt-0.5 truncate text-[12px] text-ink-3">{meta}</div>}
    </div>
  )
}

/** Référence / identifiant technique (police à chasse fixe, discrète). */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12px] tracking-tight text-ink-2', className)}>{children}</span>
}

/** Groupe d'actions de ligne : apparaît nettement au survol sur ordinateur, toujours visible au toucher. */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-0.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-55 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/** Petit bouton icône pour les actions de ligne (voir, modifier, supprimer…). */
export function IconAction({
  label,
  onClick,
  children,
  tone = 'default',
  disabled,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'press inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-3 transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] disabled:pointer-events-none disabled:opacity-35 [&_svg]:h-[16px] [&_svg]:w-[16px]',
        tone === 'danger'
          ? 'hover:bg-status-danger/10 hover:text-status-danger'
          : 'hover:bg-ink/[0.06] hover:text-ink dark:hover:bg-white/[0.08]',
      )}
    >
      {children}
    </button>
  )
}

/** Pagination compacte : « 1–10 sur 42 », taille de page, précédent / suivant. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  onPageSize,
  sizes = [10, 25, 50],
  unit,
}: {
  /** Page courante, à partir de 1. */
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
  sizes?: number[]
  /** Nom des éléments au pluriel, ex. « agents ». */
  unit?: string
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-3">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          <span className="font-medium text-ink">
            {from}–{to}
          </span>{' '}
          sur <span className="font-medium text-ink">{total}</span>
          {unit ? ` ${unit}` : ''}
        </span>
        {onPageSize && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Par page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="clay-field h-8 cursor-pointer appearance-none rounded-[10px] border-0 px-2.5 text-[13px] font-medium text-ink outline-none"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 tabular-nums">
          Page {page} / {Math.max(1, pageCount)}
        </span>
        <PageButton label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </PageButton>
        <PageButton label="Page suivante" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </PageButton>
      </div>
    </div>
  )
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press glass-strong inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35 [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </button>
  )
}
