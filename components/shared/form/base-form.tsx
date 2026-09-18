import {
  useForm,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormTrigger,
  type FieldErrors,
  type UseFormGetValues,
  type UseFormWatch,
  type Control,
  type FieldValues,
  type DefaultValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";

export type FormMode = "create" | "edit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormSchema = z.ZodType<any, any>;

export interface BaseFormProps<T extends FormSchema> {
  // A single schema, already picked by the caller for the current mode —
  // create/edit schemas can have entirely different fields (e.g. `email`
  // only on create), so unifying them under one type parameter here would
  // force them to share a shape they don't have.
  schema: T;
  defaultValues?: DefaultValues<z.input<T> & FieldValues>;
  // Returning `{ error }` (the shape every server action here uses) renders
  // it as the form's root error instead of the caller having to throw.
  onSubmit: (data: z.output<T>) => Promise<{ error: string } | void> | void;
  isLoading?: boolean;
  className?: string;
  children: (methods: FormMethods<z.input<T> & FieldValues>) => React.ReactNode;
}

export interface FormMethods<T extends FieldValues = FieldValues> {
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  getValues: UseFormGetValues<T>;
  watch: UseFormWatch<T>;
  trigger: UseFormTrigger<T>;
  control: Control<T>;
  errors: FieldErrors<T>;
  rootError?: string;
}

// Server actions here return `{ error }` directly rather than throwing, so
// there's no API-error-shape mapping to do — this only wires RHF and exposes
// its methods to the dialog body via a render-prop.
export function BaseForm<T extends FormSchema>(props: BaseFormProps<T>) {
  const { schema, defaultValues, onSubmit, isLoading = false, className, children } = props;

  type FormInput = z.input<T> & FieldValues;
  type FormOutput = z.output<T>;
  const typedSchema = schema as z.ZodType<FormOutput, FormInput>;

  const methods = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(typedSchema),
    defaultValues,
    disabled: isLoading,
  });
  const {
    register,
    setValue,
    setError,
    formState: { errors },
    getValues,
    watch,
    trigger,
    control,
    handleSubmit,
  } = methods;

  const handleFormSubmit = async (data: FormOutput) => {
    const result = await onSubmit(data);
    if (result && "error" in result) {
      setError("root", { message: result.error });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      aria-busy={isLoading}
      className={cn("flex flex-col gap-5", className)}
    >
      {children({
        register,
        setValue,
        getValues,
        watch,
        trigger,
        control,
        errors,
        rootError: errors.root?.message as string | undefined,
      })}
    </form>
  );
}
