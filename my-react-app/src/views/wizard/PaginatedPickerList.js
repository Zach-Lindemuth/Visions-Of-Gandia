import { useState } from "react";

const DEFAULT_PAGE_SIZE = 8;

function getPaginationItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 2, current - 1, current, current + 1, current + 2, "...", total];
}

/**
 * Self-contained searchable, paginated, scrollable picker list.
 *
 * Props:
 *   items           – available (unselected) items to display
 *   loading         – show loading state
 *   emptyMessage    – shown when items is empty
 *   noResultsMessage– shown when search yields nothing
 *   disabled        – disable all cards (selection limit reached)
 *   getId           – item => id
 *   onSelect        – called with id when a card is clicked
 *   renderCardContent – item => JSX rendered inside each picker-card
 */
export default function PaginatedPickerList({
  items,
  loading,
  emptyMessage,
  noResultsMessage,
  disabled,
  getId,
  onSelect,
  renderCardContent,
  pageSize = DEFAULT_PAGE_SIZE,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = searchQuery
    ? items.filter(
        (item) =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const paginationItems = getPaginationItems(safePage, totalPages);

  return (
    <div className="picker-list-container">
      <div className="talent-search">
        <input
          type="text"
          placeholder="Search by name or description..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="picker-list-scroll">
        {loading ? (
          <p className="muted">Loading...</p>
        ) : items.length === 0 ? (
          <p className="muted">{emptyMessage}</p>
        ) : filtered.length === 0 ? (
          disabled ? null : <p className="muted">{noResultsMessage}</p>
        ) : (
          <div className="picker-list">
            {paginated.map((item) => {
              const id = getId(item);
              return (
                <button
                  key={id}
                  className="picker-card"
                  onClick={() => onSelect(id)}
                  disabled={disabled}
                >
                  {renderCardContent(item)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && !loading && filtered.length > 0 && (
        <div className="talent-pagination">
          <button
            className="pg-btn pg-nav"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
          >
            PREV
          </button>
          {paginationItems.map((item, i) =>
            item === "..." ? (
              <span key={`ellipsis-${i}`} className="pg-ellipsis">...</span>
            ) : (
              <button
                key={item}
                className={`pg-btn pg-num${item === safePage ? " pg-active" : ""}`}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            )
          )}
          <button
            className="pg-btn pg-nav"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  );
}
