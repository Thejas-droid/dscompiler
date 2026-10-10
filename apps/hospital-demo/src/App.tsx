import { useEffect, useState } from "react";
import type { InspectionReport } from "@dsc/enforcer";
import { readReport, subscribeReport } from "virtual:ds-report";
import { Button } from "./design-system/Button";
const appointments = [
  {
    id: "CF-1042",
    name: "Alex Morgan",
    initials: "AM",
    time: "09:15",
    department: "General medicine",
    clinician: "Dr. Rivera",
    status: "Checked in",
  },
  {
    id: "CF-1043",
    name: "Jamie Chen",
    initials: "JC",
    time: "09:30",
    department: "Cardiology",
    clinician: "Dr. Shah",
    status: "Confirmed",
  },
  {
    id: "CF-1044",
    name: "Sam Taylor",
    initials: "ST",
    time: "10:00",
    department: "Physiotherapy",
    clinician: "Dr. Lee",
    status: "Confirmed",
  },
];
export function App() {
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    const off = subscribeReport((next) => {
      if (alive) setReport(next);
    });
    readReport()
      .then((next) => {
        if (alive) setReport(next);
      })
      .catch(() => {
        if (alive)
          setNotice(
            "Live checks are unavailable. Check the development terminal.",
          );
      });
    return () => {
      alive = false;
      off();
    };
  }, []);
  const shown = appointments.filter((a) =>
    `${a.name} ${a.department} ${a.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const errors =
    report?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const warnings =
    report?.diagnostics.filter((d) => d.severity === "warning").length ?? 0;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-mark" aria-hidden="true">
            +
          </span>
          CareFlow
        </a>
        <p className="workspace">HOSPITAL WORKSPACE</p>
        <nav aria-label="Workspace">
          <a className="active" href="#overview">
            Overview
          </a>
          <a href="#appointments">Appointments</a>
          <a href="#design-checks">Design-system checks</a>
        </nav>
        <div className="sidebar-note">
          <strong>A connected design system</strong>
          <p>Approved tokens and components power every screen.</p>
          <span className="badge">Local integration demo</span>
        </div>
      </aside>
      <main id="overview">
        <header className="topbar">
          <span>Care operations / Overview</span>
          <span className="account">
            CF <span>Demo workspace</span>
          </span>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">A CLEARER START TO YOUR DAY</p>
              <h1>Care, coordinated.</h1>
              <p className="muted">
                Appointments, team activity, and a consistent interface.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                setNotice(
                  "Demo action complete. A real application would open its appointment workflow.",
                )
              }
            >
              Try appointment action
            </Button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <Button variant="secondary" onClick={() => setNotice("")}>
                Dismiss
              </Button>
            </div>
          )}
          <section className="stats" aria-label="Daily summary">
            <article className="stat">
              <p>Today's appointments</p>
              <strong className="appointment-count">
                {appointments.length}
              </strong>
              <span>All sample records</span>
            </article>
            <article className="stat">
              <p>Patients checked in</p>
              <strong>1</strong>
              <span className="positive">Ready for their visit</span>
            </article>
            <article className="stat">
              <p>Care departments</p>
              <strong>3</strong>
              <span>One connected workspace</span>
            </article>
          </section>
          <section className="panel" id="appointments">
            <div className="panel-heading">
              <div>
                <h2>Upcoming appointments</h2>
                <p className="muted">
                  Synthetic records for testing. No patient data is stored.
                </p>
              </div>
              <label className="search">
                Search appointments
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, department, or ID"
                />
              </label>
            </div>
            <div
              className="table-scroll"
              role="region"
              aria-label="Appointments table"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Time</th>
                    <th scope="col">Department</th>
                    <th scope="col">Clinician</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="patient">
                          <span className="avatar" aria-hidden="true">
                            {a.initials}
                          </span>
                          <div>
                            <strong>{a.name}</strong>
                            <small>{a.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{a.time}</td>
                      <td>{a.department}</td>
                      <td>{a.clinician}</td>
                      <td>
                        <span className="badge">{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length && (
                <p className="empty">
                  No matching appointments. Try another search.
                </p>
              )}
            </div>
          </section>
          <section className="panel checks" id="design-checks">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">DEVELOPER DEMO</p>
                <h2>Design-system checks</h2>
                <p className="muted">
                  Edit source files to see this report update while the app
                  runs.
                </p>
              </div>
              <span
                className={errors || warnings ? "badge caution" : "badge"}
                role="status"
              >
                {!report
                  ? "Live report unavailable"
                  : !report.ready
                    ? "Baseline invalid"
                    : errors || warnings
                      ? `${errors} errors · ${warnings} warnings`
                      : "Checks passed"}
              </span>
            </div>
            <ol className="steps">
              <li>
                <strong>Introduce a style violation</strong>
                <span>
                  Run <code>pnpm demo:break</code> in another terminal.
                </span>
              </li>
              <li>
                <strong>Read the explanation</strong>
                <span>
                  A hardcoded color appears below and in the terminal.
                </span>
              </li>
              <li>
                <strong>Restore the approved style</strong>
                <span>
                  Run <code>pnpm demo:fix</code>. The warning clears
                  automatically.
                </span>
              </li>
            </ol>
            {report && (
              <>
                <p className="coverage">
                  {report.coverage.scanned.length} files scanned ·{" "}
                  {report.coverage.unsupported.length} unsupported ·{" "}
                  {report.suppressed.length} reviewed exceptions
                </p>
                <div className="diagnostics" aria-live="polite">
                  {report.diagnostics.map((d, i) => (
                    <article className="diagnostic" key={`${d.code}-${i}`}>
                      <strong>{d.code}</strong>
                      <code>
                        {d.source
                          ? `${d.source.file}:${d.source.line}:${d.source.column}`
                          : "Approved baseline"}
                      </code>
                      <p>{d.message}</p>
                      {d.suggestion && <p className="muted">{d.suggestion}</p>}
                    </article>
                  ))}
                </div>
                <details>
                  <summary>Approved contract revision</summary>
                  <code className="hash">
                    {report.contractHash || "Unavailable"}
                  </code>
                  <p className="muted">
                    This checks configured React and CSS rules. It does not
                    prove every layout is visually correct.
                  </p>
                </details>
              </>
            )}
          </section>
          <footer>
            CareFlow integration demo · React + plain CSS · Your approved design
            system remains the source of truth.
          </footer>
        </div>
      </main>
    </div>
  );
}
