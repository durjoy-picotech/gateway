import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronRight, Search, MoreHorizontal, Plus, Edit, Trash2, Wallet2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
interface DataTableProps {
  data: any[];
  columns: Column[];
  onEdit?: (row: any) => void;
  onAdjustment?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
  searchPlaceholder?: string;
  onSearch?: (searchTerm: string) => void;
  enableAjaxSearch?: boolean;
  loading?: boolean;
  initialLoading?: boolean;
  onAddNew?: () => void;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  onEdit,
  onAdjustment,
  onDelete,
  onView,
  searchPlaceholder = "Search...",
  onSearch,
  enableAjaxSearch = false,
  loading = false,
  initialLoading = false,
  onAddNew,
  pagination,
  onPageChange
}) => {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const savedScrollRef = useRef(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Check if the click is outside any dropdown menu
      if (!target.closest('.dropdown-menu') && !target.closest('.dropdown-trigger')) {
        setOpenDropdownIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  useEffect(() => {
    if (pagination?.page !== undefined) {
      setPaginationLoading(false);
      if (savedScrollRef.current > 0) {
        setTimeout(() => window.scrollTo(0, savedScrollRef.current), 0);
        savedScrollRef.current = 0;
      }
    }
  }, [pagination?.page]);



  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (enableAjaxSearch && onSearch) {
      onSearch(value);
    }
  };

  const toggleDropdown = (index: number) => {
    setOpenDropdownIndex(openDropdownIndex === index ? null : index);
  };

  const handleEdit = (row: any) => {
    setOpenDropdownIndex(null);
    if (onEdit) onEdit(row);
  };

  const handleAdjustment = (row: any) => {
    setOpenDropdownIndex(null);
    if (onAdjustment) onAdjustment(row);
  };
  const handleDelete = (row: any) => {
    setOpenDropdownIndex(null);
    if (onDelete) onDelete(row);
  };
  const handleView = (row: any) => {
    setOpenDropdownIndex(null);
    if (onView) onView(row);
  };

  // Use client-side filtering if AJAX search is not enabled
  const filteredData = enableAjaxSearch ? data : data.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const totalPages = pagination ? pagination.pages : Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = pagination ? sortedData : sortedData.slice(startIndex, endIndex);


  return (
    <div className="overflow-auto max-h-[500px]">
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Header with Search and Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* <div className="flex items-center space-x-2">
            <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filter</span>
            </button>
          </div> */}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                      }`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <div className="flex flex-col">
                          <ChevronUp
                            className={`h-3 w-3 ${sortColumn === column.key && sortDirection === 'asc'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400'
                              }`}
                          />
                          <ChevronDown
                            className={`h-3 w-3 -mt-1 ${sortColumn === column.key && sortDirection === 'desc'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400'
                              }`}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete || onView || onAdjustment) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {initialLoading ? (
                <tr>
                  <td colSpan={columns.length + (onEdit || onDelete || onView || onAdjustment ? 1 : 0)} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Loading providers...</span>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={columns.length + (onEdit || onDelete || onView || onAdjustment ? 1 : 0)} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-gray-600 dark:text-gray-400">Searching...</span>
                    </div>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (onEdit || onDelete || onView || onAdjustment ? 1 : 0)} className="px-6 py-12 text-center">
                    {enableAjaxSearch && data.length > 0 ? (
                      <div className="text-gray-500 dark:text-gray-400">
                        No results found for your search
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-gray-500 dark:text-gray-400 mb-4">
                          No data available
                        </div>
                        {onAddNew && (
                          <button
                            onClick={onAddNew}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Provider
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                currentData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </td>
                    ))}
                    {(onEdit || onDelete || onView || onAdjustment) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => toggleDropdown(index)}
                            className="dropdown-trigger p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </button>

                          {openDropdownIndex === index && (
                            <div className="dropdown-menu absolute right-0 z-10 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <div className="py-1">
                                {onEdit && (
                                  <button
                                    onClick={() => handleEdit(row)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                                  >
                                    <Edit className="h-4 w-4 mr-3" />
                                    Edit
                                  </button>
                                )}
                                {onAdjustment && (
                                  <button
                                    onClick={() => handleAdjustment(row)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                                  >
                                    <Wallet2 className="h-4 w-4 mr-3" />
                                    Adjustment
                                  </button>
                                )}
                                {onDelete && (
                                  <button
                                    onClick={() => handleDelete(row)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4 mr-3" />
                                    Delete
                                  </button>
                                )}
                                {onView && (
                                  <button
                                    onClick={() => handleView(row)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                                  >
                                    <ChevronRight className="h-4 w-4 mr-3" />
                                    Details
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {paginationLoading && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {/* Results text */}
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {pagination ? (
                  <div>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} results
                  </div>
                ) : (
                  <div>
                    Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of{" "}
                    {sortedData.length} results
                  </div>
                )}
              </div>

              {/* Page controls */}
              <div className="flex items-center space-x-2">
                {/* Previous */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    savedScrollRef.current = window.scrollY;
                    setPaginationLoading(true);
                    onPageChange && onPageChange(Math.max(1, (pagination?.page || 1) - 1));
                    e.currentTarget.blur();
                  }}
                  disabled={pagination?.page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.max(1, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      type="button"
                      key={page}
                      onClick={(e) => {
                        e.preventDefault();
                        savedScrollRef.current = window.scrollY;
                        setPaginationLoading(true);
                        onPageChange && onPageChange(page);
                        e.currentTarget.blur();
                      }}
                      className={`px-3 py-1 border rounded text-sm ${pagination?.page === page
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}

                {/* Next */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    savedScrollRef.current = window.scrollY;
                    setPaginationLoading(true);
                    onPageChange &&
                      onPageChange(Math.min(totalPages, (pagination?.page || 1) + 1));
                    e.currentTarget.blur();
                  }}
                  disabled={pagination?.page === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DataTable;