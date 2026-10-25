import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef } from 'react';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-none',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
