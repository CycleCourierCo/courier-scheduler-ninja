import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import TaskList from "./src/components/tasks/TaskList";
import AssigneePicker from "./src/components/tasks/AssigneePicker";
import { Dialog, DialogContent } from "./src/components/ui/dialog";
const users = Array.from({ length: 25 }, (_, i) => ({ id: "u" + i, name: "Staff Member Number " + i, email: null }));
const tasks: any[] = [1, 2, 3].map(i => ({ id: "t" + i, title: "Call the customer about a very long delayed bike collection number " + i, status: "open", priority: "high", due_date: "2026-11-01T10:00:00Z", assignee: users[i], creator: users[i + 5], linked_order_id: "x", linked_conversation_id: null }));
function App() {
  const [a, setA] = useState("all"); const [b, setB] = useState(""); const [o, setO] = useState(true);
  return <div className="p-3">
    <div data-testid="filter" className="grid grid-cols-2 gap-2"><div /><div /><AssigneePicker id="f" floating value={a} onChange={setA} users={users} fixedOptions={[{ value: "all", label: "Anyone" }, { value: "mine", label: "Mine" }]} /><div /></div>
    <p data-testid="fv">{a}</p>
    <div className="border rounded-md min-w-0 overflow-hidden"><TaskList tasks={tasks} onSelect={() => {}} /></div>
    <Dialog open={o} onOpenChange={setO}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><div className="grid grid-cols-2 gap-3"><div className="col-span-2"><AssigneePicker id="d" value={b} onChange={setB} users={users} fixedOptions={[{ value: "", label: "Unassigned" }]} /></div></div><p data-testid="dv">{b}</p></DialogContent></Dialog>
  </div>;
}
createRoot(document.getElementById("root")!).render(<App />);
