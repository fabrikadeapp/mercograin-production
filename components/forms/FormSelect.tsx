import React from 'react'
import { useController, Control, FieldPath, FieldValues } from 'react-hook-form'
import { Select, SelectProps } from '@/components/ui/Select'

interface FormSelectProps<T extends FieldValues> extends Omit<SelectProps, 'onChange' | 'value' | 'error'> {
  control: Control<T>
  name: FieldPath<T>
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  ...props
}: FormSelectProps<T>) {
  const { field, fieldState: { error } } = useController({
    control,
    name,
  })

  return (
    <Select
      {...field}
      {...props}
      label={label}
      error={error?.message}
      options={options}
      onChange={(value) => {
        field.onChange(value)
      }}
    />
  )
}
