import { Link } from "react-router-dom";

function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-blue-600">Pharmacy FEFO</span>
        <Link
          to="/login"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Login
        </Link>
      </nav>

      <header className="max-w-4xl mx-auto text-center py-20 px-6">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Never dispense expired medicine again
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Pharmacy FEFO automatically enforces First-Expiry-First-Out dispensing,
          tracks in-date stock in real time, and warns you before batches expire.
        </p>
        <Link
          to="/login"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-blue-700"
        >
          Get Started
        </Link>
      </header>

      <section className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 px-6 pb-20">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="font-semibold text-lg mb-2">FEFO Dispensing</h3>
          <p className="text-slate-600 text-sm">
            Every dispense automatically pulls from the batch expiring soonest —
            never an expired one.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="font-semibold text-lg mb-2">Real-Time Stock</h3>
          <p className="text-slate-600 text-sm">
            Instantly see sellable, in-date stock for any medicine — expired
            batches are excluded automatically.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="font-semibold text-lg mb-2">Expiry Alerts</h3>
          <p className="text-slate-600 text-sm">
            Get a heads-up on batches nearing expiry so nothing goes to waste
            unnoticed.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-6">Who it's for</h2>
        <p className="text-slate-600 text-center mb-10">
          Built for independent and neighbourhood pharmacies that need reliable,
          compliant stock control without a complicated enterprise system.
        </p>

        <h2 className="text-2xl font-bold text-center mb-6">What's next</h2>
        <ul className="text-slate-600 space-y-2 max-w-md mx-auto list-disc list-inside">
          <li>Barcode scanning for faster batch entry</li>
          <li>Supplier reorder suggestions based on stock trends</li>
          <li>Multi-branch inventory sync for pharmacy chains</li>
        </ul>
      </section>
    </div>
  );
}

export default Landing;