"use client";

import DatePicker from "react-datepicker";
import { ko } from "date-fns/locale";

import { Input } from "@/components/ui/Input";

function parseYmd(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function DatePickerInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <DatePicker
      selected={parseYmd(props.value)}
      onChange={(date: Date | null) => props.onChange(date ? toYmd(date) : "")}
      dateFormat="yyyy-MM-dd"
      locale={ko}
      showPopperArrow={false}
      placeholderText={props.placeholder}
      customInput={<Input />}
      isClearable
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
    />
  );
}

