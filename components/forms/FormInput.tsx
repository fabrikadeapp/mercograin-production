import React from 'react'
import { useController, Control, FieldPath, FieldValues } from 'react-hook-form'
import { Input, InputProps } from '@/components/ui/Input'

interface FormInputProps<T extends FieldValues> extends Omit<InputProps, 'onChange' | 'value' | 'error'> {
  control: Control<T>
  name: FieldPath<T>
}

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  ...props
}: FormInputProps<T>) {
  const { field, fieldState: { error } } = useController({
    control,
    name,
  })

  return (
    <Input
      {...field}
      {...props}
      label={label}
      error={error?.message}
      onChange={(e) => {
        field.onChange(e)
      }}
    />
  )
}
