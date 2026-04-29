import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "https://hrms-backend-4-8dvy.onrender.com";

const emptyEmployee = {
  employeeId: "",
  name: "",
  email: "",
  department: "",
  position: "",
  employmentType: "Full-time",
  bankAccount: "",
  baseSalary: "",
  taxRate: 10,
  benefitsDeduction: 0,
  status: "Active",
};

const emptyPayroll = {
  period: new Date().toLocaleString("default", { month: "long", year: "numeric" }),
  payDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function App() {
  const [employees, setEmployees] = useState([]);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [editingId, setEditingId] = useState("");
  const [payrollForm, setPayrollForm] = useState(emptyPayroll);
  const [activeRunId, setActiveRunId] = useState("");
  const [status, setStatus] = useState("Loading payroll workspace...");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [employeeData, runData, summaryData] = await Promise.all([
        request("/employees"),
        request("/payroll-runs"),
        request("/summary"),
      ]);
      setEmployees(employeeData);
      setPayrollRuns(runData);
      setSummary(summaryData);
      setActiveRunId((current) => current || runData[0]?._id || "");
      setStatus("Payroll workspace ready");
    } catch (error) {
      setStatus(`API unavailable: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeRun = useMemo(() => {
    return payrollRuns.find((run) => run._id === activeRunId) || payrollRuns[0];
  }, [activeRunId, payrollRuns]);

  const departmentTotals = useMemo(() => {
    return employees.reduce((totals, employee) => {
      const department = employee.department || "Unassigned";
      totals[department] = (totals[department] || 0) + Number(employee.baseSalary || 0);
      return totals;
    }, {});
  }, [employees]);

  function updateEmployeeField(event) {
    const { name, value } = event.target;
    setEmployeeForm((current) => ({ ...current, [name]: value }));
  }

  function updatePayrollField(event) {
    const { name, value } = event.target;
    setPayrollForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(employee) {
    setEditingId(employee._id);
    setEmployeeForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      employmentType: employee.employmentType,
      bankAccount: employee.bankAccount || "",
      baseSalary: employee.baseSalary,
      taxRate: employee.taxRate,
      benefitsDeduction: employee.benefitsDeduction,
      status: employee.status,
    });
  }

  async function saveEmployee(event) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(editingId ? "Updating employee..." : "Adding employee...");

    try {
      const payload = {
        ...employeeForm,
        baseSalary: Number(employeeForm.baseSalary),
        taxRate: Number(employeeForm.taxRate),
        benefitsDeduction: Number(employeeForm.benefitsDeduction),
      };
      await request(editingId ? `/employees/${editingId}` : "/employees", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setEmployeeForm(emptyEmployee);
      setEditingId("");
      await loadData();
      setStatus(editingId ? "Employee updated" : "Employee added");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEmployee(id) {
    setStatus("Deleting employee...");
    try {
      await request(`/employees/${id}`, { method: "DELETE" });
      await loadData();
      setStatus("Employee deleted");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function createPayrollRun(event) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("Calculating payroll run...");

    try {
      const created = await request("/payroll-runs", {
        method: "POST",
        body: JSON.stringify(payrollForm),
      });
      await loadData();
      setActiveRunId(created._id);
      setPayrollForm(emptyPayroll);
      setStatus("Payroll run created");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRunStatus(id, nextStatus) {
    setStatus(`Marking payroll as ${nextStatus.toLowerCase()}...`);
    try {
      await request(`/payroll-runs/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadData();
      setStatus(`Payroll marked ${nextStatus.toLowerCase()}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">MERN Payroll System</p>
          <h1>Payroll Command Center</h1>
        </div>
        <span className="status-pill">{status}</span>
      </section>

      <section className="summary-grid" aria-label="Payroll summary">
        <article>
          <span>Total Employees</span>
          <strong>{summary?.totalEmployees ?? employees.length}</strong>
        </article>
        <article>
          <span>Active Staff</span>
          <strong>{summary?.activeEmployees ?? 0}</strong>
        </article>
        <article>
          <span>Monthly Net Payroll</span>
          <strong>{currency(summary?.monthlyPayroll)}</strong>
        </article>
        <article>
          <span>Payroll Runs</span>
          <strong>{summary?.payrollRuns ?? payrollRuns.length}</strong>
        </article>
      </section>

      <section className="workspace-grid">
        <form className="panel form-panel" onSubmit={saveEmployee}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Employee Records</p>
              <h2>{editingId ? "Edit employee" : "Add employee"}</h2>
            </div>
            {editingId && (
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setEditingId("");
                  setEmployeeForm(emptyEmployee);
                }}
              >
                Cancel
              </button>
            )}
          </div>

          <div className="form-grid">
            <label>
              Employee ID
              <input name="employeeId" value={employeeForm.employeeId} onChange={updateEmployeeField} required />
            </label>
            <label>
              Full Name
              <input name="name" value={employeeForm.name} onChange={updateEmployeeField} required />
            </label>
            <label>
              Email
              <input type="email" name="email" value={employeeForm.email} onChange={updateEmployeeField} required />
            </label>
            <label>
              Department
              <input name="department" value={employeeForm.department} onChange={updateEmployeeField} required />
            </label>
            <label>
              Position
              <input name="position" value={employeeForm.position} onChange={updateEmployeeField} required />
            </label>
            <label>
              Employment Type
              <select name="employmentType" value={employeeForm.employmentType} onChange={updateEmployeeField}>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
              </select>
            </label>
            <label>
              Base Salary
              <input type="number" name="baseSalary" value={employeeForm.baseSalary} onChange={updateEmployeeField} min="0" required />
            </label>
            <label>
              Tax Rate %
              <input type="number" name="taxRate" value={employeeForm.taxRate} onChange={updateEmployeeField} min="0" max="100" required />
            </label>
            <label>
              Benefits Deduction
              <input type="number" name="benefitsDeduction" value={employeeForm.benefitsDeduction} onChange={updateEmployeeField} min="0" />
            </label>
            <label>
              Bank Account
              <input name="bankAccount" value={employeeForm.bankAccount} onChange={updateEmployeeField} />
            </label>
            <label>
              Status
              <select name="status" value={employeeForm.status} onChange={updateEmployeeField}>
                <option>Active</option>
                <option>On Leave</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>

          <button className="primary-button" disabled={isSaving} type="submit">
            {editingId ? "Update Employee" : "Save Employee"}
          </button>
        </form>

        <section className="panel payroll-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Payroll Processing</p>
              <h2>Create payroll run</h2>
            </div>
          </div>

          <form className="payroll-form" onSubmit={createPayrollRun}>
            <label>
              Pay Period
              <input name="period" value={payrollForm.period} onChange={updatePayrollField} required />
            </label>
            <label>
              Pay Date
              <input type="date" name="payDate" value={payrollForm.payDate} onChange={updatePayrollField} required />
            </label>
            <label>
              Notes
              <textarea name="notes" value={payrollForm.notes} onChange={updatePayrollField} rows="3" />
            </label>
            <button className="primary-button" disabled={isSaving} type="submit">
              Run Payroll
            </button>
          </form>

          <div className="department-list">
            <h3>Salary by department</h3>
            {Object.entries(departmentTotals).map(([department, amount]) => (
              <div className="department-row" key={department}>
                <span>{department}</span>
                <strong>{currency(amount)}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Employees</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                <th>Base Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee._id}>
                  <td>
                    <strong>{employee.name}</strong>
                    <span>{employee.employeeId}</span>
                  </td>
                  <td>
                    <strong>{employee.position}</strong>
                    <span>{employee.email}</span>
                  </td>
                  <td>{employee.department}</td>
                  <td>{currency(employee.baseSalary)}</td>
                  <td>
                    <span className={`badge badge-${employee.status.toLowerCase().replace(" ", "-")}`}>{employee.status}</span>
                  </td>
                  <td className="action-cell">
                    <button type="button" onClick={() => startEdit(employee)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteEmployee(employee._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Payroll Runs</p>
            <h2>Run details</h2>
          </div>
          {payrollRuns.length > 0 && (
            <select value={activeRun?._id || ""} onChange={(event) => setActiveRunId(event.target.value)}>
              {payrollRuns.map((run) => (
                <option value={run._id} key={run._id}>
                  {run.period} - {run.status}
                </option>
              ))}
            </select>
          )}
        </div>

        {activeRun ? (
          <>
            <div className="run-summary">
              <div>
                <span>Gross</span>
                <strong>{currency(activeRun.totals.grossPay)}</strong>
              </div>
              <div>
                <span>Taxes</span>
                <strong>{currency(activeRun.totals.taxAmount)}</strong>
              </div>
              <div>
                <span>Deductions</span>
                <strong>{currency(activeRun.totals.benefitsDeduction)}</strong>
              </div>
              <div>
                <span>Net Pay</span>
                <strong>{currency(activeRun.totals.netPay)}</strong>
              </div>
              <div className="status-actions">
                <button type="button" onClick={() => updateRunStatus(activeRun._id, "Approved")}>
                  Approve
                </button>
                <button type="button" onClick={() => updateRunStatus(activeRun._id, "Paid")}>
                  Mark Paid
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Gross</th>
                    <th>Tax</th>
                    <th>Benefits</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRun.entries.map((entry) => (
                    <tr key={`${activeRun._id}-${entry.employeeId}`}>
                      <td>
                        <strong>{entry.name}</strong>
                        <span>{entry.department}</span>
                      </td>
                      <td>{currency(entry.grossPay)}</td>
                      <td>{currency(entry.taxAmount)}</td>
                      <td>{currency(entry.benefitsDeduction)}</td>
                      <td>{currency(entry.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="empty-state">Create a payroll run to see calculated payslips and totals.</p>
        )}
      </section>
    </main>
  );
}

export default App;
