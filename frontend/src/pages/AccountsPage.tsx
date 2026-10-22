import { useEffect, useState } from "react";
import { listImports, type ImportHistory } from "../api";

function formatDate(s: string): string {
  const datePart = s.split(" ")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AccountsPage() {
  const [imports, setImports] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listImports()
      .then(setImports)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Import History</h1>
        <div className="text-sm text-slate-500">{imports.length} imports</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>
      ) : imports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 shadow-sm">
          No statements imported yet.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">File Name</th>
                <th className="px-6 py-3 text-center">Parsed</th>
                <th className="px-6 py-3 text-center">Imported</th>
                <th className="px-6 py-3 text-center">Skipped</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {imports.map((imp) => (
                <tr key={imp.ID} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm whitespace-nowrap">{formatDate(imp.STARTED_AT)}</td>
                  <td className="px-6 py-3 text-sm font-medium">{imp.FILE_NAME}</td>
                  <td className="px-6 py-3 text-sm text-center text-slate-500">{imp.PARSED_COUNT}</td>
                  <td className="px-6 py-3 text-sm text-center font-semibold text-green-700">{imp.IMPORTED_COUNT}</td>
                  <td className="px-6 py-3 text-sm text-center text-slate-500">{imp.SKIPPED_COUNT}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      imp.IMPORT_STATUS === "COMPLETED" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {imp.IMPORT_STATUS}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}