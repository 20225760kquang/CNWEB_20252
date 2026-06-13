import React from "react";

interface TableColumn<T> {
  key: string;
  header: string | React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  className?: string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  className = "",
  onRowClick,
  emptyMessage = "Không có dữ liệu",
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto w-full ${className}`}>
      <table className="w-full text-left border-collapse min-w-max">
        <thead>
          <tr className="border-b border-outline-variant/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider ${
                  col.className || ""
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-on-surface-variant"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`group transition-colors hover:bg-surface-variant/30 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={`${keyExtractor(item)}-${col.key}`}
                    className={`py-3 px-4 text-sm text-on-surface ${
                      col.className || ""
                    }`}
                  >
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
