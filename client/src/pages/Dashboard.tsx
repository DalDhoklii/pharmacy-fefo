import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface Medicine {
  id: number;
  name: string;
  category: string | null;
  inDateStock: number;
  expiredStock: number;
  totalBatches: number;
}

interface Alert {
  batchId: number;
  batchNo: string;
  medicineName: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
}

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [dispenseTarget, setDispenseTarget] = useState<Medicine | null>(null);
  const [dispenseQty, setDispenseQty] = useState("");
  const [dispenseResult, setDispenseResult] = useState<any>(null);
  const [dispenseError, setDispenseError] = useState("");

  const hasNearExpiryBatch = (medicineName: string) =>
    alerts.some((a) => a.medicineName === medicineName);

  const fetchMedicines = async () => {
    const res = await api.get("/medicines", {
      params: { search, sortBy, order, page, limit: 5 },
    });
    setMedicines(res.data.data);
    setTotalPages(res.data.pagination.totalPages);
  };

  const fetchAlerts = async () => {
    const res = await api.get("/alerts/expiring-soon");
    setAlerts(res.data.alerts);
  };

  useEffect(() => {
    fetchMedicines();
    fetchAlerts();
  }, [search, sortBy, order, page]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const openDispense = (med: Medicine) => {
    setDispenseTarget(med);
    setDispenseQty("");
    setDispenseResult(null);
    setDispenseError("");
  };

  const handleDispense = async () => {
    if (!dispenseTarget) return;
    setDispenseError("");
    setDispenseResult(null);
    try {
      const res = await api.post("/dispense", {
        medicineId: dispenseTarget.id,
        quantity: Number(dispenseQty),
      });
      setDispenseResult(res.data);
      fetchMedicines(); // refresh stock counts
    } catch (err: any) {
      setDispenseError(err.response?.data?.error || "Dispense failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-blue-600">Pharmacy FEFO</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">Hi, {user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Expiry Alerts */}
        {alerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-amber-800 mb-2">
              ⚠️ {alerts.length} batch(es) expiring within 30 days
            </h2>
            <ul className="text-sm text-amber-700 space-y-1">
              {alerts.map((a) => (
                <li key={a.batchId}>
                  {a.medicineName} — batch {a.batchNo}, {a.quantity} units,
                  expires in {a.daysUntilExpiry} day(s)
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Search + Sort controls */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search medicines..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-2 flex-1 min-w-[200px]"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="name">Sort by Name</option>
            <option value="inDateStock">Sort by In-Date Stock</option>
          </select>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        {/* Medicine table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">In-Date Stock</th>
                <th className="px-4 py-3">Expired Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med) => (
                <tr key={med.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{med.name}</td>
                  <td className="px-4 py-3 text-slate-600">{med.category}</td>
                  <td className="px-4 py-3">{med.inDateStock}</td>
                  <td className="px-4 py-3 text-slate-500">{med.expiredStock}</td>
                  <td className="px-4 py-3">
                    {med.inDateStock === 0 ? (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                        Expired
                      </span>
                    ) : hasNearExpiryBatch(med.name) ? (
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                        Near Expiry
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                        In Date
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDispense(med)}
                      disabled={med.inDateStock === 0}
                      className="text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                      Dispense
                    </button>
                  </td>
                </tr>
              ))}
              {medicines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No medicines found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="px-3 py-1 border rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </main>

      {/* Dispense Modal */}
      {dispenseTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-1">
              Dispense {dispenseTarget.name}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              In-date stock available: {dispenseTarget.inDateStock}
            </p>

            <input
              type="number"
              placeholder="Quantity"
              value={dispenseQty}
              onChange={(e) => setDispenseQty(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
            />

            {dispenseError && (
              <p className="text-red-600 text-sm mb-3">{dispenseError}</p>
            )}

            {dispenseResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm">
                <p className="font-medium text-green-800 mb-1">
                  Dispensed successfully
                </p>
                {dispenseResult.allocation.map((a: any) => (
                  <p key={a.batchId} className="text-green-700">
                    {a.quantityUsed} units from batch {a.batchNo}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDispense}
                disabled={!dispenseQty}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Confirm Dispense
              </button>
              <button
                onClick={() => setDispenseTarget(null)}
                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;