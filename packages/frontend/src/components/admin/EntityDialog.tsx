import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export type FieldType = 'text' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox' | 'color' | 'date';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  helperText?: string;
}

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldConfig[];
  initialData?: Record<string, unknown> | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}

const NONE = '__none__';

export function EntityDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialData,
  onSubmit,
  submitLabel = 'Guardar',
}: EntityDialogProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const initial: Record<string, unknown> = {};
      fields.forEach((field) => {
        if (initialData && initialData[field.name] !== undefined && initialData[field.name] !== null) {
          initial[field.name] = initialData[field.name];
        } else if (field.defaultValue !== undefined) {
          initial[field.name] = field.defaultValue;
        } else {
          initial[field.name] = field.type === 'checkbox' ? false : '';
        }
      });
      setFormData(initial);
      setError(null);
    }
  }, [open, fields, initialData]);

  const handleSubmit = async () => {
    setError(null);

    // Validación básica de campos requeridos
    for (const field of fields) {
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === '' || value === null) {
          setError(`El campo "${field.label}" es obligatorio`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Limpiar valores vacíos y convertir __none__ a undefined
      const cleaned: Record<string, unknown> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value === NONE || value === '') {
          cleaned[key] = undefined;
          return;
        }
        const field = fields.find((f) => f.name === key);
        if (field?.type === 'number' && value !== '') {
          cleaned[key] = Number(value);
        } else {
          cleaned[key] = value;
        }
      });

      await onSubmit(cleaned);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              {field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={Boolean(formData[field.name])}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, [field.name]: checked }))
                    }
                  />
                  <span className="text-sm">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </span>
                </label>
              ) : (
                <>
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>

                  {field.type === 'select' ? (
                    <Select
                      value={String(formData[field.name] ?? NONE)}
                      onValueChange={(v) =>
                        setFormData((prev) => ({ ...prev, [field.name]: v === NONE ? undefined : v }))
                      }
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder={field.placeholder ?? 'Seleccionar...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {!field.required && <SelectItem value={NONE}>Sin asignar</SelectItem>}
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      id={field.name}
                      placeholder={field.placeholder}
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                    />
                  ) : field.type === 'color' ? (
                    <div className="flex items-center gap-2">
                      <input
                        id={field.name}
                        type="color"
                        className="h-10 w-14 rounded border cursor-pointer"
                        value={String(formData[field.name] ?? '#00B050')}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                      />
                      <Input
                        value={String(formData[field.name] ?? '')}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        placeholder="#00B050"
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type}
                      placeholder={field.placeholder}
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.name]: field.type === 'number' ? e.target.value : e.target.value,
                        }))
                      }
                    />
                  )}

                  {field.helperText && (
                    <p className="text-xs text-muted-foreground">{field.helperText}</p>
                  )}
                </>
              )}
            </div>
          ))}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
