import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders payroll command center", () => {
  render(<App />);
  expect(screen.getByText(/Payroll Command Center/i)).toBeInTheDocument();
});
