"use client";

import { InputHTMLAttributes, ReactNode } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export default function InputField({
  label,
  error,
  icon,
  className = "",
  id,
  ...props
}: InputFieldProps) {
  const inputId = id || label?.replace(/\s/g, "-").toLowerCase();

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-muted-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`input-field ${icon ? "pr-10" : ""} ${
            error ? "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50" : ""
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
