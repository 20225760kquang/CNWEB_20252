import React, { useRef } from "react";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  className?: string;
}

export default function SearchInput({ onSearch, className = "", ...props }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = typeof props.value === "string" && props.value.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.onChange) {
      props.onChange(e);
    }
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onSearch?.("");
  };

  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        className="w-full pl-10 pr-10 py-2 rounded-full border border-outline-variant bg-surface text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
        onChange={handleChange}
        aria-label={props["aria-label"] || props.placeholder || "Tìm kiếm"}
        {...props}
      />
      {hasValue && onSearch && !props.disabled && (
        <button
          type="button"
          aria-label="Xóa tìm kiếm"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-on-surface-variant hover:bg-surface-variant"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  );
}
