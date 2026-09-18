"use client";

import { type ReactNode } from "react";
import { z } from "zod";
import type { DefaultValues, FieldValues } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FieldError } from "@/components/ui/field";
import { BaseForm, type FormMethods } from "./base-form";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormSchema = z.ZodType<any, any>;

export interface DialogFormProps<T extends FormSchema> {
  schema: T;
  defaultValues?: DefaultValues<z.input<T> & FieldValues>;
  onSubmit: (data: z.output<T>) => Promise<{ error: string } | void> | void;
  isLoading?: boolean;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitLabel: string;
  cancelLabel: string;
  className?: string;
  children: (methods: FormMethods<z.input<T> & FieldValues>) => ReactNode;
}

export function DialogForm<T extends FormSchema>({
  schema,
  defaultValues,
  onSubmit,
  isLoading = false,
  title,
  description,
  open,
  onOpenChange,
  submitLabel,
  cancelLabel,
  className,
  children,
}: DialogFormProps<T>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (!next && isLoading) {
          eventDetails.cancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className={className ?? "sm:max-w-md"}>
        <BaseForm schema={schema} defaultValues={defaultValues} isLoading={isLoading} onSubmit={onSubmit}>
          {(methods) => (
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
              </DialogHeader>

              {children(methods)}

              <FieldError>{methods.rootError}</FieldError>

              <DialogFooter>
                <Button type="button" variant="outline" disabled={isLoading} onClick={() => onOpenChange(false)}>
                  {cancelLabel}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Spinner data-icon="inline-start" />}
                  {submitLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </BaseForm>
      </DialogContent>
    </Dialog>
  );
}
