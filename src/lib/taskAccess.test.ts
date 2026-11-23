import { describe, it, expect } from "vitest";
import { canSeeAllTasks, canSeeTask } from "./taskAccess";

const me = "user-me";
const other = "user-other";

describe("task visibility", () => {
  it("admins see every task", () => {
    expect(canSeeTask(["admin"], me, { assignee_id: other, created_by: other })).toBe(true);
  });

  it("project managers see every task", () => {
    expect(canSeeTask(["project_manager"], me, { assignee_id: other, created_by: other })).toBe(true);
  });

  it("staff see tasks assigned to them", () => {
    expect(canSeeTask(["mechanic"], me, { assignee_id: me, created_by: other })).toBe(true);
  });

  it("staff see tasks they created", () => {
    expect(canSeeTask(["cs_agent"], me, { assignee_id: other, created_by: me })).toBe(true);
  });

  it("staff do not see other people's tasks", () => {
    expect(canSeeTask(["route_planner", "loader"], me, { assignee_id: other, created_by: other })).toBe(false);
    expect(canSeeTask(["mechanic"], me, { assignee_id: null, created_by: other })).toBe(false);
  });

  it("only admin and project manager have oversight", () => {
    expect(canSeeAllTasks(["route_planner", "cs_agent", "timeslip_admin", "fleet_manager"])).toBe(false);
  });
});
