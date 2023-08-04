interface PaginationProps {
  page: number;
  pages: number;
}

export function Pagination({ page, pages }: PaginationProps) {
  return (
    <ol className="pagination">
      {new Array(pages).fill(null).map((_, i) => (
        <li
          key={i.toString()}
          className={page === i ? 'active' : undefined}
        ></li>
      ))}
    </ol>
  );
}
