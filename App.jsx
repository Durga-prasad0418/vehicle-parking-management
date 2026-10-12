
import { useEffect, useState, useCallback } from "react";
import "./App.css";

const API = "";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    vehicle_number: "",
    vehicle_type: "car",
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  // API request helper
  const request = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Request failed");
    }

    return data;
  };

  // Load data from backend and SQLite
  const refreshData = useCallback(async () => {
    try {
      setError("");

      const [slotData, vehicleData, historyData, statsData] =
        await Promise.all([
          request("/api/slots"),
          request("/api/vehicles"),
          request("/api/history"),
          request("/api/dashboard"),
        ]);

      setSlots(slotData);
      setVehicles(vehicleData);
      setHistory(historyData);
      setStats(statsData);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to backend. Check if FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Utility functions
  const money = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN")}`;

  const formatTime = (value) =>
    value ? new Date(value).toLocaleString("en-IN") : "—";

  const notify = (message) => {
    setNotice(message);
    setError("");
  };

  const navigate = (name) => {
    setPage(name);
    setNotice("");
    setError("");
  };

  // Register vehicle and automatically allocate a slot
  const registerVehicle = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setNotice("");
    setError("");

    try {
      const result = await request("/api/vehicles/entry", {
        method: "POST",
        body: JSON.stringify({
          vehicle_number: form.vehicle_number.trim().toUpperCase(),
          vehicle_type: form.vehicle_type,
        }),
      });

      setForm({
        vehicle_number: "",
        vehicle_type: "car",
      });

      await refreshData();
      setPage("Vehicles");

      notify(
        `${result.vehicle_number} parked successfully in slot ${result.slot}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Record vehicle exit and calculate parking fee
  const exitVehicle = async (vehicle) => {
    const confirmed = window.confirm(
      `Are you sure you want to record the exit of ${vehicle.vehicle_number}?`
    );

    if (!confirmed) return;

    setNotice("");
    setError("");

    try {
      const result = await request(
        `/api/vehicles/${vehicle.id}/exit`,
        { method: "POST" }
      );

      await refreshData();
      setPage("History");

      notify(
        `${result.vehicle_number} exited successfully. ` +
          `Duration: ${result.duration_hours} hour(s). ` +
          `Parking fee: ${money(result.fee)}`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Sidebar navigation
  const navItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Parking Slots", icon: "▤" },
    { name: "Vehicles", icon: "🚘" },
    { name: "Parking History", icon: "◷" },
    { name: "Add Vehicle", icon: "+" },
  ];

  // Search and filter active vehicles
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = vehicle.vehicle_number
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesType =
      typeFilter === "all" || vehicle.vehicle_type === typeFilter;

    return matchesSearch && matchesType;
  });

  // Search completed parking sessions
  const filteredHistory = history.filter((vehicle) =>
    vehicle.vehicle_number
      .toLowerCase()
      .includes(historySearch.trim().toLowerCase())
  );

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>

          <div>
            <h2>ParkEase</h2>
            <span>Management System</span>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        {navItems.map((item) => (
          <button
            key={item.name}
            className={`menu-item ${
              page === item.name ? "active" : ""
            }`}
            onClick={() => navigate(item.name)}
          >
            {item.icon} &nbsp; {item.name}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="status-dot" />
          Backend connected
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">PARKING MANAGEMENT</p>
            <h1>{page}</h1>

            <p className="subtitle">
              {page === "Dashboard"
                ? "Monitor your parking space at a glance."
                : `Manage your parking system · ${page}`}
            </p>
          </div>

          <button
            className="refresh-btn"
            onClick={refreshData}
            disabled={loading}
          >
            ↻ &nbsp; Refresh
          </button>
        </header>

        {notice && (
          <div className="success-message" role="status">
            ✓ {notice}
          </div>
        )}

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <section className="panel">
            <p className="message">Loading parking data...</p>
          </section>
        ) : (
          <>
            {/* DASHBOARD */}
            {page === "Dashboard" && (
              <>
                <section className="stats">
                  <Stat
                    title="Total Slots"
                    value={stats.total_slots ?? slots.length}
                    icon="▦"
                    color="purple"
                    note="All parking spaces"
                  />

                  <Stat
                    title="Available"
                    value={stats.available ?? 0}
                    icon="✓"
                    color="green"
                    note="Ready for vehicles"
                  />

                  <Stat
                    title="Occupied"
                    value={stats.occupied ?? 0}
                    icon="🚗"
                    color="orange"
                    note="Currently in use"
                  />

                  <Stat
                    title="Occupancy Rate"
                    value={`${stats.occupancy_rate ?? 0}%`}
                    icon="%"
                    color="blue"
                    note="Of total capacity"
                  />
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Parking Overview</h2>
                      <p>Live status from the SQLite database</p>
                    </div>

                    <span className="live-badge">
                      <span className="live-dot" />
                      Live data
                    </span>
                  </div>

                  <div className="legend">
                    <span>
                      <i className="legend-green" />
                      Available
                    </span>

                    <span>
                      <i className="legend-orange" />
                      Occupied
                    </span>
                  </div>

                  <div className="parking-grid">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`parking-slot ${
                          slot.status === "Occupied"
                            ? "occupied"
                            : "available"
                        }`}
                      >
                        <span className="car-icon">
                          {slot.status === "Occupied" ? "🚙" : "P"}
                        </span>

                        <strong>{slot.name}</strong>
                        <span className="slot-status">
                          {slot.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel section-gap">
                  <div className="panel-heading">
                    <div>
                      <h2>Currently Parked</h2>
                      <p>
                        {vehicles.length} vehicle(s) inside the parking lot
                      </p>
                    </div>

                    <button
                      className="secondary-btn"
                      onClick={() => navigate("Vehicles")}
                    >
                      View all
                    </button>
                  </div>

                  <VehicleTable
                    vehicles={vehicles.slice(0, 5)}
                    onExit={exitVehicle}
                    formatTime={formatTime}
                  />
                </section>
              </>
            )}

            {/* PARKING SLOTS */}
            {page === "Parking Slots" && (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>All Parking Slots</h2>
                    <p>
                      {stats.available ?? 0} spaces currently available
                    </p>
                  </div>
                </div>

                <div className="parking-grid">
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`parking-slot ${
                        slot.status === "Occupied"
                          ? "occupied"
                          : "available"
                      }`}
                    >
                      <span className="car-icon">
                        {slot.status === "Occupied" ? "🚙" : "P"}
                      </span>

                      <strong>{slot.name}</strong>
                      <span className="slot-status">{slot.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ADD VEHICLE */}
            {page === "Add Vehicle" && (
              <section className="panel form-panel">
                <h2>Register Vehicle Entry</h2>

                <p className="form-description">
                  Enter the vehicle registration number and type.
                  The system will automatically allocate an available slot.
                </p>

                <form onSubmit={registerVehicle}>
                  <label htmlFor="vehicle-number">
                    Vehicle Registration Number
                  </label>

                  <input
                    id="vehicle-number"
                    value={form.vehicle_number}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        vehicle_number: event.target.value,
                      })
                    }
                    placeholder="e.g. TS09AB1234"
                    autoComplete="off"
                    maxLength={20}
                    required
                  />

                  <label htmlFor="vehicle-type">Vehicle Type</label>

                  <select
                    id="vehicle-type"
                    value={form.vehicle_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        vehicle_type: event.target.value,
                      })
                    }
                  >
                    <option value="car">Car — ₹20/hour</option>
                    <option value="bike">Bike — ₹10/hour</option>
                    <option value="truck">Truck — ₹40/hour</option>
                  </select>

                  <button
                    className="primary-btn"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Registering..."
                      : "Register & Allocate Slot"}
                  </button>
                </form>
              </section>
            )}

            {/* ACTIVE VEHICLES */}
            {page === "Vehicles" && (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Active Vehicles</h2>
                    <p>
                      {filteredVehicles.length} matching vehicle(s)
                    </p>
                  </div>

                  <button
                    className="primary-btn"
                    onClick={() => navigate("Add Vehicle")}
                  >
                    + Add Vehicle
                  </button>
                </div>

                <div className="vehicle-filters">
                  <input
                    type="search"
                    placeholder="Search vehicle number..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search vehicle registration number"
                  />

                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    aria-label="Filter by vehicle type"
                  >
                    <option value="all">All Vehicles</option>
                    <option value="car">Cars</option>
                    <option value="bike">Bikes</option>
                    <option value="truck">Trucks</option>
                  </select>
                </div>

                <VehicleTable
                  vehicles={filteredVehicles}
                  onExit={exitVehicle}
                  formatTime={formatTime}
                />
              </section>
            )}

            {/* PARKING HISTORY */}
            {page === "Parking History" && (
              <>
                <section className="stats">
                  <Stat
                    title="Completed Sessions"
                    value={history.length}
                    icon="✓"
                    color="purple"
                    note="Vehicles exited"
                  />

                  <Stat
                    title="Total Recorded Revenue"
                    value={money(stats.today_revenue)}
                    icon="₹"
                    color="green"
                    note="All completed sessions"
                  />
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Parking History</h2>
                      <p>Completed parking sessions and fees</p>
                    </div>
                  </div>

                  <div className="vehicle-filters">
                    <input
                      type="search"
                      placeholder="Search parking history..."
                      value={historySearch}
                      onChange={(event) =>
                        setHistorySearch(event.target.value)
                      }
                      aria-label="Search parking history"
                    />
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Vehicle Number</th>
                          <th>Type</th>
                          <th>Entry Time</th>
                          <th>Exit Time</th>
                          <th>Parking Fee</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredHistory.map((vehicle) => (
                          <tr key={vehicle.id}>
                            <td>
                              <strong>{vehicle.vehicle_number}</strong>
                            </td>
                            <td>
                              <span className="vehicle-type">
                                {vehicle.vehicle_type}
                              </span>
                            </td>
                            <td>{formatTime(vehicle.entry_time)}</td>
                            <td>{formatTime(vehicle.exit_time)}</td>
                            <td>
                              <strong>{money(vehicle.fee)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredHistory.length === 0 && (
                      <p className="message">
                        No matching completed parking sessions.
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        <footer>
          <span>ParkEase · Vehicle Parking Management</span>
          <span>React + FastAPI + SQLite</span>
        </footer>
      </main>
    </div>
  );
}

// Reusable dashboard statistic card
function Stat({ title, value, icon, color, note }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>

      <h2>{value}</h2>
      <p>{note}</p>
    </div>
  );
}

// Reusable active vehicle table with search handled by the parent
function VehicleTable({ vehicles, onExit, formatTime }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Vehicle Number</th>
            <th>Type</th>
            <th>Slot</th>
            <th>Entry Time</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id}>
              <td>
                <strong>{vehicle.vehicle_number}</strong>
              </td>

              <td>
                <span
                  className={`vehicle-type ${vehicle.vehicle_type}`}
                >
                  {vehicle.vehicle_type}
                </span>
              </td>

              <td>
                <span className="slot-tag">{vehicle.slot}</span>
              </td>

              <td>{formatTime(vehicle.entry_time)}</td>

              <td>
                <button
                  className="exit-btn"
                  onClick={() => onExit(vehicle)}
                >
                  Exit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {vehicles.length === 0 && (
        <p className="message">No vehicles found.</p>
      )}
    </div>
  );
}

export default App;
