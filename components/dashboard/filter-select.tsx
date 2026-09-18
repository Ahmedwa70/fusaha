"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DashboardFilterSelect({
  options,
  value,
  onValueChange,
  className,
}: {
  options: { value: string; label: string }[];
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  const labelByValue = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select
      {...(value !== undefined
        ? { value, onValueChange: (v) => onValueChange?.(v as string) }
        : { defaultValue: options[0].value })}
    >
      <SelectTrigger className={className ?? "w-40"}>
        <SelectValue>{(value: string) => labelByValue[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
