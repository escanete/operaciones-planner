import { useEtiquetas } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { EtiquetaRef } from '@operaciones-planner/shared';

// ============================================
// ETIQUETAS (estilo Zoho) — componentes compartidos
// ============================================

/** Chips de color para mostrar las etiquetas de una entidad */
export function EtiquetaChips({
  etiquetas,
  max = 3,
  size = 'sm',
  className,
}: {
  etiquetas?: EtiquetaRef[];
  max?: number;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  if (!etiquetas || etiquetas.length === 0) return null;
  const visibles = etiquetas.slice(0, max);
  const resto = etiquetas.length - visibles.length;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {visibles.map((e) => (
        <span
          key={e.id}
          title={e.nombre}
          className={cn(
            'inline-flex shrink-0 items-center rounded-full font-medium leading-none',
            size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
            e.nombre.length > 14 && 'max-w-24 truncate'
          )}
          style={{ backgroundColor: `${e.color}22`, color: e.color, border: `1px solid ${e.color}55` }}
        >
          {e.nombre}
        </span>
      ))}
      {resto > 0 && (
        <span className="shrink-0 text-[9px] text-muted-foreground">+{resto}</span>
      )}
    </span>
  );
}

/** Selector multi-selección de etiquetas para formularios (chips clicables) */
export function EtiquetaSelector({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { data: etiquetas, isLoading } = useEtiquetas(true);
  const disponibles = (etiquetas ?? []).filter((e) => e.activo);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Cargando etiquetas…</p>;
  }

  if (disponibles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No hay etiquetas creadas — pide a un administrador que las cree en Admin → Etiquetas
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {disponibles.map((e) => {
        const seleccionada = value.includes(e.id);
        return (
          <button
            key={e.id}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(seleccionada ? value.filter((id) => id !== e.id) : [...value, e.id])
            }
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-relaxed transition-all',
              !seleccionada && 'opacity-45 hover:opacity-80',
              disabled && 'cursor-not-allowed'
            )}
            style={{
              backgroundColor: seleccionada ? `${e.color}22` : 'transparent',
              color: e.color,
              border: `1px solid ${e.color}${seleccionada ? '' : '55'}`,
            }}
          >
            {e.nombre}
          </button>
        );
      })}
    </div>
  );
}
